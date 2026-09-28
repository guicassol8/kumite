import { readFileSync } from 'node:fs'

import { signJwt } from '@katajs-framework/core/jwt'
import { somaDosPares } from '@kumite/blocks'
import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../../app'
import { JWT_SECRET, SUBMISSION_COOLDOWN_MS, TOKEN_TTL_SECONDS } from '../../config'
import { k } from '../../context'
import { createDb } from '../../db/client'
import {
  eventConfigTable,
  problemsTable,
  problemTranslationsTable,
  roundProblemsTable,
  roundsTable,
  submissionsTable,
  teamMembersTable,
  teamsTable,
  usersTable,
} from '../../db/schema'

import { getEventConfig, updateEventConfig } from '../event-config/event-config.service'
import type { JudgeCaseResult } from '../judge/judge.schema'
import { WorkspaceSchema } from '../judge/judge.schema'
import type { TestCase } from '../problems/problems.schema'
import { getEventRanking, getRoundRanking } from '../ranking/ranking.service'
import { closeRound, createRound, openRound } from '../rounds/rounds.service'
import { runRankingTick } from '../sse/sse.service'
import { createTeam, leaveTeam, moveMember } from '../teams/teams.service'

import { SubmitSolutionBodySchema } from './submissions.schema'
import {
  acquireSubmissionSlot,
  findTeamIdForUser,
  getBestSubmission,
  getSubmissionLoad,
  hasJudgingInFlight,
  recordAcceptedSubmission,
  releaseSubmissionSlot,
  resetSubmissionThrottle,
  type SubmitOutcome,
  scoreSubmission,
  submitSolution,
  toPersistedCaseResults,
  toResponseCases,
} from './submissions.service'

// #176: the judge is the window during which the round can close underneath a
// submission that was already accepted. Wrapping the real runJudge (rather
// than replacing it) keeps every other test on the real sandbox; only a test
// that installs `onJudged` sees anything different, and what it installs runs
// *after* the sandbox and *before* the INSERT — the exact race, with no sleep
// and no clock control.
const judgeRace = vi.hoisted(() => ({ onJudged: null as null | (() => Promise<void>) }))

vi.mock('../judge/judge.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../judge/judge.service')>()
  return {
    ...actual,
    runJudge: async (...args: Parameters<typeof actual.runJudge>) => {
      const results = await actual.runJudge(...args)
      if (judgeRace.onJudged) await judgeRace.onJudged()
      return results
    },
  }
})

// Runs against the real dockerized Postgres (docker compose up -d) — the
// #35 migrations must already be applied.
const db = createDb()

beforeEach(async () => {
  judgeRace.onJudged = null
  await db.execute(
    sql`truncate table ${submissionsTable}, ${roundProblemsTable}, ${roundsTable}, ${problemTranslationsTable}, ${problemsTable}, ${teamMembersTable}, ${teamsTable}, ${usersTable} restart identity cascade`,
  )
})

afterAll(async () => {
  await db.$client.end()
})

// Every submission carries the round it was accepted into (#176), so even a
// fixture that only cares about the row itself needs one. Closed, not open:
// some tests below call this twice and rounds_single_open_idx allows a single
// open round.
async function insertProblem() {
  const [problem] = await db
    .insert(problemsTable)
    .values({ difficulty: 'easy', status: 'published' })
    .returning()
  if (!problem) throw new Error('expected a problem fixture')
  const [round] = await db
    .insert(roundsTable)
    .values({
      name: 'Rodada fixture',
      durationMinutes: 30,
      status: 'closed',
      openedAt: new Date('2026-08-31T10:00:00.000Z'),
      closedAt: new Date('2026-08-31T14:00:00.000Z'),
    })
    .returning()
  if (!round) throw new Error('expected a round fixture')
  await db
    .insert(roundProblemsTable)
    .values({ roundId: round.id, problemId: problem.id, position: 0 })
  return { ...problem, roundId: round.id }
}

async function insertTeam(name = 'Time A') {
  const [team] = await db.insert(teamsTable).values({ name }).returning()
  if (!team) throw new Error('expected a team fixture')
  return team
}

async function insertUser(email = 'participante@edu.pucrs.br') {
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash: 'hash', role: 'participant', university: 'pucrs' })
    .returning()
  if (!user) throw new Error('expected a user fixture')
  return user
}

describe('SubmitSolutionBodySchema', () => {
  const validWorkspace = { blocks: { languageVersion: 0, blocks: [] } }

  it('rejects a body without roundId', () => {
    const result = SubmitSolutionBodySchema.safeParse({
      problemId: '00000000-0000-0000-0000-000000000000',
      workspace: validWorkspace,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a body without problemId', () => {
    const result = SubmitSolutionBodySchema.safeParse({
      roundId: '00000000-0000-0000-0000-000000000000',
      workspace: validWorkspace,
    })
    expect(result.success).toBe(false)
  })

  it('accepts a body with problemId, roundId and workspace', () => {
    const result = SubmitSolutionBodySchema.safeParse({
      problemId: '00000000-0000-0000-0000-000000000000',
      roundId: '00000000-0000-0000-0000-000000000000',
      workspace: validWorkspace,
    })
    expect(result.success).toBe(true)
  })
})

describe('submissions table', () => {
  it('records the problem, workspace, per-case results, score and timestamp', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()

    const [submission] = await db
      .insert(submissionsTable)
      .values({
        problemId: problem.id,
        roundId: problem.roundId,
        userId: user.id,
        teamId: team.id,
        workspace: { blocks: { languageVersion: 0, blocks: [] } },
        generatedCode: 'return 42',
        caseResults: [
          { index: 0, status: 'passed' },
          { index: 1, status: 'failed' },
          { index: 2, status: 'timeout' },
          { index: 3, status: 'error' },
        ],
        score: 25,
        attemptNumber: 1,
        acceptedAt: new Date(),
      })
      .returning()

    expect(submission).toMatchObject({
      problemId: problem.id,
      roundId: problem.roundId,
      userId: user.id,
      teamId: team.id,
      workspace: { blocks: { languageVersion: 0, blocks: [] } },
      generatedCode: 'return 42',
      caseResults: [
        { index: 0, status: 'passed' },
        { index: 1, status: 'failed' },
        { index: 2, status: 'timeout' },
        { index: 3, status: 'error' },
      ],
      score: 25,
      attemptNumber: 1,
    })
    expect(submission?.createdAt).toBeInstanceOf(Date)
  })

  it('rejects a second submission reusing the same team, problem and attempt number', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()
    await db.insert(submissionsTable).values({
      problemId: problem.id,
      roundId: problem.roundId,
      userId: user.id,
      teamId: team.id,
      workspace: {},
      generatedCode: '',
      caseResults: [],
      score: 0,
      attemptNumber: 1,
      acceptedAt: new Date(),
    })

    await expect(
      db.insert(submissionsTable).values({
        problemId: problem.id,
        roundId: problem.roundId,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 10,
        attemptNumber: 1,
        acceptedAt: new Date(),
      }),
    ).rejects.toThrow()
  })

  it('rejects deleting a problem that already has submissions', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()
    await db.insert(submissionsTable).values({
      problemId: problem.id,
      roundId: problem.roundId,
      userId: user.id,
      teamId: team.id,
      workspace: {},
      generatedCode: '',
      caseResults: [],
      score: 0,
      attemptNumber: 1,
      acceptedAt: new Date(),
    })

    await expect(db.delete(problemsTable).where(eq(problemsTable.id, problem.id))).rejects.toThrow()
  })

  it('rejects deleting a team that already has submissions', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()
    await db.insert(submissionsTable).values({
      problemId: problem.id,
      roundId: problem.roundId,
      userId: user.id,
      teamId: team.id,
      workspace: {},
      generatedCode: '',
      caseResults: [],
      score: 30,
      attemptNumber: 1,
      acceptedAt: new Date(),
    })

    await expect(db.delete(teamsTable).where(eq(teamsTable.id, team.id))).rejects.toThrow()
  })

  it('rejects deleting a user that already has submissions', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()
    await db.insert(submissionsTable).values({
      problemId: problem.id,
      roundId: problem.roundId,
      userId: user.id,
      teamId: team.id,
      workspace: {},
      generatedCode: '',
      caseResults: [],
      score: 30,
      attemptNumber: 1,
      acceptedAt: new Date(),
    })

    await expect(db.delete(usersTable).where(eq(usersTable.id, user.id))).rejects.toThrow()
  })
})

