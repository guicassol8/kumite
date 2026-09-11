import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearWorkspaceState, loadWorkspaceState, saveWorkspaceState } from './workspace-storage'

const fixture = {
  blocks: {
    languageVersion: 0,
    blocks: [{ type: 'math_number', id: 'fixtureNum', x: 20, y: 20, fields: { NUM: 42 } }],
  },
}

const ALUNO_1 = 'ec4f6e0e-0f4a-4b0e-9a2f-1f1f1f1f1f1f'
const ALUNO_2 = 'a1b2c3d4-0f4a-4b0e-9a2f-2f2f2f2f2f2f'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('workspace-storage', () => {
  it('round-trips a saved workspace state for a problem id', () => {
    saveWorkspaceState(ALUNO_1, 'soma-dos-pares', fixture)

    expect(loadWorkspaceState(ALUNO_1, 'soma-dos-pares')).toEqual(fixture)
  })

  it('returns undefined when nothing was saved for that problem id', () => {
    expect(loadWorkspaceState(ALUNO_1, 'soma-dos-pares')).toBeUndefined()
  })

  it('keeps saves for different problem ids independent', () => {
    saveWorkspaceState(ALUNO_1, 'soma-dos-pares', fixture)

    expect(loadWorkspaceState(ALUNO_1, 'outro-problema')).toBeUndefined()
  })

  it('removes the saved state on clear', () => {
    saveWorkspaceState(ALUNO_1, 'soma-dos-pares', fixture)

    clearWorkspaceState(ALUNO_1, 'soma-dos-pares')

    expect(loadWorkspaceState(ALUNO_1, 'soma-dos-pares')).toBeUndefined()
  })

  // The bug (#175, achado #2): the key used to be the problem id alone, so
  // the next account on the same browser opened the previous one's blocks.
  it('does not hand one user the workspace another user saved for that problem', () => {
    saveWorkspaceState(ALUNO_1, 'soma-dos-pares', fixture)

    expect(loadWorkspaceState(ALUNO_2, 'soma-dos-pares')).toBeUndefined()
  })

  it('keeps both users saves side by side, so each one gets their own back', () => {
    const outro = { blocks: { languageVersion: 0, blocks: [] } }
    saveWorkspaceState(ALUNO_1, 'soma-dos-pares', fixture)
    saveWorkspaceState(ALUNO_2, 'soma-dos-pares', outro)

    expect(loadWorkspaceState(ALUNO_1, 'soma-dos-pares')).toEqual(fixture)
    expect(loadWorkspaceState(ALUNO_2, 'soma-dos-pares')).toEqual(outro)
  })

  it('clearing one user state leaves the other one alone', () => {
    saveWorkspaceState(ALUNO_1, 'soma-dos-pares', fixture)
    saveWorkspaceState(ALUNO_2, 'soma-dos-pares', fixture)

    clearWorkspaceState(ALUNO_1, 'soma-dos-pares')

    expect(loadWorkspaceState(ALUNO_2, 'soma-dos-pares')).toEqual(fixture)
  })

  // No session, nowhere to scope a key to: persisting under some shared name
  // would put the leak right back. Reading answers "nothing saved", which is
  // the same path as an unavailable localStorage (AC5).
  it('persists nothing while there is no user in the session', () => {
    saveWorkspaceState(undefined, 'soma-dos-pares', fixture)

    expect(localStorage.length).toBe(0)
    expect(loadWorkspaceState(undefined, 'soma-dos-pares')).toBeUndefined()
  })

  it('does not throw when clearing without a user', () => {
    expect(() => clearWorkspaceState(undefined, 'soma-dos-pares')).not.toThrow()
  })

  it('swallows errors when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable')
    })

    expect(() => loadWorkspaceState(ALUNO_1, 'soma-dos-pares')).not.toThrow()
    expect(loadWorkspaceState(ALUNO_1, 'soma-dos-pares')).toBeUndefined()
  })

  it('swallows errors when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('unavailable')
    })

    expect(() => saveWorkspaceState(ALUNO_1, 'soma-dos-pares', fixture)).not.toThrow()
  })

  it('swallows errors when localStorage.removeItem throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('unavailable')
    })

    expect(() => clearWorkspaceState(ALUNO_1, 'soma-dos-pares')).not.toThrow()
  })
})
