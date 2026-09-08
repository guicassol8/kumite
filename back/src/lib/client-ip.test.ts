import type { Context } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { clientIp } from './client-ip'

const getConnInfo = vi.hoisted(() => vi.fn())
vi.mock('@hono/node-server/conninfo', () => ({
  getConnInfo: (c: unknown) => getConnInfo(c),
}))

function contextWith(forwardedFor: string | null, remoteAddress?: string): Context {
  getConnInfo.mockReturnValue({ remote: { address: remoteAddress } })
  return {
    req: { header: (name: string) => (name === 'x-forwarded-for' ? forwardedFor : undefined) },
  } as unknown as Context
}

describe('clientIp', () => {
  // The proxy appends its own view of the caller to whatever the caller sent,
  // so only the rightmost entry is trustworthy — reading the leftmost would
  // let any client pick its own throttle bucket by sending the header itself.
  it('takes the last X-Forwarded-For entry, not the client-supplied first one', () => {
    expect(clientIp(contextWith('1.1.1.1, 2.2.2.2, 203.0.113.9', '10.0.0.1'))).toBe('203.0.113.9')
  })

  it('reads a single-valued X-Forwarded-For', () => {
    expect(clientIp(contextWith('203.0.113.9', '10.0.0.1'))).toBe('203.0.113.9')
  })

  it('trims the surrounding whitespace of the entry it picks', () => {
    expect(clientIp(contextWith('1.1.1.1 ,  203.0.113.9  ', '10.0.0.1'))).toBe('203.0.113.9')
  })

  it('falls back to the socket address when the header is absent', () => {
    expect(clientIp(contextWith(null, '10.0.0.1'))).toBe('10.0.0.1')
  })

  it('falls back to the socket address when the header is blank', () => {
    expect(clientIp(contextWith('   ', '10.0.0.1'))).toBe('10.0.0.1')
  })

  it('returns unknown when there is neither a header nor a socket address', () => {
    expect(clientIp(contextWith(null, undefined))).toBe('unknown')
  })
})