// #193, migration 0022. The SQL under test is read from the migration file
// itself, so the test cannot drift from what actually runs against the
// database.
describe('0022 backfill of the submission denominators', () => {
  const backfillSql = readFileSync(
    new URL('../../../drizzle/0022_backfill_submissions_denominators.sql', import.meta.url),
    'utf8',
  )

  const legacySubmission = async (
    problemId: string,
    roundId: string,
    userId: string,
    teamId: string,
    caseCount: number,
    attemptNumber: number,
  ) => {
    const [row] = await db
      .insert(submissionsTable)
      .values({
        problemId,
        roundId,
        userId,
        teamId,
        workspace: { blocks: { languageVersion: 0, blocks: [] } },
        generatedCode: 'return 7',
        caseResults: Array.from({ length: caseCount }, (_, index) => ({
          index,
          status: 'passed' as const,
        })),
        score: 50,
        attemptNumber,
        acceptedAt: new Date(),
      })
      .returning()
    if (!row) throw new Error('expected a legacy submission fixture')
    // The column did not exist when these rows were written.
    await db
      .update(submissionsTable)
      .set({ maxScore: null, hiddenCaseCount: null })
      .where(eq(submissionsTable.id, row.id))
    return row.id
  }

  it('stamps only the rows that still have a witness, and says so about the rest', async () => {
    // 1 visible + 4 hidden today.
    const [problem] = await db
      .insert(problemsTable)
      .values({
        difficulty: 'easy',
        status: 'published',
        points: 100,
        testCases: [
          { input: 1, expected: 1, hidden: false },
          { input: 7, expected: 7, hidden: true },
          { input: 3, expected: 3, hidden: true },
          { input: 5, expected: 5, hidden: true },
          { input: 9, expected: 9, hidden: true },
        ],
      })
      .returning()
    if (!problem) throw new Error('expected a problem fixture')
    const [round] = await db
      .insert(roundsTable)
      .values({ name: 'Rodada 0022', durationMinutes: 30, status: 'closed' })
      .returning()
    if (!round) throw new Error('expected a round fixture')
    const { user, team } = await insertTeamMember()

    // The witness: judged over a set of the same size the problem still has.
    const witnessed = await legacySubmission(problem.id, round.id, user.id, team.id, 5, 1)
    // Proven stale: judged over three cases, the problem now has five.
    const stale = await legacySubmission(problem.id, round.id, user.id, team.id, 3, 2)

    await db.execute(sql.raw(backfillSql))

    const rows = await db.select().from(submissionsTable)
    const witnessedRow = rows.find((row) => row.id === witnessed)
    const staleRow = rows.find((row) => row.id === stale)

    expect(witnessedRow?.maxScore).toBe(100)
    expect(witnessedRow?.hiddenCaseCount).toBe(4)
    // Not five: the visible case is in case_results but is not a denominator.
    expect(staleRow?.maxScore).toBeNull()
    expect(staleRow?.hiddenCaseCount).toBeNull()
  })

  it('leaves a row with no case_results alone — an empty array witnesses nothing', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()
    const empty = await legacySubmission(problem.id, problem.roundId, user.id, team.id, 0, 1)

    await db.execute(sql.raw(backfillSql))

    const [row] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, empty))
    expect(row?.maxScore).toBeNull()
    expect(row?.hiddenCaseCount).toBeNull()
  })

  it('never overwrites a stamp the application already wrote', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()
    const [row] = await db
      .insert(submissionsTable)
      .values({
        problemId: problem.id,
        roundId: problem.roundId,
        userId: user.id,
        teamId: team.id,
        workspace: { blocks: { languageVersion: 0, blocks: [] } },
        generatedCode: 'return 7',
        caseResults: [],
        score: 50,
        maxScore: 40,
        hiddenCaseCount: 9,
        attemptNumber: 1,
        acceptedAt: new Date(),
      })
      .returning()

    await db.execute(sql.raw(backfillSql))

    const [after] = await db
      .select()
      .from(submissionsTable)
      .where(eq(submissionsTable.id, row?.id ?? ''))
    expect(after?.maxScore).toBe(40)
    expect(after?.hiddenCaseCount).toBe(9)
  })
})

describe('getBestSubmission', () => {
  it('returns null when the team has no submissions for the problem', async () => {
    const problem = await insertProblem()
    const team = await insertTeam()

    expect(await getBestSubmission(db, team.id, problem.id, problem.roundId)).toBeNull()
  })

  it('returns the highest score, when it was reached and the attempt count', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()
    const best = new Date('2026-08-31T12:00:00.000Z')
    await db.insert(submissionsTable).values([
      {
        problemId: problem.id,
        roundId: problem.roundId,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 20,
        attemptNumber: 1,
        acceptedAt: new Date('2026-08-31T11:00:00.000Z'),
        // Reversed vs. acceptedAt: the assertion below only holds if the code
        // reads acceptedAt, not this INSERT timestamp (#238).
        createdAt: new Date('2026-08-31T13:30:00.000Z'),
      },
      {
        problemId: problem.id,
        roundId: problem.roundId,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 80,
        attemptNumber: 2,
        acceptedAt: best,
        createdAt: new Date('2026-08-31T11:30:00.000Z'),
      },
      {
        problemId: problem.id,
        roundId: problem.roundId,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 50,
        attemptNumber: 3,
        acceptedAt: new Date('2026-08-31T13:00:00.000Z'),
        createdAt: new Date('2026-08-31T12:30:00.000Z'),
      },
    ])

    expect(await getBestSubmission(db, team.id, problem.id, problem.roundId)).toEqual({
      score: 80,
      achievedAt: best,
      attempts: 3,
    })
  })

  it('returns the earliest timestamp when the best score is tied', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()
    const earliest = new Date('2026-08-31T11:00:00.000Z')
    await db.insert(submissionsTable).values([
      {
        problemId: problem.id,
        roundId: problem.roundId,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 80,
        attemptNumber: 1,
        acceptedAt: earliest,
        // Reversed vs. acceptedAt: a createdAt-based tiebreak would pick the
        // other row here, so this only passes if the code reads acceptedAt.
        createdAt: new Date('2026-08-31T13:00:00.000Z'),
      },
      {
        problemId: problem.id,
        roundId: problem.roundId,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 80,
        attemptNumber: 2,
        acceptedAt: new Date('2026-08-31T12:00:00.000Z'),
        createdAt: new Date('2026-08-31T10:00:00.000Z'),
      },
    ])

    expect(await getBestSubmission(db, team.id, problem.id, problem.roundId)).toEqual({
      score: 80,
      achievedAt: earliest,
      attempts: 2,
    })
  })

  it('ignores submissions from other teams and other problems', async () => {
    const problem = await insertProblem()
    const otherProblem = await insertProblem()
    const { user, team } = await insertTeamMember('Time A', 'time-a@edu.pucrs.br')
    const { user: otherUser, team: otherTeam } = await insertTeamMember(
      'Time B',
      'time-b@edu.pucrs.br',
    )
    const own = new Date('2026-08-31T11:00:00.000Z')
    await db.insert(submissionsTable).values([
      {
        problemId: problem.id,
        roundId: problem.roundId,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 40,
        attemptNumber: 1,
        acceptedAt: own,
        // Deliberately different from acceptedAt: proves achievedAt below
        // reads acceptedAt, not this INSERT timestamp (#238).
        createdAt: new Date('2026-08-31T12:00:00.000Z'),
      },
      {
        problemId: problem.id,
        roundId: problem.roundId,
        userId: otherUser.id,
        teamId: otherTeam.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 90,
        attemptNumber: 1,
        acceptedAt: new Date(),
      },
      {
        problemId: otherProblem.id,
        roundId: otherProblem.roundId,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 95,
        attemptNumber: 1,
        acceptedAt: new Date(),
      },
    ])

    expect(await getBestSubmission(db, team.id, problem.id, problem.roundId)).toEqual({
      score: 40,
      achievedAt: own,
      attempts: 1,
    })
  })
})

