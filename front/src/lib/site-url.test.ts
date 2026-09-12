import { describe, expect, it } from 'vitest'

import { DEFAULT_SITE_URL, resolveSiteUrl } from './site-url'

describe('resolveSiteUrl', () => {
  it('falls back to the default when VITE_SITE_URL is absent', () => {
    expect(resolveSiteUrl({})).toBe(DEFAULT_SITE_URL)
  })

  it('falls back to the default when VITE_SITE_URL is an empty string', () => {
    expect(resolveSiteUrl({ VITE_SITE_URL: '' })).toBe(DEFAULT_SITE_URL)
  })

  it('trims a trailing slash', () => {
    expect(resolveSiteUrl({ VITE_SITE_URL: 'https://kumite-preview.vercel.app/' })).toBe(
      'https://kumite-preview.vercel.app',
    )
  })

  it('trims more than one trailing slash', () => {
    expect(resolveSiteUrl({ VITE_SITE_URL: 'https://kumite-preview.vercel.app///' })).toBe(
      'https://kumite-preview.vercel.app',
    )
  })

  it('trims surrounding whitespace, as a Vercel preview env var might carry', () => {
    expect(resolveSiteUrl({ VITE_SITE_URL: '  https://kumite-preview.vercel.app  ' })).toBe(
      'https://kumite-preview.vercel.app',
    )
  })

  it('passes through a value with no trailing slash unchanged', () => {
    expect(resolveSiteUrl({ VITE_SITE_URL: 'https://kumite.ligadealgoritmos.com' })).toBe(
      'https://kumite.ligadealgoritmos.com',
    )
  })
})
