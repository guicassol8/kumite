import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearWorkspaceState, loadWorkspaceState, saveWorkspaceState } from './workspace-storage'

const fixture = {
  blocks: {
    languageVersion: 0,
    blocks: [{ type: 'math_number', id: 'fixtureNum', x: 20, y: 20, fields: { NUM: 42 } }],
  },
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('workspace-storage', () => {
  it('round-trips a saved workspace state for a problem id', () => {
    saveWorkspaceState('soma-dos-pares', fixture)

    expect(loadWorkspaceState('soma-dos-pares')).toEqual(fixture)
  })

  it('returns undefined when nothing was saved for that problem id', () => {
    expect(loadWorkspaceState('soma-dos-pares')).toBeUndefined()
  })

  it('keeps saves for different problem ids independent', () => {
    saveWorkspaceState('soma-dos-pares', fixture)

    expect(loadWorkspaceState('outro-problema')).toBeUndefined()
  })

  it('removes the saved state on clear', () => {
    saveWorkspaceState('soma-dos-pares', fixture)

    clearWorkspaceState('soma-dos-pares')

    expect(loadWorkspaceState('soma-dos-pares')).toBeUndefined()
  })

  it('swallows errors when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable')
    })

    expect(() => loadWorkspaceState('soma-dos-pares')).not.toThrow()
    expect(loadWorkspaceState('soma-dos-pares')).toBeUndefined()
  })

  it('swallows errors when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('unavailable')
    })

    expect(() => saveWorkspaceState('soma-dos-pares', fixture)).not.toThrow()
  })

  it('swallows errors when localStorage.removeItem throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('unavailable')
    })

    expect(() => clearWorkspaceState('soma-dos-pares')).not.toThrow()
  })
})
