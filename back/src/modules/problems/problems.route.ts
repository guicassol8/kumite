import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'
import { requireOrganizer, requirePasswordUpToDate, requireUser } from '../../middlewares/auth'

import {
  CreateProblemBodySchema,
  ParticipantProblemParamsSchema,
  ParticipantProblemQuerySchema,
  ParticipantProblemSchema,
  PracticeProblemListQuerySchema,
  PracticeProblemListSchema,
  ProblemDetailSchema,
  ProblemIdParamsSchema,
  ProblemSummaryListSchema,
  UpdateProblemBodySchema,
} from './problems.schema'
import {
  archiveProblem,
  createProblem,
  getProblem,
  getPublishedProblem,
  listPracticeProblems,
  listProblems,
  publishProblem,
  updateProblem,
} from './problems.service'

// 401 (requireUser) and 403 (requireOrganizer) are not declared on any route
// below: both short-circuit from middleware, which kata lets through without
// validating against `output` (framework ADR-0011) — same note as
// submissions.route.ts.

export const createProblemRoute = defineRoute({
  method: 'POST',
  path: '/organizer/problems',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { body: CreateProblemBodySchema },
  output: { 201: ProblemDetailSchema },
  handler: async (c) => {
    const problem = await createProblem(c.get('db'), c.input.body)
    return c.json(problem, 201)
  },
})

export const listProblemsRoute = defineRoute({
  method: 'GET',
  path: '/organizer/problems',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: {},
  output: ProblemSummaryListSchema,
  handler: async (c) => listProblems(c.get('db')),
})

export const getProblemRoute = defineRoute({
  method: 'GET',
  path: '/organizer/problems/:id',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { params: ProblemIdParamsSchema },
  output: { 200: ProblemDetailSchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const problem = await getProblem(c.get('db'), c.input.params.id)
    if (!problem) return c.error('not_found', 'Problem not found', { status: 404 })
    return problem
  },
})

export const updateProblemRoute = defineRoute({
  method: 'PATCH',
  path: '/organizer/problems/:id',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { params: ProblemIdParamsSchema, body: UpdateProblemBodySchema },
  output: {
    200: ProblemDetailSchema,
    400: ErrorBodySchema,
    404: ErrorBodySchema,
    409: ErrorBodySchema,
  },
  handler: async (c) => {
    const result = await updateProblem(c.get('db'), c.input.params.id, c.input.body)
    if (result.ok) return c.json(result.problem, 200)

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'Problem not found', { status: 404 })
      case 'problem_in_open_round':
        return c.error(
          'problem_in_open_round',
          `Cannot change ${result.fields.join(' and ')} while the problem is in an open round`,
          { status: 409 },
        )
      case 'problem_in_round':
        return c.error(
          'problem_in_round',
          'Cannot make a problem practice once it has been in a round',
          { status: 409 },
        )
      case 'missing_test_cases':
        return c.error('missing_test_cases', reasonMessage(result.reason), { status: 400 })
    }
  },
})

export const publishProblemRoute = defineRoute({
  method: 'POST',
  path: '/organizer/problems/:id/publish',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { params: ProblemIdParamsSchema },
  output: {
    200: ProblemDetailSchema,
    400: ErrorBodySchema,
    404: ErrorBodySchema,
    409: ErrorBodySchema,
  },
  handler: async (c) => {
    const result = await publishProblem(c.get('db'), c.input.params.id)
    if (result.ok) return c.json(result.problem, 200)

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'Problem not found', { status: 404 })
      case 'archived_problem':
        return c.error('archived_problem', 'Cannot publish an archived problem', { status: 409 })
      case 'incomplete_translations':
        return c.error(
          'incomplete_translations',
          `Missing translations for locale(s): ${result.missingLocales.join(', ')}`,
          { status: 400 },
        )
      case 'missing_test_cases':
        return c.error('missing_test_cases', reasonMessage(result.reason), { status: 400 })
    }
  },
})

function reasonMessage(reason: 'missing_visible' | 'missing_hidden' | 'missing_both'): string {
  switch (reason) {
    case 'missing_visible':
      return 'At least one visible test case is required'
    case 'missing_hidden':
      return 'At least one hidden test case is required'
    case 'missing_both':
      return 'At least one visible and one hidden test case are required'
  }
}

export const archiveProblemRoute = defineRoute({
  method: 'POST',
  path: '/organizer/problems/:id/archive',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { params: ProblemIdParamsSchema },
  output: { 200: ProblemDetailSchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const problem = await archiveProblem(c.get('db'), c.input.params.id)
    if (!problem) return c.error('not_found', 'Problem not found', { status: 404 })
    return problem
  },
})

// The participant read (#11). No /organizer prefix: the participant is the
// default audience of this API. Anything not published — draft, archived,
// unknown id — is a plain 404, so an unpublished problem is indistinguishable
// from one that does not exist.
export const getParticipantProblemRoute = defineRoute({
  method: 'GET',
  path: '/problems/:id',
  use: [requireUser, requirePasswordUpToDate],
  input: { params: ParticipantProblemParamsSchema, query: ParticipantProblemQuerySchema },
  output: { 200: ParticipantProblemSchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const problem = await getPublishedProblem(
      c.get('db'),
      c.input.params.id,
      c.input.query.locale,
      c.get('currentUser').id,
    )
    if (!problem) return c.error('not_found', 'Problem not found', { status: 404 })
    return problem
  },
})

// The practice catalog (#209). Any authenticated participant, team or not:
// practice lives outside the competition, so nothing here asks for one.
export const listPracticeProblemsRoute = defineRoute({
  method: 'GET',
  path: '/practice/problems',
  use: [requireUser, requirePasswordUpToDate],
  input: { query: PracticeProblemListQuerySchema },
  output: PracticeProblemListSchema,
  handler: async (c) => listPracticeProblems(c.get('db'), c.input.query.locale),
})
