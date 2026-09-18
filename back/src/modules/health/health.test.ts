import { afterAll, describe, expect, it } from 'vitest'

import { app } from '../../app'
import { k } from '../../context'

import { checkHealth } from './health.service'

afterAll(async () => {
  await k.resolve('db').$client.end()
})

describe('checkHealth', () => {
  it('reports ok when the ping settles', async () => {
    await expect(checkHealth(async () => undefined)).resolves.toEqual({ status: 'ok' })
  })

  it('reports degraded when the ping rejects', async () => {
    await expect(
      checkHealth(async () => Promise.reject(new Error('ECONNREFUSED'))),
    ).resolves.toEqual({
      status: 'degraded',
    })
  })

  it('reports degraded when the ping hangs past the timeout', async () => {
    const never = () => new Promise<never>(() => {})
    await expect(checkHealth(never, 20)).resolves.toEqual({ status: 'degraded' })
  })
})

describe('GET /health', () => {
  // Runs against the real dockerized Postgres (docker compose up -d), like the
  // rest of the suite: with the database answering, the probe is a 200.
  it('answers 200 ok with the database up', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
