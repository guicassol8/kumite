import { signJwt } from '@katajs-framework/core/jwt'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { app } from './app'
import { JWT_SECRET, TOKEN_TTL_SECONDS } from './config'
import { k } from './context'
import {
  problemsTable,
  problemTranslationsTable,
  roundProblemsTable,
  roundsTable,
  submissionsTable,
  teamMembersTable,
  teamsTable,
  usersTable,
} from './db/schema'

// Cross-module HTTP suite (#94): every id field a client can send must be
// rejected at the edge as a 422, never reach Postgres and come back as a
// generic 500. Lives at src/ root per the kata layout doc's "cross-module and
// process-level test suites" rule, same as auth-guards.test.ts.
const db = k.resolve('db')

const MALFORMED = 'nao-e-uuid'
const NIL_ID = '00000000-0000-0000-0000-000000000000'

beforeEach(async () => {
  await db.execute(
    sql`truncate table ${submissionsTable}, ${roundProblemsTable}, ${roundsTable}, ${teamMembersTable}, ${teamsTable}, ${problemTranslationsTable}, ${problemsTable}, ${usersTable} restart identity cascade`,
  )
})

afterAll(async () => {
  await db.$client.end()
})

async function insertUser(role: 'participant' | 'organizer') {
  const [user] = await db
    .insert(usersTable)
    .values({
      email: `${role}-${crypto.randomUUID()}@example.com`,
      passwordHash: 'hash',
      role,
      university: 'pucrs',
    })
    .returning()
  if (!user) throw new Error('expected user to be inserted')
  return signJwt(
    { role: user.role, university: user.university },
    { secret: JWT_SECRET, subject: user.id, expiresInSeconds: TOKEN_TTL_SECONDS },
  )
}

type Call = { method: string; path: string; body?: unknown }

// Every route that takes a uuid is behind `requireUser` — the public surface
// (src/app.test.ts) has no id-bearing route at all — so every probe carries a
// token. The participant is deliberately left teamless: joinTeam checks
// `already_in_team` before it looks the team up, so a participant with a team
// would answer 409 and hide the 404 these probes are pinning down.
type Auth = 'participant' | 'organizer'

type Probe = {
  module: string
  field: string
  auth: Auth
  // The same request twice: once with a malformed id (must be a 422 from the
  // input schema) and once with the nil uuid, which is well-formed but matches
  // no row — that one must still reach the handler and get its real answer.
  malformed: Call
  wellFormed: Call
  // Where the input sits in kata's 422 envelope: `params`, `body` or `query`.
  issuesIn: 'params' | 'body' | 'query'
  // What the handler answers for the nil uuid. Mostly 404 not_found; the
  // exceptions are real and documented per probe instead of smoothed over.
  wellFormedStatus: number
  wellFormedError?: string
}

const ROUND_BODY = { name: 'Rodada 1', durationMinutes: 30 }