describe('submission throttle', () => {
  beforeEach(() => {
    resetSubmissionThrottle()
  })

  it('grants the first slot for an identity', () => {
    expect(acquireSubmissionSlot('team:a')).toBeNull()
  })

  it('refuses a second slot while the first is still in flight', () => {
    acquireSubmissionSlot('team:a')

    expect(acquireSubmissionSlot('team:a')).toEqual({ reason: 'in_flight', retryAfterMs: 0 })
  })

  // A 404 or a codegen refusal never ran the sandbox, so it must not burn the
  // participant's 5s: releasing without arming leaves the identity free.
  it('grants the next slot immediately when the cooldown is not armed', () => {
    acquireSubmissionSlot('team:a')
    releaseSubmissionSlot('team:a', false)

    expect(acquireSubmissionSlot('team:a')).toBeNull()
  })

  it('refuses the next slot during the cooldown, counting the time left', () => {
    const now = 1_000_000
    acquireSubmissionSlot('team:a', now)
    releaseSubmissionSlot('team:a', true, now)

    expect(acquireSubmissionSlot('team:a', now + 1500)).toEqual({
      reason: 'cooldown',
      retryAfterMs: SUBMISSION_COOLDOWN_MS - 1500,
    })
  })

  it('grants the slot again once the cooldown has elapsed', () => {
    const now = 1_000_000
    acquireSubmissionSlot('team:a', now)
    releaseSubmissionSlot('team:a', true, now)

    expect(acquireSubmissionSlot('team:a', now + SUBMISSION_COOLDOWN_MS)).toBeNull()
  })

  it('keeps identities independent', () => {
    const now = 1_000_000
    acquireSubmissionSlot('team:a', now)
    releaseSubmissionSlot('team:a', true, now)

    expect(acquireSubmissionSlot('user:b', now)).toBeNull()
  })
})

// --- Live load for the organizer's card (#279) ---

describe('getSubmissionLoad', () => {
  beforeEach(() => {
    resetSubmissionThrottle()
  })

  const now = 10_000_000

  it('reports nothing on a quiet process', () => {
    expect(getSubmissionLoad(now)).toEqual({
      inFlight: 0,
      lastMinute: 0,
      perMinute: Array(15).fill(0),
    })
  })

  it('counts an acceptance 59s old in the last minute, and one 61s old in the minute before', () => {
    recordAcceptedSubmission(now - 59_000)
    recordAcceptedSubmission(now - 61_000)

    const load = getSubmissionLoad(now)
    expect(load.lastMinute).toBe(1)
    expect(load.perMinute[14]).toBe(1)
    expect(load.perMinute[13]).toBe(1)
  })

  // The window is (now - 60s, now]: exactly 60s old already belongs to the
  // minute before, so no acceptance is ever counted in two buckets.
  it('puts an acceptance exactly 60s old in the minute before, not the last one', () => {
    recordAcceptedSubmission(now - 60_000)

    const load = getSubmissionLoad(now)
    expect(load.lastMinute).toBe(0)
    expect(load.perMinute[13]).toBe(1)
  })

  it('orders the 15 buckets oldest first, the last one being lastMinute', () => {
    recordAcceptedSubmission(now - 14 * 60_000 - 30_000)
    recordAcceptedSubmission(now - 7 * 60_000 - 1)
    recordAcceptedSubmission(now - 7 * 60_000 - 2)
    recordAcceptedSubmission(now)

    const load = getSubmissionLoad(now)
    expect(load.perMinute).toHaveLength(15)
    expect(load.perMinute[0]).toBe(1)
    expect(load.perMinute[7]).toBe(2)
    expect(load.perMinute[14]).toBe(1)
    expect(load.lastMinute).toBe(load.perMinute[14])
    expect(load.perMinute.reduce((sum, n) => sum + n, 0)).toBe(4)
  })

  it('forgets acceptances older than 15 minutes', () => {
    recordAcceptedSubmission(now - 15 * 60_000)
    recordAcceptedSubmission(now - 20 * 60_000)

    expect(getSubmissionLoad(now).perMinute).toEqual(Array(15).fill(0))
    // And they stay gone: a later read at an earlier clock cannot resurrect them.
    expect(getSubmissionLoad(now - 10 * 60_000).perMinute).toEqual(Array(15).fill(0))
  })

  it('reports the throttle slots currently held as in flight', () => {
    acquireSubmissionSlot('team:a', now)
    acquireSubmissionSlot('team:b', now)
    expect(getSubmissionLoad(now).inFlight).toBe(2)

    releaseSubmissionSlot('team:a', true, now)
    expect(getSubmissionLoad(now).inFlight).toBe(1)
  })

  it('is cleared by the throttle test seam', () => {
    recordAcceptedSubmission(now)
    resetSubmissionThrottle()

    expect(getSubmissionLoad(now).lastMinute).toBe(0)
  })
})

// --- Scoring and case mapping (pure, no db) ---

const visible = (): TestCase => ({ input: 1, expected: 1, hidden: false })
const hidden = (): TestCase => ({ input: 2, expected: 2, hidden: true })

const passed = (): JudgeCaseResult => ({ outcome: 'passed', ms: 1 })
const failed = (): JudgeCaseResult => ({ outcome: 'failed', expected: 1, actual: 2, ms: 1 })
const timedOut = (): JudgeCaseResult => ({ outcome: 'timeout', ms: 2000 })
const crashed = (): JudgeCaseResult => ({ outcome: 'runtime_error', detail: 'boom', ms: 1 })

describe('scoreSubmission', () => {
  it('scores the share of hidden cases that passed', () => {
    const cases = [hidden(), hidden(), hidden(), hidden()]
    const results = [passed(), passed(), passed(), failed()]

    expect(scoreSubmission(cases, results, 100)).toBe(75)
  })

  it('rounds the partial score', () => {
    const cases = [hidden(), hidden(), hidden()]
    const results = [passed(), failed(), failed()]

    expect(scoreSubmission(cases, results, 100)).toBe(33)
  })

  // Visible cases are feedback only (epic #8): they never move the score.
  it('ignores visible cases entirely', () => {
    const cases = [visible(), visible(), hidden()]
    const results = [failed(), failed(), passed()]

    expect(scoreSubmission(cases, results, 100)).toBe(100)
  })

  it.each([
    { name: 'a timeout', result: timedOut() },
    { name: 'a runtime error', result: crashed() },
  ])('counts $name as not passed', ({ result }) => {
    expect(scoreSubmission([hidden(), hidden()], [passed(), result], 100)).toBe(50)
  })

  it('scores zero when the problem has no hidden case', () => {
    expect(scoreSubmission([visible()], [passed()], 100)).toBe(0)
  })
})

describe('toPersistedCaseResults', () => {
  it('keeps the index and translates runtime_error to the stored status', () => {
    expect(toPersistedCaseResults([passed(), crashed(), timedOut(), failed()])).toEqual([
      { index: 0, status: 'passed' },
      { index: 1, status: 'error' },
      { index: 2, status: 'timeout' },
      { index: 3, status: 'failed' },
    ])
  })
})

describe('toResponseCases', () => {
  it('reduces a hidden case to its index and outcome', () => {
    const [hiddenCase] = toResponseCases([hidden()], [failed()])

    expect(hiddenCase).toEqual({ hidden: true, index: 0, outcome: 'failed' })
    // Object.keys, not toBeUndefined: the field must be absent, so nothing
    // about a hidden case can be read off the payload.
    expect(Object.keys(hiddenCase ?? {}).sort()).toEqual(['hidden', 'index', 'outcome'])
  })

  it('gives a failed visible case both the expected and the obtained value', () => {
    const [visibleCase] = toResponseCases([visible()], [failed()])

    expect(visibleCase).toEqual({
      hidden: false,
      index: 0,
      outcome: 'failed',
      expected: 1,
      actual: 2,
      ms: 1,
    })
  })

  it('gives a crashed visible case its detail', () => {
    const [visibleCase] = toResponseCases([visible()], [crashed()])

    expect(visibleCase).toMatchObject({ outcome: 'runtime_error', detail: 'boom' })
  })

  it('omits actual on a passing visible case', () => {
    const [visibleCase] = toResponseCases([visible()], [passed()])

    expect(Object.keys(visibleCase ?? {}).sort()).toEqual([
      'expected',
      'hidden',
      'index',
      'ms',
      'outcome',
    ])
  })
})

