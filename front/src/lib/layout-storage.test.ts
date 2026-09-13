import { afterEach, describe, expect, it, vi } from 'vitest'

import { layoutStorage } from './layout-storage'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('layoutStorage', () => {
  it('round-trips a value under the group key', () => {
    layoutStorage.setItem('problem-h', '{"h":1}')

    expect(layoutStorage.getItem('problem-h')).toBe('{"h":1}')
  })

  it('prefixes the key so the preference does not collide with other localStorage entries', () => {
    layoutStorage.setItem('problem-h', '{"h":1}')

    expect(localStorage.getItem('kumite:problem-layout:problem-h')).toBe('{"h":1}')
    expect(localStorage.getItem('problem-h')).toBeNull()
  })

  it('returns null when nothing was saved for that group', () => {
    expect(layoutStorage.getItem('problem-v')).toBeNull()
  })

  it('swallows errors when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable')
    })

    expect(() => layoutStorage.getItem('problem-h')).not.toThrow()
    expect(layoutStorage.getItem('problem-h')).toBeNull()
  })

  it('swallows errors when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('unavailable')
    })

    expect(() => layoutStorage.setItem('problem-h', '{"h":1}')).not.toThrow()
  })
})
