import { BUG_REPORT_COOLDOWN_MS } from '../../config'
import { sendBugReportNotice } from '../notifications/notifications.service'

import type { CreateBugReportBody } from './bug-reports.schema'

// --- Anti-abuse: one accepted report per IP per window (#145) ---
//
// Process-local, exactly like the submission cooldown (src/modules/submissions):
// a single API process is what this event runs, and nothing here is worth a
// table. Restarting the API clears every window — documented in .env.example
// and in the hurl file, because it changes how the suite is re-run.
//
// This is deliberately local to the module rather than shared middleware: the
// generic rate-limit infrastructure is #142's problem, not this route's.
const cooldownUntil = new Map<string, number>()

export type BugReportResult =
  | { ok: true }
  | { ok: false; error: 'throttled' }
  | { ok: false; error: 'send_failed' }

/**
 * Claims the IP's slot, arming its window. `true` when the report may go
 * through, `false` when the previous one is still inside the cooldown.
 *
 * `now` is injectable so the tests stay deterministic without fake timers.
 */
export function acquireBugReportSlot(ip: string, now = Date.now()): boolean {
  const until = cooldownUntil.get(ip)
  if (until !== undefined && until > now) return false

  cooldownUntil.set(ip, now + BUG_REPORT_COOLDOWN_MS)
  return true
}

/** Hands the window back — the send failed, so the report never happened. */
export function releaseBugReportSlot(ip: string): void {
  cooldownUntil.delete(ip)
}

/** Test seam: clears the windows between cases. Never used in production. */
export function resetBugReportThrottle(): void {
  cooldownUntil.clear()
}

/**
 * Delivers one bug report to the Liga's inbox.
 *
 * The send is awaited rather than fired and forgotten: nothing is persisted,
 * so a swallowed failure would mean the report simply vanished while the
 * participant was told it arrived. A failure gives the IP its window back —
 * the retry is the whole point.
 */
export async function submitBugReport(
  input: CreateBugReportBody,
  ip: string,
  now = Date.now(),
): Promise<BugReportResult> {
  if (!acquireBugReportSlot(ip, now)) return { ok: false, error: 'throttled' }

  try {
    await sendBugReportNotice({ ...input, ip })
    return { ok: true }
  } catch (error) {
    console.error('[bug-reports] failed to send bug report', error)
    releaseBugReportSlot(ip)
    return { ok: false, error: 'send_failed' }
  }
}