// --- The pipeline, against the real Postgres and the real sandbox ---

const JUDGED_TEST_TIMEOUT_MS = 20_000

// The canonical curated-toolbox solution: sums the even numbers of the input.
const solutionWorkspace = WorkspaceSchema.parse(somaDosPares)
// Only a root block is missing here, which is codegen refusal #2.
const emptyWorkspace = WorkspaceSchema.parse({ blocks: { languageVersion: 0, blocks: [] } })

const solvableCases: TestCase[] = [
  { input: [1, 2, 3, 4], expected: 6, hidden: false },
  { input: [], expected: 0, hidden: false },
  { input: [2, 4], expected: 6, hidden: true },
  { input: [1, 3, 5], expected: 0, hidden: true },
]

// Published and dropped into an open round in one step: the submission
// pipeline now requires an open round containing the problem (#37), and
// every test below except the round-lock tests themselves just wants a
// problem it can submit against.
async function insertPublishedProblem(testCases: TestCase[], points = 100) {
  const [problem] = await db
    .insert(problemsTable)
    .values({ difficulty: 'easy', status: 'published', points, testCases })
    .returning()
  if (!problem) throw new Error('expected a problem fixture')
  const created = await createRound(db, {
    name: 'Round 1',
    durationMinutes: 30,
    problemIds: [problem.id],
  })
  if (!created.ok) throw new Error('expected create to succeed')
  const opened = await openRound(db, created.round.id)
  if (!opened.ok) throw new Error('expected open to succeed')
  return { ...problem, roundId: opened.round.id }
}

async function insertTeamMember(teamName = 'Time A', email = 'participante@edu.pucrs.br') {
  const [user, team] = await Promise.all([insertUser(email), insertTeam(teamName)])
  await db.insert(teamMembersTable).values({ userId: user.id, teamId: team.id })
  return { user, team }
}

function expectSubmitted(outcome: SubmitOutcome) {
  if (!outcome.ok) throw new Error(`unexpected refusal: ${outcome.error}`)
  return outcome.result
}

