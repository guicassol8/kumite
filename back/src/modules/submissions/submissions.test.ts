import { somaDosPares } from '@kumite/blocks'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { SUBMISSION_COOLDOWN_MS } from '../../config'
import { createDb } from '../../db/client'
import {
  problemsTable,
  problemTranslationsTable,
  roundProblemsTable,
  roundsTable,
  submissionsTable,
  teamMembersTable,
  teamsTable,
  usersTable,
} from '../../db/schema'

import type { JudgeCaseResult } from '../judge/judge.schema'
import { WorkspaceSchema } from '../judge/judge.schema'
import type { TestCase } from '../problems/problems.schema'
import { closeRound, createRound, openRound } from '../rounds/rounds.service'

import { SubmitSolutionBodySchema } from './submissions.schema'
import {
  acquireSubmissionSlot,
  findTeamIdForUser,
  getBestSubmission,
  releaseSubmissionSlot,
  resetSubmissionThrottle,
  type SubmitOutcome,
  scoreSubmission,
  submitSolution,
  toPersistedCaseResults,
  toResponseCases,
} from './submissions.service'

// Runs against the real dockerized Postgres (docker compose up -d) — the
// #35 migrations must already be applied.
const db = createDb()

beforeEach(async () => {
  await db.execute(
    sql`truncate table ${submissionsTable}, ${roundProblemsTable}, ${roundsTable}, ${problemTranslationsTable}, ${problemsTable}, ${teamMembersTable}, ${teamsTable}, ${usersTable} restart identity cascade`,
  )
})

afterAll(async () => {
  await db.$client.end()
})

async function insertProblem() {
  const [problem] = await db
    .insert(problemsTable)
    .values({ difficulty: 'easy', status: 'published' })
    .returning()
  if (!problem) throw new Error('expected a problem fixture')
  return problem
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
      .returning()

    expect(submission).toMatchObject({
      problemId: problem.id,
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
      userId: user.id,
      teamId: team.id,
      workspace: {},
      generatedCode: '',
      caseResults: [],
      score: 0,
      attemptNumber: 1,
    })

    await expect(
      db.insert(submissionsTable).values({
        problemId: problem.id,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 10,
        attemptNumber: 1,
      }),
    ).rejects.toThrow()
  })

  it('rejects deleting a problem that already has submissions', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()
    await db.insert(submissionsTable).values({
      problemId: problem.id,
      userId: user.id,
      teamId: team.id,
      workspace: {},
      generatedCode: '',
      caseResults: [],
      score: 0,
      attemptNumber: 1,
    })

    await expect(db.delete(problemsTable).where(eq(problemsTable.id, problem.id))).rejects.toThrow()
  })

  it('rejects deleting a team that already has submissions', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()
    await db.insert(submissionsTable).values({
      problemId: problem.id,
      userId: user.id,
      teamId: team.id,
      workspace: {},
      generatedCode: '',
      caseResults: [],
      score: 30,
      attemptNumber: 1,
    })

    await expect(db.delete(teamsTable).where(eq(teamsTable.id, team.id))).rejects.toThrow()
  })

  it('rejects deleting a user that already has submissions', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()
    await db.insert(submissionsTable).values({
      problemId: problem.id,
      userId: user.id,
      teamId: team.id,
      workspace: {},
      generatedCode: '',
      caseResults: [],
      score: 30,
      attemptNumber: 1,
    })

    await expect(db.delete(usersTable).where(eq(usersTable.id, user.id))).rejects.toThrow()
  })
})

describe('getBestSubmission', () => {
  it('returns null when the team has no submissions for the problem', async () => {
    const problem = await insertProblem()
    const team = await insertTeam()

    expect(await getBestSubmission(db, team.id, problem.id)).toBeNull()
  })

  it('returns the highest score, when it was reached and the attempt count', async () => {
    const problem = await insertProblem()
    const { user, team } = await insertTeamMember()
    const best = new Date('2026-08-31T12:00:00.000Z')
    await db.insert(submissionsTable).values([
      {
        problemId: problem.id,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 20,
        attemptNumber: 1,
        createdAt: new Date('2026-08-31T11:00:00.000Z'),
      },
      {
        problemId: problem.id,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 80,
        attemptNumber: 2,
        createdAt: best,
      },
      {
        problemId: problem.id,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 50,
        attemptNumber: 3,
        createdAt: new Date('2026-08-31T13:00:00.000Z'),
      },
    ])

    expect(await getBestSubmission(db, team.id, problem.id)).toEqual({
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
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 80,
        attemptNumber: 1,
        createdAt: earliest,
      },
      {
        problemId: problem.id,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 80,
        attemptNumber: 2,
        createdAt: new Date('2026-08-31T12:00:00.000Z'),
      },
    ])

    expect(await getBestSubmission(db, team.id, problem.id)).toEqual({
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
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 40,
        attemptNumber: 1,
        createdAt: own,
      },
      {
        problemId: problem.id,
        userId: otherUser.id,
        teamId: otherTeam.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 90,
        attemptNumber: 1,
      },
      {
        problemId: otherProblem.id,
        userId: user.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 95,
        attemptNumber: 1,
      },
    ])

    expect(await getBestSubmission(db, team.id, problem.id)).toEqual({
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

      expect(result).toMatchObject({ score: 100, maxScore: 100, attemptNumber: 1 })
      expect(result.cases.map((testCase) => testCase.index)).toEqual([0, 1, 2, 3])
      expect(result.cases.map((testCase) => testCase.hidden)).toEqual([false, false, true, true])

      const [row] = await db.select().from(submissionsTable)
      expect(row).toMatchObject({
        problemId: problem.id,
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

  describe('rankingChanged', () => {
    it(
      "is true on a team's first submission for a problem, scoring above zero",
      async () => {
        const problem = await insertPublishedProblem(solvableCases)
        const { user, team } = await insertTeamMember()

        const outcome = await submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        )

        expect(outcome).toMatchObject({ ok: true, rankingChanged: true })
      },
      JUDGED_TEST_TIMEOUT_MS,
    )

    it(
      'is false when the new submission only ties the existing best score',
      async () => {
        const problem = await insertPublishedProblem(solvableCases)
        const { user, team } = await insertTeamMember()
        await db.insert(submissionsTable).values({
          problemId: problem.id,
          userId: user.id,
          teamId: team.id,
          workspace: {},
          generatedCode: '',
          caseResults: [],
          score: 100,
          attemptNumber: 1,
        })

        const outcome = await submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        )

        expect(outcome).toMatchObject({ ok: true, rankingChanged: false })
      },
      JUDGED_TEST_TIMEOUT_MS,
    )

    it(
      'is true when the new submission beats the existing best score',
      async () => {
        const problem = await insertPublishedProblem(solvableCases)
        const { user, team } = await insertTeamMember()
        await db.insert(submissionsTable).values({
          problemId: problem.id,
          userId: user.id,
          teamId: team.id,
          workspace: {},
          generatedCode: '',
          caseResults: [],
          score: 50,
          attemptNumber: 1,
        })

        const outcome = await submitSolution(
          db,
          { userId: user.id, teamId: team.id },
          { problemId: problem.id, roundId: problem.roundId, workspace: solutionWorkspace },
        )

        expect(outcome).toMatchObject({ ok: true, rankingChanged: true })
      },
      JUDGED_TEST_TIMEOUT_MS,
    )
  })
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
