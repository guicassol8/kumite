import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'

import {
  CreateProblemBodySchema,
  ProblemDetailSchema,
  ProblemIdParamsSchema,
  ProblemSummaryListSchema,
  UpdateProblemBodySchema,
} from './problems.schema'
import {
  archiveProblem,
  createProblem,
  getProblem,
  listProblems,
  publishProblem,
  updateProblem,
} from './problems.service'

export const createProblemRoute = defineRoute({
  method: 'POST',
  path: '/organizer/problems',
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
  input: {},
  output: ProblemSummaryListSchema,
  handler: async (c) => listProblems(c.get('db')),
})

export const getProblemRoute = defineRoute({
  method: 'GET',
  path: '/organizer/problems/:id',
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
  input: { params: ProblemIdParamsSchema, body: UpdateProblemBodySchema },
  output: { 200: ProblemDetailSchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const problem = await updateProblem(c.get('db'), c.input.params.id, c.input.body)
    if (!problem) return c.error('not_found', 'Problem not found', { status: 404 })
    return problem
  },
})

export const publishProblemRoute = defineRoute({
  method: 'POST',
  path: '/organizer/problems/:id/publish',
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
  input: { params: ProblemIdParamsSchema },
  output: { 200: ProblemDetailSchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const problem = await archiveProblem(c.get('db'), c.input.params.id)
    if (!problem) return c.error('not_found', 'Problem not found', { status: 404 })
    return problem
  },
})
