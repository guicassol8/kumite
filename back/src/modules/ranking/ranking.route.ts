import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'
import { requirePasswordUpToDate, requireUser } from '../../middlewares/auth'

import { EventRankingSchema, RoundRankingParamsSchema, RoundRankingSchema } from './ranking.schema'
import { getEventRanking, getRoundRanking } from './ranking.service'

// requireUser only, no requireOrganizer: the leaderboard is live for every
// participant, not organizer-gated (epic #42). 401 short-circuits before
// output validation runs (kata ADR-0011), same as every other guarded route
// in this codebase — not declared here.

export const getRoundRankingRoute = defineRoute({
  method: 'GET',
  path: '/rounds/:id/ranking',
  use: [requireUser, requirePasswordUpToDate],
  input: { params: RoundRankingParamsSchema },
  output: { 200: RoundRankingSchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const ranking = await getRoundRanking(c.get('db'), c.input.params.id)
    if (!ranking) return c.error('not_found', 'Round not found', { status: 404 })
    return c.json(ranking, 200)
  },
})

export const getEventRankingRoute = defineRoute({
  method: 'GET',
  path: '/ranking',
  use: [requireUser, requirePasswordUpToDate],
  input: {},
  output: EventRankingSchema,
  handler: async (c) => getEventRanking(c.get('db')),
})
