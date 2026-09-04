import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'
import { requireOrganizer, requireUser } from '../../middlewares/auth'
import { publishRoundClosed, publishRoundExtended, publishRoundOpened } from '../sse/sse.service'

import {
  CreateRoundBodySchema,
  ExtendRoundBodySchema,
  RoundDetailSchema,
  RoundIdParamsSchema,
  RoundSummaryListSchema,
  UpdateRoundBodySchema,
} from './rounds.schema'
import {
  closeRound,
  createRound,
  extendRound,
  getRound,
  listParticipantRounds,
  listRounds,
  openRound,
  updateRound,
} from './rounds.service'

// 401 (requireUser) and 403 (requireOrganizer) are not declared on any route
// below: both short-circuit from middleware, which kata lets through without
// validating against `output` (framework ADR-0011) — same note as
// problems.route.ts / submissions.route.ts.

export const createRoundRoute = defineRoute({
  method: 'POST',
  path: '/organizer/rounds',
  use: [requireUser, requireOrganizer],
  input: { body: CreateRoundBodySchema },
  output: { 201: RoundDetailSchema, 400: ErrorBodySchema },
  handler: async (c) => {
    const result = await createRound(c.get('db'), c.input.body)
    if (!result.ok) {
      return c.error('invalid_problem_ids', 'One or more problem ids are invalid', { status: 400 })
    }
    return c.json(result.round, 201)
  },
})

export const listRoundsRoute = defineRoute({
  method: 'GET',
  path: '/organizer/rounds',
  use: [requireUser, requireOrganizer],
  input: {},
  output: RoundSummaryListSchema,
  handler: async (c) => listRounds(c.get('db')),
})

export const listParticipantRoundsRoute = defineRoute({
  method: 'GET',
  path: '/rounds',
  use: [requireUser],
  input: {},
  output: RoundSummaryListSchema,
  handler: async (c) => listParticipantRounds(c.get('db')),
})

export const getRoundRoute = defineRoute({
  method: 'GET',
  path: '/organizer/rounds/:id',
  use: [requireUser, requireOrganizer],
  input: { params: RoundIdParamsSchema },
  output: { 200: RoundDetailSchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const round = await getRound(c.get('db'), c.input.params.id)
    if (!round) return c.error('not_found', 'Round not found', { status: 404 })
    return round
  },
})

export const updateRoundRoute = defineRoute({
  method: 'PATCH',
  path: '/organizer/rounds/:id',
  use: [requireUser, requireOrganizer],
  input: { params: RoundIdParamsSchema, body: UpdateRoundBodySchema },
  output: {
    200: RoundDetailSchema,
    400: ErrorBodySchema,
    404: ErrorBodySchema,
    409: ErrorBodySchema,
  },
  handler: async (c) => {
    const result = await updateRound(c.get('db'), c.input.params.id, c.input.body)
    if (result.ok) return c.json(result.round, 200)

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'Round not found', { status: 404 })
      case 'round_not_draft':
        return c.error('round_not_draft', 'Round is no longer a draft', { status: 409 })
      case 'invalid_problem_ids':
        return c.error('invalid_problem_ids', 'One or more problem ids are invalid', {
          status: 400,
        })
    }
  },
})

export const openRoundRoute = defineRoute({
  method: 'POST',
  path: '/organizer/rounds/:id/open',
  use: [requireUser, requireOrganizer],
  input: { params: RoundIdParamsSchema },
  output: {
    200: RoundDetailSchema,
    400: ErrorBodySchema,
    404: ErrorBodySchema,
    409: ErrorBodySchema,
  },
  handler: async (c) => {
    const result = await openRound(c.get('db'), c.input.params.id)
    if (result.ok) {
      if (!result.round.closesAt) throw new Error('expected an opened round to have closesAt')
      publishRoundOpened(c.get('sseBus'), { id: result.round.id, closesAt: result.round.closesAt })
      return c.json(result.round, 200)
    }

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'Round not found', { status: 404 })
      case 'another_round_open':
        return c.error('another_round_open', 'Another round is already open', { status: 409 })
      case 'round_not_draft':
        return c.error('round_not_draft', 'Round is no longer a draft', { status: 409 })
      case 'no_problems':
        return c.error('no_problems', 'Round has no problems to open with', { status: 400 })
    }
  },
})

export const extendRoundRoute = defineRoute({
  method: 'POST',
  path: '/organizer/rounds/:id/extend',
  use: [requireUser, requireOrganizer],
  input: { params: RoundIdParamsSchema, body: ExtendRoundBodySchema },
  output: { 200: RoundDetailSchema, 404: ErrorBodySchema, 409: ErrorBodySchema },
  handler: async (c) => {
    const result = await extendRound(c.get('db'), c.input.params.id, c.input.body.minutes)
    if (result.ok) {
      if (!result.round.closesAt) throw new Error('expected an extended round to have closesAt')
      publishRoundExtended(c.get('sseBus'), {
        id: result.round.id,
        closesAt: result.round.closesAt,
      })
      return c.json(result.round, 200)
    }

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'Round not found', { status: 404 })
      case 'round_not_open':
        return c.error('round_not_open', 'Round is not open', { status: 409 })
    }
  },
})

export const closeRoundRoute = defineRoute({
  method: 'POST',
  path: '/organizer/rounds/:id/close',
  use: [requireUser, requireOrganizer],
  input: { params: RoundIdParamsSchema },
  output: { 200: RoundDetailSchema, 404: ErrorBodySchema, 409: ErrorBodySchema },
  handler: async (c) => {
    const result = await closeRound(c.get('db'), c.input.params.id)
    if (result.ok) {
      publishRoundClosed(c.get('sseBus'), { id: result.round.id })
      return c.json(result.round, 200)
    }

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'Round not found', { status: 404 })
      case 'round_not_open':
        return c.error('round_not_open', 'Round is not open', { status: 409 })
    }
  },
})