const probes: Probe[] = [
  {
    module: 'problems',
    field: 'ProblemIdParamsSchema.id (GET)',
    auth: 'organizer',
    malformed: { method: 'GET', path: `/organizer/problems/${MALFORMED}` },
    wellFormed: { method: 'GET', path: `/organizer/problems/${NIL_ID}` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'problems',
    field: 'ProblemIdParamsSchema.id (PATCH)',
    auth: 'organizer',
    malformed: { method: 'PATCH', path: `/organizer/problems/${MALFORMED}`, body: {} },
    wellFormed: { method: 'PATCH', path: `/organizer/problems/${NIL_ID}`, body: {} },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'problems',
    field: 'ProblemIdParamsSchema.id (publish)',
    auth: 'organizer',
    malformed: { method: 'POST', path: `/organizer/problems/${MALFORMED}/publish` },
    wellFormed: { method: 'POST', path: `/organizer/problems/${NIL_ID}/publish` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'problems',
    field: 'ProblemIdParamsSchema.id (archive)',
    auth: 'organizer',
    malformed: { method: 'POST', path: `/organizer/problems/${MALFORMED}/archive` },
    wellFormed: { method: 'POST', path: `/organizer/problems/${NIL_ID}/archive` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'problems',
    field: 'ParticipantProblemParamsSchema.id (regression lock)',
    auth: 'participant',
    malformed: { method: 'GET', path: `/problems/${MALFORMED}` },
    wellFormed: { method: 'GET', path: `/problems/${NIL_ID}` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'ranking',
    field: 'RoundRankingParamsSchema.id',
    auth: 'participant',
    malformed: { method: 'GET', path: `/rounds/${MALFORMED}/ranking` },
    wellFormed: { method: 'GET', path: `/rounds/${NIL_ID}/ranking` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'rounds',
    field: 'RoundIdParamsSchema.id (participant GET)',
    auth: 'participant',
    malformed: { method: 'GET', path: `/rounds/${MALFORMED}` },
    wellFormed: { method: 'GET', path: `/rounds/${NIL_ID}` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'rounds',
    field: 'RoundIdParamsSchema.id (organizer GET)',
    auth: 'organizer',
    malformed: { method: 'GET', path: `/organizer/rounds/${MALFORMED}` },
    wellFormed: { method: 'GET', path: `/organizer/rounds/${NIL_ID}` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'rounds',
    field: 'RoundIdParamsSchema.id (PATCH)',
    auth: 'organizer',
    malformed: { method: 'PATCH', path: `/organizer/rounds/${MALFORMED}`, body: {} },
    wellFormed: { method: 'PATCH', path: `/organizer/rounds/${NIL_ID}`, body: {} },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'rounds',
    field: 'RoundIdParamsSchema.id (open)',
    auth: 'organizer',
    malformed: { method: 'POST', path: `/organizer/rounds/${MALFORMED}/open` },
    wellFormed: { method: 'POST', path: `/organizer/rounds/${NIL_ID}/open` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'rounds',
    field: 'RoundIdParamsSchema.id (extend)',
    auth: 'organizer',
    malformed: {
      method: 'POST',
      path: `/organizer/rounds/${MALFORMED}/extend`,
      body: { minutes: 5 },
    },
    wellFormed: {
      method: 'POST',
      path: `/organizer/rounds/${NIL_ID}/extend`,
      body: { minutes: 5 },
    },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'rounds',
    field: 'RoundIdParamsSchema.id (close)',
    auth: 'organizer',
    malformed: { method: 'POST', path: `/organizer/rounds/${MALFORMED}/close` },
    wellFormed: { method: 'POST', path: `/organizer/rounds/${NIL_ID}/close` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'rounds',
    field: 'CreateRoundBodySchema.problemIds[]',
    auth: 'organizer',
    malformed: {
      method: 'POST',
      path: '/organizer/rounds',
      body: { ...ROUND_BODY, problemIds: [MALFORMED] },
    },
    wellFormed: {
      method: 'POST',
      path: '/organizer/rounds',
      body: { ...ROUND_BODY, problemIds: [NIL_ID] },
    },
    issuesIn: 'body',
    // createRound has no round to miss — it rejects the unknown problem id
    // with its own 400, which is the answer this route always gave.
    wellFormedStatus: 400,
    wellFormedError: 'invalid_problem_ids',
  },
  {
    module: 'rounds',
    field: 'UpdateRoundBodySchema.problemIds[]',
    auth: 'organizer',
    malformed: {
      method: 'PATCH',
      path: `/organizer/rounds/${NIL_ID}`,
      body: { problemIds: [MALFORMED] },
    },
    wellFormed: {
      method: 'PATCH',
      path: `/organizer/rounds/${NIL_ID}`,
      body: { problemIds: [NIL_ID] },
    },
    issuesIn: 'body',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'teams',
    field: 'JoinTeamParamsSchema.id',
    auth: 'participant',
    malformed: { method: 'POST', path: `/teams/${MALFORMED}/join` },
    wellFormed: { method: 'POST', path: `/teams/${NIL_ID}/join` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'teams',
    field: 'RenameTeamParamsSchema.id',
    auth: 'organizer',
    malformed: { method: 'PATCH', path: `/organizer/teams/${MALFORMED}`, body: { name: 'Nome' } },
    wellFormed: { method: 'PATCH', path: `/organizer/teams/${NIL_ID}`, body: { name: 'Nome' } },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'teams',
    field: 'MoveMemberParamsSchema.userId',
    auth: 'organizer',
    malformed: {
      method: 'POST',
      path: `/organizer/teams/members/${MALFORMED}/move`,
      body: { teamId: NIL_ID },
    },
    wellFormed: {
      method: 'POST',
      path: `/organizer/teams/members/${NIL_ID}/move`,
      body: { teamId: NIL_ID },
    },
    issuesIn: 'params',
    // moveMember looks the membership up first, so a user who is in no team
    // answers member_not_found before the destination team is ever checked.
    wellFormedStatus: 404,
    wellFormedError: 'member_not_found',
  },
  {
    module: 'teams',
    field: 'MoveMemberBodySchema.teamId',
    auth: 'organizer',
    malformed: {
      method: 'POST',
      path: `/organizer/teams/members/${NIL_ID}/move`,
      body: { teamId: MALFORMED },
    },
    wellFormed: {
      method: 'POST',
      path: `/organizer/teams/members/${NIL_ID}/move`,
      body: { teamId: NIL_ID },
    },
    issuesIn: 'body',
    wellFormedStatus: 404,
    wellFormedError: 'member_not_found',
  },
  {
    module: 'teams',
    field: 'RemoveMemberParamsSchema.userId',
    auth: 'organizer',
    malformed: { method: 'DELETE', path: `/organizer/teams/members/${MALFORMED}` },
    wellFormed: { method: 'DELETE', path: `/organizer/teams/members/${NIL_ID}` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'teams',
    field: 'RemoveTeamParamsSchema.id',
    auth: 'organizer',
    malformed: { method: 'DELETE', path: `/organizer/teams/${MALFORMED}` },
    wellFormed: { method: 'DELETE', path: `/organizer/teams/${NIL_ID}` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'users',
    field: 'UserIdParamsSchema.id (promote)',
    auth: 'organizer',
    malformed: { method: 'POST', path: `/organizer/users/${MALFORMED}/promote` },
    wellFormed: { method: 'POST', path: `/organizer/users/${NIL_ID}/promote` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'users',
    field: 'UserIdParamsSchema.id (demote)',
    auth: 'organizer',
    malformed: { method: 'POST', path: `/organizer/users/${MALFORMED}/demote` },
    wellFormed: { method: 'POST', path: `/organizer/users/${NIL_ID}/demote` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'users',
    field: 'UserIdParamsSchema.id (deactivate)',
    auth: 'organizer',
    malformed: { method: 'POST', path: `/organizer/users/${MALFORMED}/deactivate` },
    wellFormed: { method: 'POST', path: `/organizer/users/${NIL_ID}/deactivate` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'users',
    field: 'UserIdParamsSchema.id (reactivate)',
    auth: 'organizer',
    malformed: { method: 'POST', path: `/organizer/users/${MALFORMED}/reactivate` },
    wellFormed: { method: 'POST', path: `/organizer/users/${NIL_ID}/reactivate` },
    issuesIn: 'params',
    wellFormedStatus: 404,
    wellFormedError: 'not_found',
  },
  {
    module: 'users',
    field: 'ListUsersQuerySchema.teamId',
    auth: 'organizer',
    malformed: { method: 'GET', path: `/organizer/users?teamId=${MALFORMED}` },
    wellFormed: { method: 'GET', path: `/organizer/users?teamId=${NIL_ID}` },
    issuesIn: 'query',
    // A filter, not a lookup: an unknown team is an empty page, never a 404.
    wellFormedStatus: 200,
  },
  {
    module: 'submissions',
    field: 'SubmitSolutionBodySchema.problemId (regression lock)',
    auth: 'participant',
    malformed: {
      method: 'POST',
      path: '/submissions',
      body: { problemId: MALFORMED, roundId: NIL_ID, workspace: { blocks: [] } },
    },
    wellFormed: {
      method: 'POST',
      path: '/submissions',
      body: { problemId: NIL_ID, roundId: NIL_ID, workspace: { blocks: [] } },
    },
    issuesIn: 'body',
    // The route checks team membership before it reads the body's ids, and
    // this fixture's participant is teamless on purpose.
    wellFormedStatus: 404,
    wellFormedError: 'not_in_team',
  },
  {
    module: 'submissions',
    field: 'SubmitSolutionBodySchema.roundId (regression lock)',
    auth: 'participant',
    malformed: {
      method: 'POST',
      path: '/submissions',
      body: { problemId: NIL_ID, roundId: MALFORMED, workspace: { blocks: [] } },
    },
    wellFormed: {
      method: 'POST',
      path: '/submissions',
      body: { problemId: NIL_ID, roundId: NIL_ID, workspace: { blocks: [] } },
    },
    issuesIn: 'body',
    wellFormedStatus: 404,
    wellFormedError: 'not_in_team',
  },
]

async function request(call: Call, token?: string) {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (call.body !== undefined) headers['Content-Type'] = 'application/json'
  return app.request(call.path, {
    method: call.method,
    headers,
    body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
  })
}

// kata's 422 envelope, narrowed instead of cast: `res.json()` is `unknown`
// and `any` is banned (back/AGENTS.md).
const ValidationFailedSchema = z.object({
  error: z.string(),
  issues: z.record(z.string(), z.unknown()),
})

async function tokenFor(auth: Auth) {
  return insertUser(auth)
}

describe('uuid input validation', () => {
  it.each(probes)(
    '$module: $field — malformed id -> 422 validation_failed',
    async ({ auth, malformed, issuesIn }) => {
      const res = await request(malformed, await tokenFor(auth))

      expect(res.status).toBe(422)
      const body = ValidationFailedSchema.parse(await res.json())
      expect(body.error).toBe('validation_failed')
      // Not just "a 422": the issue has to be on the id field's own surface,
      // so a body-shape mistake in a probe can't pass for an id rejection.
      expect(body.issues[issuesIn]).toBeDefined()
    },
  )

  it.each(probes)(
    '$module: $field — well-formed but unknown id -> the handler answers',
    async ({ auth, wellFormed, wellFormedStatus, wellFormedError }) => {
      const res = await request(wellFormed, await tokenFor(auth))

      expect(res.status).toBe(wellFormedStatus)
      if (wellFormedError) expect(await res.json()).toMatchObject({ error: wellFormedError })
    },
  )
})
