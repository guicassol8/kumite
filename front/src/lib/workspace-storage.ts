import type { WorkspaceState } from '@/components/blockly/blockly-workspace'

// The key carries the user id (#175): keyed by problem alone, one account's
// canvas opened on the next account's screen — same browser, different person.
// The scope is what fixes it, not a wipe on logout: the owner has to find the
// blocks again after logging back in (AC4), and the paths that never reach the
// logout button at all — an expired token, a closed tab, a crash — leak just
// the same.
function storageKey(userId: string, problemId: string): string {
  return `kumite:workspace:${userId}:${problemId}`
}

export function loadWorkspaceState(
  userId: string | undefined,
  problemId: string,
): WorkspaceState | undefined {
  // No session, no owner to read for. Answering "nothing saved" lands the
  // editor on the problem's initial state, which is where an unreadable
  // localStorage lands it too (AC5).
  if (!userId) return undefined
  try {
    const raw = localStorage.getItem(storageKey(userId, problemId))
    return raw ? (JSON.parse(raw) as WorkspaceState) : undefined
  } catch {
    return undefined
  }
}

export function saveWorkspaceState(
  userId: string | undefined,
  problemId: string,
  state: WorkspaceState,
): void {
  // Without a user there is no key that belongs to anyone: writing under some
  // shared name is exactly the leak this module just stopped having.
  if (!userId) return
  try {
    localStorage.setItem(storageKey(userId, problemId), JSON.stringify(state))
  } catch {
    // localStorage may be unavailable (private mode, quota, disabled) — auto-save is best-effort.
  }
}

export function clearWorkspaceState(userId: string | undefined, problemId: string): void {
  if (!userId) return
  try {
    localStorage.removeItem(storageKey(userId, problemId))
  } catch {
    // see saveWorkspaceState
  }
}