describe('submitSolution', () => {
  beforeEach(() => {
    resetSubmissionThrottle()
  })

  it(
    'runs every case, scores the hidden ones and persists the attempt',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()

      const result = expectSubmitted(
        await submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        ),
      )

      expect(result).toMatchObject({
        score: 100,
        maxScore: 100,
        attemptNumber: 1,
        attemptInRound: 1,
      })
      expect(result.cases.map((testCase) => testCase.index)).toEqual([0, 1, 2, 3])
      expect(result.cases.map((testCase) => testCase.hidden)).toEqual([false, false, true, true])

      const [row] = await db.select().from(submissionsTable)
      expect(row).toMatchObject({
        problemId: problem.id,
        roundId: problem.roundId,
        userId: user.id,
        teamId: team.id,
        score: 100,
        attemptNumber: 1,
      })
      expect(row?.generatedCode).toContain('function solve(input)')
      expect(row?.caseResults).toEqual([
        { index: 0, status: 'passed' },
        { index: 1, status: 'passed' },
        { index: 2, status: 'passed' },
        { index: 3, status: 'passed' },
      ])
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it(
    'stamps the denominator the score was prorated over (#193)',
    async () => {
      const problem = await insertPublishedProblem(
        [
          { input: [1, 2, 3, 4], expected: 6, hidden: false },
          { input: [2, 4], expected: 6, hidden: true },
          { input: [1, 3, 5], expected: 0, hidden: true },
        ],
        250,
      )
      const { user, team } = await insertTeamMember()

      const result = expectSubmitted(
        await submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        ),
      )

      const [row] = await db.select().from(submissionsTable)
      expect(row?.maxScore).toBe(250)
      expect(row?.hiddenCaseCount).toBe(2)
      // The stamp is the scale `score` lives on: reading back how many hidden
      // cases passed has to give an integer, not an approximation.
      const passedHidden = ((row?.score ?? 0) * (row?.hiddenCaseCount ?? 0)) / (row?.maxScore ?? 1)
      expect(passedHidden).toBe(2)
      // What the participant is told and what the row carries never disagree.
      expect(result.maxScore).toBe(row?.maxScore)
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it(
    'stamps the same denominator scoreSubmission divided by, on a partial score',
    async () => {
      const problem = await insertPublishedProblem([
        { input: [2, 4], expected: 6, hidden: true },
        { input: [2, 4], expected: 999, hidden: true },
        { input: [1, 2], expected: 2, hidden: false },
      ])
      const { user, team } = await insertTeamMember()

      await submitSolution(
        db,
        { userId: user.id, teamId: team.id },
        { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
      )

      const [row] = await db.select().from(submissionsTable)
      // Two hidden of three cases: a stamp that counted every case (3) or only
      // the passing one (1) would both break this.
      expect(row?.hiddenCaseCount).toBe(2)
      expect(row?.score).toBe(50)
      expect(row?.maxScore).toBe(100)
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it('refuses a draft problem without recording anything', async () => {
    const [problem] = await db
      .insert(problemsTable)
      .values({ difficulty: 'easy', status: 'draft', testCases: solvableCases })
      .returning()
    const { user, team } = await insertTeamMember()

    const outcome = await submitSolution(
      db,
      { userId: user.id, teamId: team.id },
      {
        problemId: problem?.id ?? '',
        roundId: '00000000-0000-0000-0000-000000000000',
        workspace: solutionWorkspace,
      },
    )

    expect(outcome).toEqual({ ok: false, error: 'problem_not_found' })
    expect(await db.select().from(submissionsTable)).toEqual([])
  })

  it('refuses a problem id that does not exist', async () => {
    const { user, team } = await insertTeamMember()

    const outcome = await submitSolution(
      db,
      { userId: user.id, teamId: team.id },
      {
        problemId: '00000000-0000-0000-0000-000000000000',
        roundId: '00000000-0000-0000-0000-000000000000',
        workspace: solutionWorkspace,
      },
    )

    expect(outcome).toEqual({ ok: false, error: 'problem_not_found' })
  })

  // #209: practice has no Submeter. Refused before any round lookup, codegen
  // or sandbox — nothing recorded, and no cooldown armed either.
  it('refuses a practice problem without recording anything or arming the cooldown', async () => {
    const [problem] = await db
      .insert(problemsTable)
      .values({
        difficulty: 'easy',
        status: 'published',
        visibility: 'practice',
        testCases: solvableCases,
      })
      .returning()
    const { user, team } = await insertTeamMember()
    const submit = () =>
      submitSolution(
        db,
        { userId: user.id, teamId: team.id },
        {
          problemId: problem?.id ?? '',
          roundId: '00000000-0000-0000-0000-000000000000',
          workspace: solutionWorkspace,
        },
      )

    expect(await submit()).toEqual({ ok: false, error: 'practice_not_submittable' })
    // A second immediate try gets the same refusal, not a 429.
    expect(await submit()).toEqual({ ok: false, error: 'practice_not_submittable' })
    expect(await db.select().from(submissionsTable)).toEqual([])
  })

  it(
    'refuses a workspace codegen rejects, runs nothing and burns no cooldown',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()
      const identity = { userId: user.id, teamId: team.id }

      const outcome = await submitSolution(db, identity, {
        problemId: problem.id,
        roundId: problem.roundId,
        workspace: emptyWorkspace,
      })

      expect(outcome).toMatchObject({ ok: false, error: 'codegen_rejected', code: 'missing_root' })
      expect(await db.select().from(submissionsTable)).toEqual([])

      // The refusal never reached the sandbox, so the next attempt is free.
      const retry = await submitSolution(db, identity, {
        problemId: problem.id,
        roundId: problem.roundId,
        workspace: solutionWorkspace,
      })
      expect(expectSubmitted(retry).attemptNumber).toBe(1)
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it(
    'scores partially when only some hidden cases pass',
    async () => {
      const problem = await insertPublishedProblem([
        { input: [2, 4], expected: 6, hidden: true },
        { input: [2, 4], expected: 999, hidden: true },
      ])
      const { user, team } = await insertTeamMember()

      const result = expectSubmitted(
        await submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        ),
      )

      expect(result.score).toBe(50)
      const [row] = await db.select().from(submissionsTable)
      expect(row?.score).toBe(50)
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it(
    'numbers the attempts of the same team on the same problem',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()
      const identity = { userId: user.id, teamId: team.id }
      const body = { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace }

      const first = expectSubmitted(await submitSolution(db, identity, body))
      resetSubmissionThrottle()
      const second = expectSubmitted(await submitSolution(db, identity, body))

      expect([first.attemptNumber, second.attemptNumber]).toEqual([1, 2])
      // One round only: the round's count is the global one (#280, no regression).
      expect([first.attemptInRound, second.attemptInRound]).toEqual([1, 2])
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it(
    'numbers the attempts per round on a reused problem (#280)',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()
      const identity = { userId: user.id, teamId: team.id }

      // Round 1's five attempts, inserted directly: five real judgings would
      // prove nothing more about the numbering.
      await db.insert(submissionsTable).values(
        [1, 2, 3, 4, 5].map((attemptNumber) => ({
          problemId: problem.id,
          roundId: problem.roundId,
          userId: user.id,
          teamId: team.id,
          workspace: {},
          generatedCode: '',
          caseResults: [],
          score: 0,
          attemptNumber,
          acceptedAt: new Date(),
        })),
      )
      const closed = await closeRound(db, problem.roundId)
      if (!closed.ok) throw new Error('expected close to succeed')

      // The same problem, reused in round 2.
      const created = await createRound(db, {
        name: 'Round 2',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const opened = await openRound(db, created.round.id)
      if (!opened.ok) throw new Error('expected open to succeed')
      const round2 = opened.round.id

      const body = { problemId: problem.id, roundId: round2, workspace: solutionWorkspace }
      const first = expectSubmitted(await submitSolution(db, identity, body))
      resetSubmissionThrottle()
      const second = expectSubmitted(await submitSolution(db, identity, body))

      // The persisted number stays global (the unique index is untouched)...
      expect([first.attemptNumber, second.attemptNumber]).toEqual([6, 7])
      // ...while what the participant is told counts this round only.
      expect([first.attemptInRound, second.attemptInRound]).toEqual([1, 2])

      // The screen, the round's ranking and the problem page agree.
      const ranking2 = await getRoundRanking(db, round2)
      const entry2 = ranking2?.teams
        .find((row) => row.teamId === team.id)
        ?.problems.find((row) => row.problemId === problem.id)
      expect(entry2?.attempts).toBe(second.attemptInRound)
      expect((await getBestSubmission(db, team.id, problem.id, round2))?.attempts).toBe(
        second.attemptInRound,
      )

      // Round 1 keeps its own five.
      const ranking1 = await getRoundRanking(db, problem.roundId)
      const entry1 = ranking1?.teams
        .find((row) => row.teamId === team.id)
        ?.problems.find((row) => row.problemId === problem.id)
      expect(entry1?.attempts).toBe(5)
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it(
    'stamps the team first submission once, on the first attempt only',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()
      const identity = { userId: user.id, teamId: team.id }
      const body = { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace }

      expect(team.firstSubmittedAt).toBeNull()

      await submitSolution(db, identity, body)
      const [afterFirst] = await db.select().from(teamsTable).where(eq(teamsTable.id, team.id))
      expect(afterFirst?.firstSubmittedAt).toBeInstanceOf(Date)

      resetSubmissionThrottle()
      await submitSolution(db, identity, body)
      const [afterSecond] = await db.select().from(teamsTable).where(eq(teamsTable.id, team.id))
      expect(afterSecond?.firstSubmittedAt).toEqual(afterFirst?.firstSubmittedAt)
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it(
    'refuses a second submission while the first is still running',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()
      const identity = { userId: user.id, teamId: team.id }
      const body = { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace }

      const [first, second] = await Promise.all([
        submitSolution(db, identity, body),
        submitSolution(db, identity, body),
      ])

      expect(expectSubmitted(first).attemptNumber).toBe(1)
      expect(second).toMatchObject({ ok: false, error: 'throttled', reason: 'in_flight' })
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  describe('round lock (#37)', () => {
    it('refuses a published problem with no round at all, arming no cooldown', async () => {
      const [problem] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'published', testCases: solvableCases })
        .returning()
      if (!problem) throw new Error('expected a problem fixture')
      const { user, team } = await insertTeamMember()

      const outcome = await submitSolution(
        db,
        { userId: user.id, teamId: team.id },
        {
          problemId: problem.id,
          roundId: '00000000-0000-0000-0000-000000000000',
          workspace: solutionWorkspace,
        },
      )

      expect(outcome).toEqual({ ok: false, error: 'no_active_round' })
      // The refusal never reached the sandbox: the next attempt is free.
      expect(acquireSubmissionSlot(`team:${team.id}`)).toBeNull()
    })

    it('refuses when the round containing the problem is still a draft', async () => {
      const [problem] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'published', testCases: solvableCases })
        .returning()
      if (!problem) throw new Error('expected a problem fixture')
      const created = await createRound(db, {
        name: 'Round 1',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!created.ok) throw new Error('expected create to succeed')
      const { user, team } = await insertTeamMember()

      const outcome = await submitSolution(
        db,
        { userId: user.id, teamId: team.id },
        { problemId: problem.id, roundId: created.round.id, workspace: solutionWorkspace },
      )

      expect(outcome).toEqual({ ok: false, error: 'no_active_round' })
    })

    it('refuses when the open round does not contain this problem', async () => {
      const problemInOtherRound = await insertPublishedProblem(solvableCases)
      const [problem] = await db
        .insert(problemsTable)
        .values({ difficulty: 'easy', status: 'published', testCases: solvableCases })
        .returning()
      if (!problem) throw new Error('expected a problem fixture')
      const { user, team } = await insertTeamMember()

      const outcome = await submitSolution(
        db,
        { userId: user.id, teamId: team.id },
        {
          problemId: problem.id,
          roundId: problemInOtherRound.roundId,
          workspace: solutionWorkspace,
        },
      )

      expect(outcome).toEqual({ ok: false, error: 'no_active_round' })
    })

    it('refuses a stale roundId even though the problem sits in a different open round', async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const staleCreated = await createRound(db, {
        name: 'Stale round',
        durationMinutes: 30,
        problemIds: [problem.id],
      })
      if (!staleCreated.ok) throw new Error('expected create to succeed')
      const { user, team } = await insertTeamMember()

      const outcome = await submitSolution(
        db,
        { userId: user.id, teamId: team.id },
        { problemId: problem.id, roundId: staleCreated.round.id, workspace: solutionWorkspace },
      )

      expect(outcome).toEqual({ ok: false, error: 'no_active_round' })
    })

    it(
      'refuses once closesAt has passed even before any other read reaped the round',
      async () => {
        const problem = await insertPublishedProblem(solvableCases)
        await db
          .update(roundsTable)
          .set({ closesAt: new Date(Date.now() - 1000) })
          .where(eq(roundsTable.id, problem.roundId))
        const { user, team } = await insertTeamMember()

        const outcome = await submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        )

        expect(outcome).toEqual({ ok: false, error: 'no_active_round' })
      },
      JUDGED_TEST_TIMEOUT_MS,
    )

    it(
      'lets the pipeline proceed when the roundId names the actual open round for this problem',
      async () => {
        const problem = await insertPublishedProblem(solvableCases)
        const { user, team } = await insertTeamMember()

        const outcome = await submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        )

        expect(expectSubmitted(outcome).score).toBe(100)
      },
      JUDGED_TEST_TIMEOUT_MS,
    )

    it('refuses a submission after the round has been explicitly closed', async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const closed = await closeRound(db, problem.roundId)
      if (!closed.ok) throw new Error('expected close to succeed')
      const { user, team } = await insertTeamMember()

      const outcome = await submitSolution(
        db,
        { userId: user.id, teamId: team.id },
        { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
      )

      expect(outcome).toEqual({ ok: false, error: 'no_active_round' })
    })
  })
})

describe('POST /submissions — marks the ranking dirty on the sse bus (#44)', () => {
  async function tokenForParticipant(userId: string) {
    return signJwt(
      { role: 'participant', university: 'pucrs' },
      { secret: JWT_SECRET, subject: userId, expiresInSeconds: TOKEN_TTL_SECONDS },
    )
  }

  it(
    // Every accepted submission increments the team's attempts for the
    // problem, which feeds the leaderboard's tie-break order even when it
    // doesn't beat the best score — so a tying submission marks the ranking
    // dirty exactly like one that improves it (#44).
    'both a score-beating and a merely tying submission reach the next ranking tick',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()
      const token = await tokenForParticipant(user.id)
      const fn = vi.fn()
      const unsubscribe = k.resolve('sseBus').subscribe(fn)

      const res = await app.request('/submissions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: problem.id,
          roundId: problem.roundId,
          workspace: solutionWorkspace,
        }),
      })
      expect(res.status).toBe(201)

      await runRankingTick(k.resolve('db'), k.resolve('sseBus'))
      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ type: 'ranking.updated' }))

      fn.mockClear()
      resetSubmissionThrottle()
      const tying = await app.request('/submissions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: problem.id,
          roundId: problem.roundId,
          workspace: solutionWorkspace,
        }),
      })
      expect(tying.status).toBe(201)

      await runRankingTick(k.resolve('db'), k.resolve('sseBus'))
      expect(fn).toHaveBeenCalledWith(expect.objectContaining({ type: 'ranking.updated' }))

      unsubscribe()
    },
    JUDGED_TEST_TIMEOUT_MS,
  )
})

