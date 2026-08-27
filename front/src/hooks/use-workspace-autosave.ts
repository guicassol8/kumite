import { useCallback, useRef, useState } from 'react'

import type { WorkspaceState } from '@/components/blockly/blockly-workspace'
import {
  clearWorkspaceState,
  loadWorkspaceState,
  saveWorkspaceState,
} from '@/lib/workspace-storage'

const DEBOUNCE_MS = 500

export function useWorkspaceAutoSave(problemId: string) {
  const [initialState] = useState(() => loadWorkspaceState(problemId))
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleChange = useCallback(
    (state: WorkspaceState) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        saveWorkspaceState(problemId, state)
      }, DEBOUNCE_MS)
    },
    [problemId],
  )

  const clearSaved = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    clearWorkspaceState(problemId)
  }, [problemId])

  return { initialState, handleChange, clearSaved }
}
