import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { loadWorkspaceState, saveWorkspaceState } from '@/lib/workspace-storage'
import { useWorkspaceAutoSave } from './use-workspace-autosave'

const problemId = 'soma-dos-pares'

function participant(id: string): SessionUser {
  return {
    id,
    email: `${id}@edu.pucrs.br`,
    name: id,
    role: 'participant',
    university: 'pucrs',
    active: true,
    mustChangePassword: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }
}

const alunoUm = participant('aluno-1')
const alunoDois = participant('aluno-2')

const fixture = {
  blocks: {
    languageVersion: 0,
    blocks: [{ type: 'math_number', id: 'fixtureNum', x: 20, y: 20, fields: { NUM: 42 } }],
  },
}

const otherFixture = {
  blocks: {
    languageVersion: 0,
    blocks: [{ type: 'math_number', id: 'otherNum', x: 30, y: 30, fields: { NUM: 7 } }],
  },
}

beforeEach(() => {
  vi.useFakeTimers()
  setSession(alunoUm, 'tok-1')
})

afterEach(() => {
  clearSession('manual')
  localStorage.clear()
  vi.useRealTimers()
})

describe('useWorkspaceAutoSave', () => {
  it('reads the initial state once from storage', () => {
    saveWorkspaceState(alunoUm.id, problemId, fixture)

    const { result } = renderHook(() => useWorkspaceAutoSave(problemId))

    expect(result.current.initialState).toEqual(fixture)
  })

  it('starts with undefined initial state when nothing was saved', () => {
    const { result } = renderHook(() => useWorkspaceAutoSave(problemId))

    expect(result.current.initialState).toBeUndefined()
  })

  it('persists only once, 500ms after the last rapid change', () => {
    const { result } = renderHook(() => useWorkspaceAutoSave(problemId))

    act(() => {
      result.current.handleChange(fixture)
      vi.advanceTimersByTime(200)
      result.current.handleChange(fixture)
      vi.advanceTimersByTime(200)
      result.current.handleChange(fixture)
    })

    expect(loadWorkspaceState(alunoUm.id, problemId)).toBeUndefined()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(loadWorkspaceState(alunoUm.id, problemId)).toEqual(fixture)
  })

  it('cancels a pending save and removes the stored state on clearSaved', () => {
    const { result } = renderHook(() => useWorkspaceAutoSave(problemId))

    act(() => {
      result.current.handleChange(fixture)
      result.current.clearSaved()
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(loadWorkspaceState(alunoUm.id, problemId)).toBeUndefined()
  })

  // #175: the workspace belongs to whoever was signed in when it was built.
  describe('whose workspace it is (#175)', () => {
    it('saves under the signed-in user, where nobody else can read it', () => {
      const { result } = renderHook(() => useWorkspaceAutoSave(problemId))

      act(() => {
        result.current.handleChange(fixture)
        vi.advanceTimersByTime(500)
      })

      expect(loadWorkspaceState(alunoUm.id, problemId)).toEqual(fixture)
      expect(loadWorkspaceState(alunoDois.id, problemId)).toBeUndefined()
    })

    // Without the user in `savedRef`'s identity, the snapshot held in memory
    // would outlive the account switch and seed the next one's canvas — the
    // leak again, this time without touching localStorage at all.
    it('does not seed the next account with the previous one live state', () => {
      saveWorkspaceState(alunoUm.id, problemId, fixture)

      const { result, rerender } = renderHook(() => useWorkspaceAutoSave(problemId))
      expect(result.current.initialState).toEqual(fixture)

      act(() => {
        setSession(alunoDois, 'tok-2')
      })
      rerender()

      expect(result.current.initialState).toBeUndefined()
    })

    it('gives the owner their workspace back when they sign in again', () => {
      saveWorkspaceState(alunoUm.id, problemId, fixture)

      const { result, rerender } = renderHook(() => useWorkspaceAutoSave(problemId))
      act(() => {
        setSession(alunoDois, 'tok-2')
      })
      rerender()
      act(() => {
        setSession(alunoUm, 'tok-1')
      })
      rerender()

      expect(result.current.initialState).toEqual(fixture)
    })

    // Same path as an unavailable localStorage (AC5): the editor opens on the
    // problem's initial state instead of breaking the route.
    it('persists nothing and reads nothing while the session is anonymous', () => {
      act(() => {
        clearSession('manual')
      })
      saveWorkspaceState(alunoUm.id, problemId, fixture)

      const { result } = renderHook(() => useWorkspaceAutoSave(problemId))
      expect(result.current.initialState).toBeUndefined()

      act(() => {
        result.current.handleChange(otherFixture)
        vi.advanceTimersByTime(500)
      })

      expect(loadWorkspaceState(alunoUm.id, problemId)).toEqual(fixture)
    })
  })

  // #178: `initialState` is what re-seeds the editor whenever its subtree
  // remounts (a language switch used to do exactly that). Reading it once at
  // page load meant the remounted editor came back with the blocks the
  // participant had when the page opened, losing everything built since.
  describe('the state that survives a remount (#178)', () => {
    it('reports the last change as the initial state, before the debounce fires', () => {
      const { result, rerender } = renderHook(() => useWorkspaceAutoSave(problemId))

      act(() => {
        result.current.handleChange(fixture)
      })
      // A remount of the editor always rides on a render of its owner, so
      // this is the value the remounted editor would be seeded with.
      rerender()

      expect(result.current.initialState).toEqual(fixture)
    })

    it('re-reads the storage when the problem id changes', () => {
      saveWorkspaceState(alunoUm.id, 'problema-a', fixture)
      saveWorkspaceState(alunoUm.id, 'problema-b', otherFixture)

      const { result, rerender } = renderHook(({ id }) => useWorkspaceAutoSave(id), {
        initialProps: { id: 'problema-a' },
      })
      expect(result.current.initialState).toEqual(fixture)

      rerender({ id: 'problema-b' })

      expect(result.current.initialState).toEqual(otherFixture)
    })

    it('writes a pending save on unmount instead of dropping it', () => {
      const { result, unmount } = renderHook(() => useWorkspaceAutoSave(problemId))

      act(() => {
        result.current.handleChange(fixture)
      })
      expect(loadWorkspaceState(alunoUm.id, problemId)).toBeUndefined()

      unmount()

      expect(loadWorkspaceState(alunoUm.id, problemId)).toEqual(fixture)
    })

    it('flushes a pending save to the old problem when the id changes mid-debounce', () => {
      const { result, rerender } = renderHook(({ id }) => useWorkspaceAutoSave(id), {
        initialProps: { id: 'problema-a' },
      })

      act(() => {
        result.current.handleChange(fixture)
      })
      rerender({ id: 'problema-b' })

      expect(loadWorkspaceState(alunoUm.id, 'problema-a')).toEqual(fixture)
      expect(loadWorkspaceState(alunoUm.id, 'problema-b')).toBeUndefined()
    })

    it('forgets the live state on clearSaved, so a remount cannot resurrect the blocks', () => {
      const { result, rerender, unmount } = renderHook(() => useWorkspaceAutoSave(problemId))

      act(() => {
        result.current.handleChange(fixture)
        result.current.clearSaved()
      })
      rerender()

      expect(result.current.initialState).toBeUndefined()

      // The unmount flush must not bring back what Limpar just cleared.
      unmount()
      expect(loadWorkspaceState(alunoUm.id, problemId)).toBeUndefined()
    })
  })
})
