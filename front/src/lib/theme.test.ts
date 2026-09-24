import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setMatchMediaMatches } from '@/test/match-media-jsdom'
import { setPresentationActive } from './presentation-mode'
import {
  applyTheme,
  DARK_SCHEME_QUERY,
  readResolvedTheme,
  readTheme,
  resolveTheme,
  setTheme,
  subscribe,
  THEME_STORAGE_KEY,
  watchSystemTheme,
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
  // The matchMedia shim's registry is global: leave the OS on light for the
  // next test, whatever this one flipped it to.
  setMatchMediaMatches(DARK_SCHEME_QUERY, false)
  setPresentationActive(false)
})

describe('the theme store', () => {
  it('follows a dark OS when no choice is saved', () => {
    setMatchMediaMatches(DARK_SCHEME_QUERY, true)

    expect(readTheme()).toBe('system')
    expect(resolveTheme('system')).toBe('dark')

    applyTheme()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(themeColor()).toBe('#0e0c0b')
  })

  it('follows a light OS when no choice is saved', () => {
    setMatchMediaMatches(DARK_SCHEME_QUERY, false)

    expect(resolveTheme('system')).toBe('light')

    applyTheme()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('lets a saved light choice win over a dark OS', () => {
    setMatchMediaMatches(DARK_SCHEME_QUERY, true)
    localStorage.setItem(THEME_STORAGE_KEY, 'light')

    applyTheme()

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(readResolvedTheme()).toBe('light')
  })

  it('lets a saved dark choice win over a light OS', () => {
    setMatchMediaMatches(DARK_SCHEME_QUERY, false)
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    applyTheme()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(readResolvedTheme()).toBe('dark')
  })

  it('treats a stored value that is not a theme as system, following the OS', () => {
    setMatchMediaMatches(DARK_SCHEME_QUERY, true)
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia')

    applyTheme()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('falls back to light where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined)

    expect(resolveTheme('system')).toBe('light')

    vi.unstubAllGlobals()
  })

  it('puts the dark class on <html> when dark is the saved choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    expect(readTheme()).toBe('dark')

    applyTheme()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('falls back to system (light OS) when the stored value is not a theme', () => {
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

describe('following the OS live', () => {
  let stopWatching: () => void = () => undefined

  beforeEach(() => {
    stopWatching = watchSystemTheme()
  })

  afterEach(() => stopWatching())

  it('repaints when the OS switches and nothing is saved', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    setMatchMediaMatches(DARK_SCHEME_QUERY, true)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(themeColor()).toBe('#0e0c0b')
    expect(readResolvedTheme()).toBe('dark')
    expect(listener).toHaveBeenCalled()

    setMatchMediaMatches(DARK_SCHEME_QUERY, false)

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(themeColor()).toBe('#1c1716')
    unsubscribe()
  })

  it('leaves a saved light choice alone when the OS goes dark', () => {
    setTheme('light')

    setMatchMediaMatches(DARK_SCHEME_QUERY, true)

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(readResolvedTheme()).toBe('light')
  })

  it('does not undo the telão forced dark when the OS goes light', () => {
    setMatchMediaMatches(DARK_SCHEME_QUERY, true)
    setPresentationActive(true)
    document.documentElement.classList.add('dark')

    setMatchMediaMatches(DARK_SCHEME_QUERY, false)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('stops listening once the returned cleanup runs', () => {
    stopWatching()

    setMatchMediaMatches(DARK_SCHEME_QUERY, true)

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
