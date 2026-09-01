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
import type { TestCase } from '../problems/problems.schema'

import {
  acquireSubmissionSlot,
  getBestSubmission,
  releaseSubmissionSlot,
  resetSubmissionThrottle,
  scoreSubmission,
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

describe('submissions table', () => {
  it('records the problem, workspace, per-case results, score and timestamp', async () => {
    const problem = await insertProblem()

    const [submission] = await db
      .insert(submissionsTable)
      .values({
        problemId: problem.id,
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

  it('accepts a submission with no user and no team (pre-auth phase)', async () => {
    const problem = await insertProblem()

    const [submission] = await db
      .insert(submissionsTable)
      .values({
        problemId: problem.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 0,
        attemptNumber: 1,
      })
      .returning()

    expect(submission).toMatchObject({ userId: null, teamId: null })
  })

  it('rejects a second submission reusing the same team, problem and attempt number', async () => {
    const problem = await insertProblem()
    const team = await insertTeam()
    await db.insert(submissionsTable).values({
      problemId: problem.id,
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
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 10,
        attemptNumber: 1,
      }),
    ).rejects.toThrow()
  })

  it('allows two teamless submissions sharing the same problem and attempt number', async () => {
    const problem = await insertProblem()
    await db.insert(submissionsTable).values({
      problemId: problem.id,
      workspace: {},
      generatedCode: '',
      caseResults: [],
      score: 0,
      attemptNumber: 1,
    })

    await expect(
      db.insert(submissionsTable).values({
        problemId: problem.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 10,
        attemptNumber: 1,
      }),
    ).resolves.not.toThrow()
  })

  it('rejects deleting a problem that already has submissions', async () => {
    const problem = await insertProblem()
    await db.insert(submissionsTable).values({
      problemId: problem.id,
      workspace: {},
      generatedCode: '',
      caseResults: [],
      score: 0,
      attemptNumber: 1,
    })

    await expect(db.delete(problemsTable).where(eq(problemsTable.id, problem.id))).rejects.toThrow()
  })

  it('keeps the submission when its team is deleted, clearing the team', async () => {
    const problem = await insertProblem()
    const team = await insertTeam()
    const [submission] = await db
      .insert(submissionsTable)
      .values({
        problemId: problem.id,
        teamId: team.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 30,
        attemptNumber: 1,
      })
      .returning()
    if (!submission) throw new Error('expected a submission fixture')

    await db.delete(teamsTable).where(eq(teamsTable.id, team.id))

    const [kept] = await db
      .select()
      .from(submissionsTable)
      .where(eq(submissionsTable.id, submission.id))
    expect(kept).toMatchObject({ teamId: null, score: 30 })
  })

  it('keeps the submission when its user is deleted, clearing the user', async () => {
    const problem = await insertProblem()
    const user = await insertUser()
    const [submission] = await db
      .insert(submissionsTable)
      .values({
        problemId: problem.id,
        userId: user.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 30,
        attemptNumber: 1,
      })
      .returning()
    if (!submission) throw new Error('expected a submission fixture')

    await db.delete(usersTable).where(eq(usersTable.id, user.id))

    const [kept] = await db
      .select()
      .from(submissionsTable)
      .where(eq(submissionsTable.id, submission.id))
    expect(kept).toMatchObject({ userId: null, score: 30 })
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
    const team = await insertTeam()
    const best = new Date('2026-08-31T12:00:00.000Z')
    await db.insert(submissionsTable).values([
      {
        problemId: problem.id,
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
    const team = await insertTeam()
    const earliest = new Date('2026-08-31T11:00:00.000Z')
    await db.insert(submissionsTable).values([
      {
        problemId: problem.id,
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
    const team = await insertTeam('Time A')
    const otherTeam = await insertTeam('Time B')
    const own = new Date('2026-08-31T11:00:00.000Z')
    await db.insert(submissionsTable).values([
      {
        problemId: problem.id,
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
        teamId: otherTeam.id,
        workspace: {},
        generatedCode: '',
        caseResults: [],
        score: 90,
        attemptNumber: 1,
      },
      {
        problemId: otherProblem.id,
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
