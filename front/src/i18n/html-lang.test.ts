import { afterEach, describe, expect, it, vi } from 'vitest'

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
  window.localStorage.clear()
  document.documentElement.lang = ''
})

describe('<html lang> synced to the active language (#230)', () => {
  it('sets it to the resolved language as soon as the module loads', async () => {
    stubNavigatorLanguage('es-MX')
    await loadI18n()

    expect(document.documentElement.lang).toBe('es')
  })

  it('follows a later language change', async () => {
    stubNavigatorLanguage('pt-BR')
    const i18n = await loadI18n()
    expect(document.documentElement.lang).toBe('pt')

    await i18n.changeLanguage('en')

    expect(document.documentElement.lang).toBe('en')
  })
})
