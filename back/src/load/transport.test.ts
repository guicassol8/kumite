import { describe, expect, it } from 'vitest'

import { app } from '../app'

import { createRecorder } from './recorder'
import { createTransport } from './transport'

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
})
