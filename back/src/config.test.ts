import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

// config.ts parses process.env at import time, so every case here needs a
// fresh module instance (vi.resetModules) after mutating process.env.
describe('config SES_* env vars', () => {
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
    process.env.SES_REGION = ''
    process.env.SES_ACCESS_KEY_ID = ''
    process.env.SES_SECRET_ACCESS_KEY = ''

    const { SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY } = await import('./config')

    expect(SES_REGION).toBeUndefined()
    expect(SES_ACCESS_KEY_ID).toBeUndefined()
    expect(SES_SECRET_ACCESS_KEY).toBeUndefined()
  })

  it('keeps a real value when set', async () => {
    process.env.SES_REGION = 'us-east-1'

    const { SES_REGION } = await import('./config')

    expect(SES_REGION).toBe('us-east-1')
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

describe('config env validation failure (#97)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    // config.ts calls loadEnvFile(), which fills in every name absent from
    // process.env — without this stub a developer's back/.env would put
    // JWT_SECRET back and the case would pass for the wrong reason locally
    // while still failing in CI, where no .env exists.
    vi.spyOn(process, 'loadEnvFile').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('names the missing variable and points at .env.example instead of dumping a ZodError', async () => {
    delete process.env.JWT_SECRET

    await expect(import('./config')).rejects.toThrow(/JWT_SECRET: required, but not set/)
    await expect(import('./config')).rejects.toThrow(/back\/\.env\.example/)
  })

  it('lists every offending variable at once, not just the first', async () => {
    delete process.env.JWT_SECRET
    process.env.DATABASE_URL = 'not-a-url'

    const error = await import('./config').catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(z.ZodError)
    const { message } = error as Error
    expect(message).toContain('2 variables missing or invalid')
    expect(message).toContain('JWT_SECRET: required, but not set')
    expect(message).toContain('DATABASE_URL: Invalid url')
    // The malformed value may carry a password — it must never be echoed.
    expect(message).not.toContain('not-a-url')
  })
})

describe('config APP_BASE_URL (#162)', () => {
  const originalEnv = { ...process.env }
  const required = {
    JWT_SECRET: 'test-secret',
    DATABASE_URL: 'postgres://kumite:kumite@localhost:5433/kumite',
  }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv, ...required }
    delete process.env.APP_BASE_URL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('defaults to the local front origin when unset', async () => {
    const { APP_BASE_URL } = await import('./config')

    expect(APP_BASE_URL).toBe('http://localhost:5173')
  })

  it('keeps a real value when set', async () => {
    process.env.APP_BASE_URL = 'https://kumite.ligadealgoritmos.com'

    const { APP_BASE_URL } = await import('./config')

    expect(APP_BASE_URL).toBe('https://kumite.ligadealgoritmos.com')
  })

  it('strips the trailing slash so the link never becomes //reset-password', async () => {
    process.env.APP_BASE_URL = 'https://kumite.ligadealgoritmos.com/'

    const { APP_BASE_URL } = await import('./config')

    expect(APP_BASE_URL).toBe('https://kumite.ligadealgoritmos.com')
  })

  it('treats an explicitly blank value (as in .env.example) as unset, not invalid', async () => {
    process.env.APP_BASE_URL = ''

    const { APP_BASE_URL } = await import('./config')

    expect(APP_BASE_URL).toBe('http://localhost:5173')
  })
})
