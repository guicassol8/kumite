import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// config.ts parses process.env at import time, so every case here needs a
// fresh module instance (vi.resetModules) after mutating process.env.
describe('config AWS_* env vars', () => {
  const originalEnv = { ...process.env }
  const required = {
    JWT_SECRET: 'test-secret',
    DATABASE_URL: 'postgres://kumite:kumite@localhost:5433/kumite',
  }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv, ...required }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('treats an explicitly blank value (as in .env.example) as unset, not invalid', async () => {
    process.env.AWS_REGION = ''
    process.env.AWS_ACCESS_KEY_ID = ''
    process.env.AWS_SECRET_ACCESS_KEY = ''

    const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = await import('./config')

    expect(AWS_REGION).toBeUndefined()
    expect(AWS_ACCESS_KEY_ID).toBeUndefined()
    expect(AWS_SECRET_ACCESS_KEY).toBeUndefined()
  })

  it('keeps a real value when set', async () => {
    process.env.AWS_REGION = 'us-east-1'

    const { AWS_REGION } = await import('./config')

    expect(AWS_REGION).toBe('us-east-1')
  })
})

describe('config PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER (#143)', () => {
  const originalEnv = { ...process.env }
  const required = {
    JWT_SECRET: 'test-secret',
    DATABASE_URL: 'postgres://kumite:kumite@localhost:5433/kumite',
  }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv, ...required }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('defaults to 5 wrong admin passwords per organizer', async () => {
    process.env.PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER = undefined
    delete process.env.PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER

    const { PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER } = await import('./config')

    expect(PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER).toBe(5)
  })

  it('is overridable by env', async () => {
    process.env.PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER = '2'

    const { PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER } = await import('./config')

    expect(PASSWORD_RESET_ADMIN_MAX_PER_ORGANIZER).toBe(2)
  })
})