describe('findTeamIdForUser', () => {
  it('returns the team the user belongs to', async () => {
    const { user, team } = await insertTeamMember()

    expect(await findTeamIdForUser(db, user.id)).toBe(team.id)
  })

  it('returns null for a user with no team', async () => {
    const user = await insertUser('sozinho@edu.pucrs.br')

    expect(await findTeamIdForUser(db, user.id)).toBeNull()
  })
})

// --- #176: the round closes while the judge is still running ---
//
// The accept gate (isProblemInOpenRound) runs before the judge, the INSERT
// runs after it. A submission accepted one second before closesAt therefore
// lands with a createdAt outside the round's window whenever judging outlives
// the round — which is precisely the closing seconds, when most people submit.
describe('submitSolution when the round closes mid-judging', () => {
  beforeEach(() => {
    resetSubmissionThrottle()
  })

  it(
    'counts the score in both rankings, matching the problem page',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()

      // Closes the round between the sandbox verdict and the INSERT: the
      // submission was accepted while open, the row is written after.
      judgeRace.onJudged = async () => {
        const closed = await closeRound(db, problem.roundId)
        if (!closed.ok) throw new Error('expected the mid-judging close to succeed')
      }

      const result = expectSubmitted(
        await submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        ),
      )
      expect(result.score).toBe(100)

      // The problem page has always counted it...
      expect(await getBestSubmission(db, team.id, problem.id, problem.roundId)).toMatchObject({
        score: 100,
      })

      // ...so both leaderboards must agree.
      const roundRanking = await getRoundRanking(db, problem.roundId)
      expect(roundRanking?.teams[0]).toMatchObject({ teamId: team.id, totalScore: 100 })

      const eventRanking = await getEventRanking(db)
      expect(eventRanking.teams[0]).toMatchObject({ teamId: team.id, totalScore: 100 })
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  // The counter behind the round.closed hold (#176 AC4): the SSE announcement
  // waits on it, so a leak would hold a round's closure until the ceiling.
  it(
    'reports judging in flight for the round while the submission is being judged',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()

      expect(hasJudgingInFlight(problem.roundId)).toBe(false)

      let seenMidJudging: boolean | null = null
      judgeRace.onJudged = async () => {
        seenMidJudging = hasJudgingInFlight(problem.roundId)
      }

      await submitSolution(
        db,
        { userId: user.id, teamId: team.id },
        { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
      )

      expect(seenMidJudging).toBe(true)
      expect(hasJudgingInFlight(problem.roundId)).toBe(false)
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it(
    'releases the round even when the judge throws',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()

      judgeRace.onJudged = async () => {
        throw new Error('judge exploded')
      }

      await expect(
        submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        ),
      ).rejects.toThrow('judge exploded')

      // A stuck counter would hold that round's closure for the whole ceiling.
      expect(hasJudgingInFlight(problem.roundId)).toBe(false)
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it('never claims a round when the submission is refused before the accept gate', async () => {
    const { user, team } = await insertTeamMember()
    const roundId = '00000000-0000-0000-0000-000000000000'

    const outcome = await submitSolution(
      db,
      { userId: user.id, teamId: team.id },
      {
        problemId: '00000000-0000-0000-0000-000000000000',
        roundId,
        workspace: solutionWorkspace,
      },
    )

    expect(outcome).toEqual({ ok: false, error: 'problem_not_found' })
    expect(hasJudgingInFlight(roundId)).toBe(false)
  })
})

// #238: acceptedAt must survive a slow judge, or the tiebreak it feeds
// inflates by however long the sandbox took.
describe('submitSolution tiebreak survives a slow judge', () => {
  beforeEach(() => {
    resetSubmissionThrottle()
  })

  it(
    "keeps team A's acceptedAt earlier than team B's even though B's row is INSERTed first",
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user: userA, team: teamA } = await insertTeamMember('Time A', 'time-a@edu.pucrs.br')
      const { user: userB, team: teamB } = await insertTeamMember('Time B', 'time-b@edu.pucrs.br')

      // Team A accepts first, but its own judge run (via the mocked runJudge
      // above) hangs until team B's *entire* submitSolution — accept, judge,
      // INSERT — has completed. Team A's row therefore lands in the table
      // after team B's, despite A having been accepted first.
      judgeRace.onJudged = async () => {
        // Cleared before awaiting B, or B's own runJudge call would re-enter
        // this same hook and await a submission that never starts.
        judgeRace.onJudged = null
        expectSubmitted(
          await submitSolution(
            db,
            { userId: userB.id, teamId: teamB.id },
            { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
          ),
        )
      }

      expectSubmitted(
        await submitSolution(
          db,
          { userId: userA.id, teamId: teamA.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        ),
      )

      const [rowA] = await db
        .select()
        .from(submissionsTable)
        .where(eq(submissionsTable.teamId, teamA.id))
      const [rowB] = await db
        .select()
        .from(submissionsTable)
        .where(eq(submissionsTable.teamId, teamB.id))
      if (!rowA || !rowB) throw new Error('expected both submissions to be recorded')

      // The bug this issue fixes: A's row is written after B's...
      expect(rowA.createdAt.getTime()).toBeGreaterThan(rowB.createdAt.getTime())
      // ...but A was accepted first, and the tiebreak must reflect that.
      expect(rowA.acceptedAt.getTime()).toBeLessThan(rowB.acceptedAt.getTime())
    },
    JUDGED_TEST_TIMEOUT_MS,
  )
})

// #285: the organizer's pause refuses before any real work — the slot is
// released at once, no cooldown armed, no row written — and lifting it lets
// the very next submission through.
describe('submitSolution while submissions are paused (#285)', () => {
  beforeEach(async () => {
    resetSubmissionThrottle()
    await db.execute(sql`truncate table ${eventConfigTable} restart identity cascade`)
  })

  afterAll(async () => {
    await db.execute(sql`truncate table ${eventConfigTable} restart identity cascade`)
  })

  it(
    'refuses with submissions_paused, leaves no slot held and persists nothing; resuming accepts at once',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()
      const identity = { userId: user.id, teamId: team.id }
      const body = { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace }
      await updateEventConfig(db, { submissionsPaused: true })

      const refused = await submitSolution(db, identity, body)

      expect(refused).toEqual({ ok: false, error: 'submissions_paused' })
      expect(await db.select().from(submissionsTable)).toHaveLength(0)
      // Neither in flight nor cooling down: the slot is free right away.
      expect(acquireSubmissionSlot(`team:${team.id}`)).toBeNull()
      releaseSubmissionSlot(`team:${team.id}`, false)

      await updateEventConfig(db, { submissionsPaused: false })
      const accepted = expectSubmitted(await submitSolution(db, identity, body))
      expect(accepted).toMatchObject({ score: 100, attemptNumber: 1 })
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it('POST /submissions answers 423 submissions_paused', async () => {
    const problem = await insertPublishedProblem(solvableCases)
    const { user } = await insertTeamMember()
    const token = await signJwt(
      { role: 'participant', university: 'pucrs' },
      { secret: JWT_SECRET, subject: user.id, expiresInSeconds: TOKEN_TTL_SECONDS },
    )
    await updateEventConfig(db, { submissionsPaused: true })

    const res = await app.request('/submissions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problemId: problem.id,
        roundId: problem.roundId,
        workspace: solutionWorkspace,
      }),
    })

    expect(res.status).toBe(423)
    expect(await res.json()).toMatchObject({ error: 'submissions_paused' })
  })

  it('closing the round while paused closes normally and keeps the flag on', async () => {
    const problem = await insertPublishedProblem(solvableCases)
    await updateEventConfig(db, { submissionsPaused: true })

    const closed = await closeRound(db, problem.roundId)

    expect(closed.ok).toBe(true)
    expect((await getEventConfig(db)).submissionsPaused).toBe(true)
  })
})

