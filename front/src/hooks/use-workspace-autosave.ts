import { useCallback, useEffect, useRef } from 'react'

import type { WorkspaceState } from '@/components/blockly/blockly-workspace'
import { useSession } from '@/hooks/use-session'
import {
  clearWorkspaceState,
  loadWorkspaceState,
  saveWorkspaceState,
} from '@/lib/workspace-storage'

const DEBOUNCE_MS = 500

type Snapshot = { userId: string | undefined; problemId: string; state: WorkspaceState | undefined }
type Pending = { userId: string | undefined; problemId: string; state: WorkspaceState }

/**
 * Debounced per-problem persistence for the block editor, plus the state a
 * remounted editor is re-seeded with.
 *
 * `initialState` is the live truth, not a one-off read (#178): the editor
 * subtree remounts whenever its identity changes (`key={id}`) or the screen
 * swaps it out, and a value frozen at page load would bring the canvas back to
 * what it held when the page opened — with the next auto-save then writing
 * that stale copy over the good one. Every change updates it synchronously,
 * ahead of the debounce, and changing `problemId` re-reads that problem's own
 * storage.
 */
export function useWorkspaceAutoSave(problemId: string) {
  // Everything below is scoped to whoever is signed in (#175) — the snapshot
  // kept in memory as much as the key in localStorage. Without the user in
  // `savedRef`'s identity, switching accounts in a tab that never unmounts the
  // editor would seed the next one's canvas from the previous one's blocks.
  const { user } = useSession()
  const userId = user?.id

  // Re-read during render rather than in an effect: the remount that consumes
  // `initialState` happens in the very same commit as the id change, so an
  // effect would run too late and seed the new editor with the old problem.
  const savedRef = useRef<Snapshot | null>(null)
  if (
    savedRef.current === null ||
    savedRef.current.problemId !== problemId ||
    savedRef.current.userId !== userId
  ) {
    savedRef.current = { userId, problemId, state: loadWorkspaceState(userId, problemId) }
  }
  const initialState = savedRef.current.state

  // What the debounce is holding. It carries its own problem id so a flush
  // always writes where the state came from, even when the render has already
  // moved on to another problem.
  const pendingRef = useRef<Pending | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const flush = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = undefined
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    saveWorkspaceState(pending.userId, pending.problemId, pending.state)
  }, [])

  const handleChange = useCallback(
    (state: WorkspaceState) => {
      savedRef.current = { userId, problemId, state }
      pendingRef.current = { userId, problemId, state }
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(flush, DEBOUNCE_MS)
    },
    [userId, problemId, flush],
  )

  // Runs on unmount and on every id change: leaving the screen mid-debounce
  // used to drop the last edits on the floor.
  useEffect(() => flush, [problemId, flush])

  const clearSaved = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = undefined
    pendingRef.current = null
    // Also forgets the live state, or a remount right after "Limpar blocos"
    // would put the cleared blocks straight back on the canvas.
    savedRef.current = { userId, problemId, state: undefined }
    clearWorkspaceState(userId, problemId)
  }, [userId, problemId])

  return { initialState, handleChange, clearSaved }
}
