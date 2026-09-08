import { afterEach, describe, expect, it, vi } from 'vitest'

import { isAnalyticsEnabled } from './analytics-env'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isAnalyticsEnabled', () => {
  it('is off when VITE_VERCEL_ENV is absent — local dev and the test run', () => {
    expect(isAnalyticsEnabled()).toBe(false)
  })

  it('is off on Vercel preview deployments', () => {
    vi.stubEnv('VITE_VERCEL_ENV', 'preview')
    expect(isAnalyticsEnabled()).toBe(false)
  })

  it('is off on the Vercel development environment', () => {
    vi.stubEnv('VITE_VERCEL_ENV', 'development')
    expect(isAnalyticsEnabled()).toBe(false)
  })

  it('is on only in production', () => {
    vi.stubEnv('VITE_VERCEL_ENV', 'production')
    expect(isAnalyticsEnabled()).toBe(true)
  })
})
