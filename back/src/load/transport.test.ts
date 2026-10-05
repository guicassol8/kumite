import { createServer, type Socket } from 'node:net'

import { describe, expect, it } from 'vitest'

import { app } from '../app'

import { createRecorder } from './recorder'
import { createTransport, detailOf, resendIfStale } from './transport'

describe('createTransport', () => {
  it('records a request made through the typed client, in-process', async () => {
    const recorder = createRecorder()
    const transport = createTransport({
      baseUrl: 'http://localhost',
      recorder,
      requestTimeoutMs: 10_000,
      fetch: async (input, init) => app.request(input, init),
    })

    const res = await transport.api().health.$get()

    expect(res.status).toBe(200)
    expect(recorder.snapshot().http.rest?.['GET /health']).toMatchObject({
      count: 1,
      byStatus: { '200': 1 },
    })
  })

  it('records a 500 with its envelope code and still returns the response', async () => {
    const recorder = createRecorder()
    const transport = createTransport({
      baseUrl: 'http://localhost',
      recorder,
      requestTimeoutMs: 10_000,
      fetch: async () => Response.json({ error: 'internal', message: 'boom' }, { status: 500 }),
    })

    const res = await transport.timedFetch('http://localhost/submissions', { method: 'POST' })

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal', message: 'boom' })
    expect(recorder.snapshot().http.rest?.['POST /submissions']?.byStatus).toEqual({
      '500:internal': 1,
    })
  })

  it('records ECONNREFUSED as a network error and rethrows it', async () => {
    const recorder = createRecorder()
    const transport = createTransport({
      baseUrl: 'http://localhost',
      recorder,
      requestTimeoutMs: 10_000,
      fetch: async () => {
        throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } })
      },
    })

    await expect(transport.timedFetch('http://localhost/health')).rejects.toThrow('fetch failed')
    expect(recorder.snapshot().http.rest?.['GET /health']).toMatchObject({
      count: 1,
      networkErrors: 1,
      timeouts: 0,
      byStatus: { network: 1 },
    })
  })

  it('aborts a request past the timeout and records it as one', async () => {
    const recorder = createRecorder()
    const transport = createTransport({
      baseUrl: 'http://localhost',
      recorder,
      requestTimeoutMs: 20,
      fetch: (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    })

    await expect(transport.timedFetch('http://localhost/health')).rejects.toBeDefined()
    expect(recorder.snapshot().http.rest?.['GET /health']).toMatchObject({
      networkErrors: 1,
      timeouts: 1,
    })
  })

  // #138: a keep-alive socket the server closes as the client reuses it. A
  // raw TCP server answers the first request with keep-alive, then destroys
  // the socket as soon as the second request arrives, without a byte back —
  // undici's "other side closed" (UND_ERR_SOCKET), with the socket attached.
  it('records the code, the stage and the reuse of a socket closed under a request', async () => {
    const server = createServer((socket: Socket) => {
      let requests = 0
      let buffer = ''
      socket.on('data', (chunk) => {
        // A whole request: its headers and its 1-byte body.
        buffer += chunk.toString()
        const end = buffer.indexOf('\r\n\r\n')
        if (end === -1 || buffer.length < end + 5) return
        buffer = buffer.slice(end + 5)
        requests += 1
        if (requests === 1) {
          socket.write('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: keep-alive\r\n\r\nok')
        } else {
          socket.destroy()
        }
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('no port')
    const url = `http://127.0.0.1:${address.port}/submissions`
    const recorder = createRecorder()
    const transport = createTransport({ baseUrl: url, recorder, requestTimeoutMs: 10_000 })

    try {
      const first = await transport.timedFetch(url, { method: 'POST', body: 'a' })
      expect(first.status).toBe(200)
      // undici only hands an idle socket back out: one that just answered is
      // still settling, and a request sent at once would open a new one.
      await new Promise((resolve) => setTimeout(resolve, 100))
      const error = await transport.timedFetch(url, { method: 'POST', body: 'b' }).then(
        () => null,
        (caught: unknown) => caught,
      )

      expect(error).not.toBeNull()
      expect(detailOf(error)).toMatchObject({ stage: 'request', reusedSocket: true })
      const stats = recorder.snapshot().http.rest?.['POST /submissions']
      expect(stats?.networkErrors).toBe(1)
      expect(stats?.networkSamples[0]?.socketBytesRead).toBeGreaterThan(0)
      expect(Object.keys(stats?.networkReasons ?? {})).toEqual([
        `${detailOf(error)?.reason} · request · reused`,
      ])
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  it('tells a failure while reading the body from one before any response', async () => {
    const recorder = createRecorder()
    const body = new ReadableStream({
      start(controller) {
        controller.error(new TypeError('terminated', { cause: { code: 'UND_ERR_SOCKET' } }))
      },
    })
    const transport = createTransport({
      baseUrl: 'http://localhost',
      recorder,
      requestTimeoutMs: 10_000,
      fetch: async () => new Response(body, { status: 200 }),
    })

    const error = await transport.timedFetch('http://localhost/health').then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(detailOf(error)).toMatchObject({
      reason: 'UND_ERR_SOCKET',
      stage: 'body',
      reusedSocket: null,
    })
  })

  it('resends a read once after a stale socket, counted, and lets any other error through', async () => {
    const stale = () =>
      new TypeError('fetch failed', {
        cause: { code: 'UND_ERR_SOCKET', socket: { bytesWritten: 300, bytesRead: 200 } },
      })
    const errors: Array<() => Error> = [
      stale,
      () => new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }),
    ]
    const recorder = createRecorder()
    const transport = createTransport({
      baseUrl: 'http://localhost',
      recorder,
      requestTimeoutMs: 10_000,
      fetch: async (input, init) => {
        const next = errors.shift()
        if (next) throw next()
        return app.request(input, init)
      },
    })
    const health = () =>
      resendIfStale(recorder, 'GET', '/health', () => transport.api().health.$get())

    await expect(health()).rejects.toThrow('fetch failed')
    expect((await health()).status).toBe(200)
    expect(recorder.snapshot().retries).toEqual([
      {
        phase: 'rest',
        route: 'GET /health',
        reason: 'UND_ERR_SOCKET · request · reused',
        count: 1,
      },
    ])
  })
})
