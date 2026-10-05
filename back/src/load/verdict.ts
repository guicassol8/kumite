import type { SubmissionResult } from '../modules/submissions/submissions.schema'

// What the harness sends (#136): the correct solution, or an infinite loop
// that must come back as a timeout. #137 adds a memory bomb.
export type SubmissionKind = 'correct' | 'loop'

export const SUBMISSION_KINDS: readonly SubmissionKind[] = ['correct', 'loop']

export type Verdict =
  | 'accepted'
  | 'wrong_answer'
  | 'timeout'
  | 'runtime_error'
  // A non-201, non-429 answer to POST /submissions, keyed by its error code.
  | `rejected:${string}`

const EXPECTED: Record<SubmissionKind, Verdict> = {
  correct: 'accepted',
  loop: 'timeout',
}

/**
 * One verdict for a judged submission, from its cases. Precedence: timeout
 * over runtime_error over failed — a submission whose loop timed out on one
 * case is a timeout, whatever the other cases did. Accepted needs at least
 * one case and every case passed.
 */
export function classifyVerdict(result: Pick<SubmissionResult, 'cases'>): Verdict {
  const outcomes = new Set(result.cases.map((c) => c.outcome))
  if (outcomes.has('timeout')) return 'timeout'
  if (outcomes.has('runtime_error')) return 'runtime_error'
  if (outcomes.has('failed') || outcomes.size === 0) return 'wrong_answer'
  return 'accepted'
}

export function rejectedVerdict(code: string): Verdict {
  return `rejected:${code}`
}

/** Whether the verdict is the one the submitted kind must produce. */
export function isCoherent(kind: SubmissionKind, verdict: Verdict): boolean {
  return EXPECTED[kind] === verdict
}