// --- #353: the author leaves the team while their own submission is judged ---
//
// The identity is resolved before the judge and the INSERT runs after it, so a
// leave (or an organizer's move/removal) can land in between. Rule A: the
// submission only counts for the team its author still belongs to when it is
// written — otherwise it is discarded, as `not_in_team`, and nothing is
// written or frozen.

// Copied from teams.test.ts (#303), where it is documented: resolves once
// `pending` is parked on a lock while running `statement`, or once it has
// already settled — then the test's own assertion reports what really happened.
async function untilBlockedOnLock(pending: Promise<unknown>, statement: string) {
  let settled = false
  void pending.then(
    () => {
      settled = true
    },
    () => {
      settled = true
    },
  )
  const deadline = Date.now() + 5000
  while (!settled) {
    const waiting = await db.execute(sql`
      select 1 from pg_stat_activity
      where datname = current_database()
        and wait_event_type = 'Lock'
        and query ilike ${`%${statement}%`}
    `)
    if (waiting.length > 0) return
    if (Date.now() > deadline)
      throw new Error(`nothing blocked on a lock while running ${statement}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/**
 * Whether `pending` is still unsettled. Waits one macrotask so a promise that
 * has already settled gets its reactions run first — a `Promise.race` against
 * a plain value would always let the value win.
 */
async function isPending(pending: Promise<unknown>): Promise<boolean> {
  let settled = false
  void pending.then(
    () => {
      settled = true
    },
    () => {
      settled = true
    },
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  return !settled
}

// Parks a leaveTeam halfway through, on its own connection: the very
// statements leaveTeam runs, in its order (`team-join:` key → team row FOR
// SHARE → DELETE of the membership), with the transaction kept open until
// `release`. `commit: false` rolls it back, a leave that never happened.
async function holdLeaveMidway(teamId: string, userId: string) {
  const holder = createDb()
  let parked!: () => void
  const leaveParked = new Promise<void>((resolve) => {
    parked = resolve
  })
  let releaseRequested!: (commit: boolean) => void
  const releaseWanted = new Promise<boolean>((resolve) => {
    releaseRequested = resolve
  })
  const rollback = new Error('rollback requested by holdLeaveMidway')

  const holding = holder
    .transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`team-join:${teamId}`}::text))`)
      await tx.select().from(teamsTable).where(eq(teamsTable.id, teamId)).for('share')
      await tx
        .delete(teamMembersTable)
        .where(and(eq(teamMembersTable.userId, userId), eq(teamMembersTable.teamId, teamId)))
      parked()
      if (!(await releaseWanted)) throw rollback
    })
    .catch((error: unknown) => {
      if (error !== rollback) throw error
    })
  await leaveParked

  let released = false
  return {
    // Idempotent: tests release in a `finally` and again on the happy path.
    async release({ commit }: { commit: boolean }) {
      if (released) return
      released = true
      releaseRequested(commit)
      await holding
      await holder.$client.end()
    },
  }
}

// Holds the membership row in FOR UPDATE on its own connection — the lock an
// organizer's move or removal takes on it — until `release`, which rolls back
// so the row is left exactly as it was.
async function holdMemberRow(userId: string) {
  const holder = createDb()
  let locked!: () => void
  const rowLocked = new Promise<void>((resolve) => {
    locked = resolve
  })
  let releaseRequested!: () => void
  const releaseWanted = new Promise<void>((resolve) => {
    releaseRequested = resolve
  })
  const rollback = new Error('rollback requested by holdMemberRow')

  const holding = holder
    .transaction(async (tx) => {
      await tx
        .select()
        .from(teamMembersTable)
        .where(eq(teamMembersTable.userId, userId))
        .for('update')
      locked()
      await releaseWanted
      throw rollback
    })
    .catch((error: unknown) => {
      if (error !== rollback) throw error
    })
  await rowLocked

  let released = false
  return {
    // Idempotent: tests release in a `finally` and again on the happy path.
    async release() {
      if (released) return
      released = true
      releaseRequested()
      await holding
      await holder.$client.end()
    },
  }
}

async function teamFirstSubmittedAt(teamId: string) {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId))
  return team?.firstSubmittedAt ?? null
}

