import type { WorkspaceState } from '@/components/blockly/blockly-workspace'

function storageKey(problemId: string): string {
  return `kumite:workspace:${problemId}`
}

export function loadWorkspaceState(problemId: string): WorkspaceState | undefined {
  try {
    const raw = localStorage.getItem(storageKey(problemId))
    return raw ? (JSON.parse(raw) as WorkspaceState) : undefined
  } catch {
    return undefined
  }
}

export function saveWorkspaceState(problemId: string, state: WorkspaceState): void {
  try {
    localStorage.setItem(storageKey(problemId), JSON.stringify(state))
  } catch {
    // localStorage may be unavailable (private mode, quota, disabled) — auto-save is best-effort.
  }
}

export function clearWorkspaceState(problemId: string): void {
  try {
    localStorage.removeItem(storageKey(problemId))
  } catch {
    // see saveWorkspaceState
  }
}
