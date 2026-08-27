import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadWorkspaceState, saveWorkspaceState } from '@/lib/workspace-storage'
import { useWorkspaceAutoSave } from './use-workspace-autosave'

const problemId = 'soma-dos-pares'

const fixture = {
  blocks: {
    languageVersion: 0,
    blocks: [{ type: 'math_number', id: 'fixtureNum', x: 20, y: 20, fields: { NUM: 42 } }],
  },
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

describe('useWorkspaceAutoSave', () => {
  it('reads the initial state once from storage', () => {
    saveWorkspaceState(problemId, fixture)

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

    expect(loadWorkspaceState(problemId)).toBeUndefined()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(loadWorkspaceState(problemId)).toEqual(fixture)
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

    expect(loadWorkspaceState(problemId)).toBeUndefined()
  })
})
