import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyTheme,
  readTheme,
  resolveTheme,
  setTheme,
  subscribe,
  THEME_STORAGE_KEY,
} from './theme'

function themeColor(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.remove()
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'theme-color')
  meta.setAttribute('content', '#1c1716')
  document.head.append(meta)
  // Also resets the in-memory fallback the storage-blocked path reads from.
  setTheme('system')
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the theme store', () => {
  it('stays light with no choice saved, even when the OS asks for dark', () => {
    // The whole point of the #214 freeze: `system` resolves to light until
    // #234 turns `prefers-color-scheme` back on, so a dark OS must not win.
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )

    expect(readTheme()).toBe('system')
    expect(resolveTheme('system')).toBe('light')

    applyTheme()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('puts the dark class on <html> when dark is the saved choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    expect(readTheme()).toBe('dark')

    applyTheme()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('falls back to light when the stored value is not a theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia')

    expect(readTheme()).toBe('system')

    applyTheme()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists the choice and notifies every subscriber', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    setTheme('dark')

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(readTheme()).toBe('dark')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    setTheme('light')

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('rewrites the theme-color meta in both directions', () => {
    setTheme('dark')
    expect(themeColor()).toBe('#0e0c0b')

    setTheme('light')
    expect(themeColor()).toBe('#1c1716')
  })

  it('survives a localStorage that throws on read', () => {
    setTheme('dark')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })

    expect(() => readTheme()).not.toThrow()
    // The write reached memory before the storage went away, so the choice
    // this tab is showing survives the blocked read.
    expect(readTheme()).toBe('dark')
  })

  it('still switches the theme when localStorage refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })

    expect(() => setTheme('dark')).not.toThrow()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
