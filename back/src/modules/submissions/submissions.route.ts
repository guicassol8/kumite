import { bodyLimit, ErrorBodySchema } from '@katajs-framework/core'

import { SUBMISSION_MAX_BODY_BYTES } from '../../config'
import { defineRoute } from '../../context'
import { requirePasswordUpToDate, requireUser } from '../../middlewares/auth'

import { markRankingDirty } from '../sse/sse.service'

import { SubmissionResultSchema, SubmitSolutionBodySchema } from './submissions.schema'
import { findTeamIdForUser, submitSolution } from './submissions.service'

function throttleMessage(reason: 'in_flight' | 'cooldown', retryAfterMs: number): string {
  return reason === 'in_flight'
    ? 'A submission from this identity is still running'
    : `Wait ${Math.ceil(retryAfterMs / 1000)}s before submitting again`
}

// 413 (bodyLimit) and 401 (requireUser) are not declared: both short-circuit
// from middleware, which kata lets through without validating against
// `output` (framework ADR-0011).
export const createSubmissionRoute = defineRoute({
  method: 'POST',
  path: '/submissions',
  use: [bodyLimit({ maxSize: SUBMISSION_MAX_BODY_BYTES }), requireUser, requirePasswordUpToDate],
  input: { body: SubmitSolutionBodySchema },
  output: {
    201: SubmissionResultSchema,
    400: ErrorBodySchema,
    404: ErrorBodySchema,
    423: ErrorBodySchema,
    429: ErrorBodySchema,
  },
  handler: async (c) => {
    const db = c.get('db')
    const userId = c.get('currentUser').id
    const teamId = await findTeamIdForUser(db, userId)
    if (teamId === null) {
      return c.error('not_in_team', 'Join a team before submitting', { status: 404 })
    }

    const outcome = await submitSolution(db, { userId, teamId }, c.input.body)
    if (outcome.ok) {
      // Every accepted submission increments the team's attempts for this
      // problem, which feeds the leaderboard's tie-break order (score → time
      // → attempts) even when it doesn't beat the team's best score — so
      // every one of them can move the placar, not only a new best (#44).
      markRankingDirty()
      return c.json(outcome.result, 201)
    }

    switch (outcome.error) {
      case 'problem_not_found':
        // Same answer for "does not exist" and "not published": a draft never
        // announces itself.
        return c.error('not_found', 'Problem not found', { status: 404 })
      case 'no_active_round':
        return c.error('no_active_round', 'No active round with this problem', { status: 404 })
      case 'practice_not_submittable':
        // #209: a practice problem is run in the browser, never judged.
        return c.error('practice_not_submittable', 'Practice problems cannot be submitted', {
          status: 400,
        })
      case 'codegen_rejected':
        // The code and the message come straight from @kumite/blocks, already
        // localized — the route coins neither.
        return c.error(outcome.code, outcome.message, { status: 400 })
      case 'submissions_paused':
        // 423 Locked: the resource is fine, the organizer has it on hold
        // (#285). The round and its timer keep going.
        return c.error('submissions_paused', 'Submissions are paused by the organizer', {
          status: 423,
        })
      case 'not_in_team':
        // #353: the author left (or was moved out of) the team while the
        // submission was judged, so it was discarded. Same code and status as
        // the teamless check above — the front already maps any submit 404 to
        // its race banner.
        return c.error('not_in_team', 'You are no longer a member of this team', {
          status: 404,
        })
      case 'throttled':
        return c.error(
          'submission_throttled',
          throttleMessage(outcome.reason, outcome.retryAfterMs),
          { status: 429 },
        )
    }
  },
})
