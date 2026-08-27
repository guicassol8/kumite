import { afterEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'kumite-lang'
const realLocalStorage = window.localStorage

function stubNavigatorLanguage(language: string) {
  Object.defineProperty(window.navigator, 'language', { value: language, configurable: true })
  Object.defineProperty(window.navigator, 'languages', { value: [language], configurable: true })
}

async function loadI18n() {
  vi.resetModules()
  const { default: i18n } = await import('./index')
  return i18n
}

afterEach(() => {
  delete (window.navigator as { language?: string }).language
  delete (window.navigator as { languages?: readonly string[] }).languages
  Object.defineProperty(window, 'localStorage', { configurable: true, value: realLocalStorage })
  realLocalStorage.clear()
})

describe('language detection', () => {
  it('opens in Spanish for an es-MX browser with no stored language', async () => {
    stubNavigatorLanguage('es-MX')
    const i18n = await loadI18n()
    expect(i18n.resolvedLanguage).toBe('es')
  })

  it('opens in English for an en-US browser with no stored language', async () => {
    stubNavigatorLanguage('en-US')
    const i18n = await loadI18n()
    expect(i18n.resolvedLanguage).toBe('en')
  })

  it('falls back to Portuguese for an unsupported browser language', async () => {
    stubNavigatorLanguage('de-DE')
    const i18n = await loadI18n()
    expect(i18n.resolvedLanguage).toBe('pt')
  })

  it('prefers a stored language over the browser language', async () => {
    realLocalStorage.setItem(STORAGE_KEY, 'en')
    stubNavigatorLanguage('es-MX')
    const i18n = await loadI18n()
    expect(i18n.resolvedLanguage).toBe('en')
  })

  it('still resolves via the browser language when localStorage throws', async () => {
    stubNavigatorLanguage('es-MX')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('localStorage unavailable')
      },
    })
    const i18n = await loadI18n()
    expect(i18n.resolvedLanguage).toBe('es')
  })
})