describe('submitSolution when the author leaves mid-judging (#353)', () => {
  beforeEach(() => {
    resetSubmissionThrottle()
  })

  it(
    'discards the submission, leaves the team unfrozen and lets the author submit for a new team',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()
      const body = { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace }

      judgeRace.onJudged = async () => {
        // A is not frozen yet, so the leave itself is legitimate (#303).
        expect(await leaveTeam(db, user.id)).toEqual({ ok: true })
      }

      const outcome = await submitSolution(db, { userId: user.id, teamId: team.id }, body)

      expect(outcome).toEqual({ ok: false, error: 'not_in_team' })
      expect(await db.select().from(submissionsTable)).toHaveLength(0)
      expect(await teamFirstSubmittedAt(team.id)).toBeNull()
      expect(await findTeamIdForUser(db, user.id)).toBeNull()
      // The sandbox did run, so A's cooldown is armed — it is A's key, not the
      // author's, so it never touches the team they go on to.
      expect(acquireSubmissionSlot(`team:${team.id}`)).toMatchObject({ reason: 'cooldown' })

      judgeRace.onJudged = null
      const created = await createTeam(db, user.id, 'Time B')
      if (!created.ok) throw new Error('expected the author to create a new team')
      const accepted = expectSubmitted(
        await submitSolution(db, { userId: user.id, teamId: created.team.id }, body),
      )

      expect(accepted).toMatchObject({ score: 100, attemptNumber: 1 })
      const rows = await db.select().from(submissionsTable)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ userId: user.id, teamId: created.team.id })
      expect(await teamFirstSubmittedAt(created.team.id)).not.toBeNull()
      expect(await teamFirstSubmittedAt(team.id)).toBeNull()
    },
    JUDGED_TEST_TIMEOUT_MS * 2,
  )

  it(
    'still records the submission when a teammate, not the author, leaves mid-judging',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()
      const teammate = await insertUser('colega@edu.pucrs.br')
      await db.insert(teamMembersTable).values({ userId: teammate.id, teamId: team.id })

      judgeRace.onJudged = async () => {
        expect(await leaveTeam(db, teammate.id)).toEqual({ ok: true })
      }

      expectSubmitted(
        await submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        ),
      )

      const rows = await db.select().from(submissionsTable)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ userId: user.id, teamId: team.id })
      expect(await teamFirstSubmittedAt(team.id)).not.toBeNull()
      expect(await findTeamIdForUser(db, teammate.id)).toBeNull()
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it(
    'discards the submission when the organizer moves the author to another team mid-judging',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()
      const destination = await insertTeam('Time B')

      judgeRace.onJudged = async () => {
        expect(await moveMember(db, user.id, destination.id)).toEqual({ ok: true })
      }

      const outcome = await submitSolution(
        db,
        { userId: user.id, teamId: team.id },
        { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
      )

      expect(outcome).toEqual({ ok: false, error: 'not_in_team' })
      // Neither in the team it was judged for nor in the one the author is in now.
      expect(await db.select().from(submissionsTable)).toHaveLength(0)
      expect(await teamFirstSubmittedAt(team.id)).toBeNull()
      expect(await teamFirstSubmittedAt(destination.id)).toBeNull()
      expect(await findTeamIdForUser(db, user.id)).toBe(destination.id)
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it(
    'POST /submissions answers 404 not_in_team when the author left mid-judging',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user } = await insertTeamMember()
      const token = await signJwt(
        { role: 'participant', university: 'pucrs' },
        { secret: JWT_SECRET, subject: user.id, expiresInSeconds: TOKEN_TTL_SECONDS },
      )

      judgeRace.onJudged = async () => {
        expect(await leaveTeam(db, user.id)).toEqual({ ok: true })
      }

      const res = await app.request('/submissions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: problem.id,
          roundId: problem.roundId,
          workspace: solutionWorkspace,
        }),
      })

      expect(res.status).toBe(404)
      expect(await res.json()).toMatchObject({ error: 'not_in_team' })
      expect(await db.select().from(submissionsTable)).toHaveLength(0)
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  // The review of #352: the membership check must lock team_members only
  // AFTER the stamp's UPDATE on teams — the order leaveTeam uses (teams, then
  // member). Locking the member first forms a cycle with a leave holding the
  // team row in FOR SHARE: 40P01. Each side of the race is parked below at the
  // exact statement the correct order makes it wait on.
  describe('lock order against leaveTeam (teams, then member)', () => {
    async function parkLeaveMidJudging(commit: boolean) {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()

      let leave: Awaited<ReturnType<typeof holdLeaveMidway>> | undefined
      let judged!: () => void
      const judgedAndParked = new Promise<void>((resolve) => {
        judged = resolve
      })
      judgeRace.onJudged = async () => {
        leave = await holdLeaveMidway(team.id, user.id)
        judged()
      }

      const submission = submitSolution(
        db,
        { userId: user.id, teamId: team.id },
        { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
      )
      try {
        await judgedAndParked
        // The stamp queues on the team row the leave holds in FOR SHARE —
        // not on the member row, which is where it would park with the order
        // reversed (and then deadlock).
        await untilBlockedOnLock(submission, 'update "teams"')
        expect(await isPending(submission)).toBe(true)
        await leave?.release({ commit })
      } finally {
        await leave?.release({ commit })
      }

      return { user, team, outcome: await submission }
    }

    it(
      'side 1: a leave parked mid-way makes the stamp wait; once it commits, the submission is discarded',
      async () => {
        const { user, team, outcome } = await parkLeaveMidJudging(true)

        expect(outcome).toEqual({ ok: false, error: 'not_in_team' })
        expect(await db.select().from(submissionsTable)).toHaveLength(0)
        expect(await teamFirstSubmittedAt(team.id)).toBeNull()
        expect(await findTeamIdForUser(db, user.id)).toBeNull()
      },
      JUDGED_TEST_TIMEOUT_MS,
    )

    it(
      'side 1: a leave parked mid-way that rolls back lets the submission through',
      async () => {
        const { user, team, outcome } = await parkLeaveMidJudging(false)

        expectSubmitted(outcome)
        const rows = await db.select().from(submissionsTable)
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ userId: user.id, teamId: team.id })
        expect(await teamFirstSubmittedAt(team.id)).not.toBeNull()
        expect(await findTeamIdForUser(db, user.id)).toBe(team.id)
      },
      JUDGED_TEST_TIMEOUT_MS,
    )

    it(
      'side 2: a submission parked after its stamp makes a real leave wait on the team row, then refuse it — no deadlock',
      async () => {
        const problem = await insertPublishedProblem(solvableCases)
        const { user, team } = await insertTeamMember()

        let member: Awaited<ReturnType<typeof holdMemberRow>> | undefined
        let judged!: () => void
        const judgedAndParked = new Promise<void>((resolve) => {
          judged = resolve
        })
        judgeRace.onJudged = async () => {
          member = await holdMemberRow(user.id)
          judged()
        }

        const submission = submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        )
        let leave: ReturnType<typeof leaveTeam> | undefined
        try {
          await judgedAndParked
          // Past the stamp (team row held) and waiting on the membership row.
          await untilBlockedOnLock(submission, 'from "team_members"')
          expect(await isPending(submission)).toBe(true)

          leave = leaveTeam(db, user.id)
          // The leave queues on the team row the stamp holds — not on the
          // member row, which is where it would park with the order reversed.
          await untilBlockedOnLock(leave, 'from "teams"%for share')
          expect(await isPending(leave)).toBe(true)
          await member?.release()
        } finally {
          await member?.release()
        }

        // Both settle as values: a 40P01 would reject one of them.
        expectSubmitted(await submission)
        expect(await leave).toEqual({ ok: false, error: 'team_frozen' })
        const rows = await db.select().from(submissionsTable)
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ userId: user.id, teamId: team.id })
        expect(await teamFirstSubmittedAt(team.id)).not.toBeNull()
        expect(await findTeamIdForUser(db, user.id)).toBe(team.id)
      },
      JUDGED_TEST_TIMEOUT_MS,
    )
  })
})

// #279: "accepted" is the accept gate — the same line acceptedAt is stamped
// at. Refusals before it (pause, 404, no open round) never count.
describe('submitSolution feeds the live submissions counter (#279)', () => {
  beforeEach(async () => {
    resetSubmissionThrottle()
    await db.execute(sql`truncate table ${eventConfigTable} restart identity cascade`)
  })

  afterAll(async () => {
    await db.execute(sql`truncate table ${eventConfigTable} restart identity cascade`)
  })

  it(
    'counts an accepted submission in the last minute',
    async () => {
      const problem = await insertPublishedProblem(solvableCases)
      const { user, team } = await insertTeamMember()

      expectSubmitted(
        await submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        ),
      )

      expect(getSubmissionLoad().lastMinute).toBe(1)
      // The slot was released once judging ended.
      expect(getSubmissionLoad().inFlight).toBe(0)
    },
    JUDGED_TEST_TIMEOUT_MS,
  )

  it('does not count a submission refused while paused', async () => {
    const problem = await insertPublishedProblem(solvableCases)
    const { user, team } = await insertTeamMember()
    await updateEventConfig(db, { submissionsPaused: true })

    const outcome = await submitSolution(
      db,
      { userId: user.id, teamId: team.id },
      { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
    )

    expect(outcome).toEqual({ ok: false, error: 'submissions_paused' })
    expect(getSubmissionLoad().lastMinute).toBe(0)
  })

  it('does not count a submission for a problem that does not exist', async () => {
    const { user, team } = await insertTeamMember()

    const outcome = await submitSolution(
      db,
      { userId: user.id, teamId: team.id },
      {
        problemId: '00000000-0000-0000-0000-000000000000',
        roundId: '00000000-0000-0000-0000-000000000000',
        workspace: solutionWorkspace,
      },
    )

    expect(outcome).toEqual({ ok: false, error: 'problem_not_found' })
    expect(getSubmissionLoad().lastMinute).toBe(0)
  })

  it('does not count a submission with no open round', async () => {
    const [problem] = await db
      .insert(problemsTable)
      .values({ difficulty: 'easy', status: 'published', testCases: solvableCases })
      .returning()
    if (!problem) throw new Error('expected a problem fixture')
    const { user, team } = await insertTeamMember()

    const outcome = await submitSolution(
      db,
      { userId: user.id, teamId: team.id },
      {
        problemId: problem.id,
        roundId: '00000000-0000-0000-0000-000000000000',
        workspace: solutionWorkspace,
      },
    )

    expect(outcome).toEqual({ ok: false, error: 'no_active_round' })
    expect(getSubmissionLoad().lastMinute).toBe(0)
  })
})
