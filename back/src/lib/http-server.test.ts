import { readFileSync } from 'node:fs'
import { get, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SERVER_TIMEOUTS, serveApp } from './http-server'

// Node closes an idle keep-alive socket at keepAliveTimeout plus its
// keepAliveTimeoutBuffer (1 000 ms by default, lib/_http_server.js).
const NODE_KEEPALIVE_BUFFER_MS = 1_000
// Node's default requestTimeout; createServer throws when headersTimeout
// exceeds it.
const NODE_REQUEST_TIMEOUT_MS = 300_000

const DURATION_UNITS_MS: Record<string, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 }

/** The idle time Caddy keeps a pooled upstream socket, as the Caddyfile pins it. */
function caddyUpstreamIdleMs(): number {
  const caddyfile = readFileSync(new URL('../../../Caddyfile', import.meta.url), 'utf8')
  const lines = caddyfile
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^keepalive\s/.test(line))
  expect(lines, 'the Caddyfile pins exactly one `keepalive <duration>`').toHaveLength(1)
  const match = /^keepalive\s+(\d+)(ms|s|m|h)$/.exec(lines[0] ?? '')
  expect(match, `parseable keepalive duration in "${lines[0]}"`).not.toBeNull()
  const [, amount, unit] = match as RegExpExecArray
  return Number(amount) * (DURATION_UNITS_MS[unit as string] as number)
}

describe('SERVER_TIMEOUTS against the Caddyfile (#438)', () => {
  it('closes an idle socket only after Caddy has dropped it from its pool', () => {
    const caddyIdle = caddyUpstreamIdleMs()
    expect(caddyIdle).toBeGreaterThan(0)
    expect(SERVER_TIMEOUTS.keepAliveTimeout).toBeGreaterThanOrEqual(caddyIdle + 5_000)
  })

  it('keeps headersTimeout above the real close and within requestTimeout', () => {
    expect(SERVER_TIMEOUTS.headersTimeout).toBeGreaterThan(
      SERVER_TIMEOUTS.keepAliveTimeout + NODE_KEEPALIVE_BUFFER_MS,
    )
    expect(SERVER_TIMEOUTS.headersTimeout).toBeLessThanOrEqual(NODE_REQUEST_TIMEOUT_MS)
  })
})

// main.ts is the entrypoint: no test imports it (it would listen and start the
// ticks), so a bare `serve()` coming back there — a merge resolution, a boot
// refactor — would drop the timeouts past every gate. Read it instead.
describe('main.ts boots through serveApp (#438)', () => {
  const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8')

  it('starts the app with serveApp, never a bare serve()', () => {
    expect(main).toMatch(/^serveApp\(app\.fetch, env\.PORT\b/m)
    expect(main).not.toMatch(/from '@hono\/node-server'/)
  })
})

describe('serveApp (#438)', () => {
  let server: Server

  beforeAll(async () => {
    server = serveApp(() => new Response('ok'), 0) as Server
    if (!server.listening) await new Promise<void>((resolve) => server.once('listening', resolve))
  })

  afterAll(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('applies the timeouts to the Node server', () => {
    expect(server.keepAliveTimeout).toBe(130_000)
    expect(server.headersTimeout).toBe(135_000)
  })

  it('announces Keep-Alive: timeout=130 to the client', async () => {
    const { port } = server.address() as AddressInfo
    const headers = await new Promise<IncomingHttpHeaders>((resolve, reject) => {
      get({ port, path: '/', headers: { connection: 'keep-alive' } }, (res) => {
        res.resume()
        res.on('end', () => resolve(res.headers))
      }).on('error', reject)
    })
    expect(headers['keep-alive']).toBe('timeout=130')
  })
})
