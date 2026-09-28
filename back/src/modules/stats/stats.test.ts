import { signJwt } from '@katajs-framework/core/jwt'
import { sql } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../../app'
import { JUDGE_CONCURRENCY, JWT_SECRET, TOKEN_TTL_SECONDS } from '../../config'
import { k } from '../../context'
import { createDb } from '../../db/client'
import {
  eventConfigTable,
  problemsTable,
  roundProblemsTable,
  roundsTable,
  submissionsTable,
  teamMembersTable,
  teamsTable,
  usersTable,
} from '../../db/schema'
import {
  acquireSubmissionSlot,
  recordAcceptedSubmission,
  resetSubmissionThrottle,
} from '../submissions/submissions.service'
import type { Role, University } from '../users/users.schema'

import { LiveStatsSchema } from './stats.schema'
import { getEventStats, getLiveStats } from './stats.service'

// Runs against the real dockerized Postgres (docker compose up -d), same as
// the other DB-backed service suites.
const db = createDb()

beforeEach(async () => {
  await db.execute(
    sql`truncate table ${submissionsTable}, ${roundProblemsTable}, ${roundsTable}, ${problemsTable}, ${teamMembersTable}, ${teamsTable}, ${eventConfigTable}, ${usersTable} restart identity cascade`,
  )
})

afterAll(async () => {
  await db.$client.end()
  // The app's own client, opened by the HTTP suite below.
  await k.resolve('db').$client.end()
})

let userCounter = 0

async function insertUser(
  options: { university?: University; role?: Role; active?: boolean } = {},
) {
  userCounter += 1
  const [user] = await db
    .insert(usersTable)
    .values({
      email: `stats-fixture-${userCounter}@edu.pucrs.br`,
      passwordHash: 'hash',
      role: options.role ?? 'participant',
      university: options.university ?? 'pucrs',
      active: options.active ?? true,
    })
    .returning()
  if (!user) throw new Error('expected a user fixture')
  return user
}

async function insertTeam(name: string, options: { removedAt?: Date } = {}) {
  const [team] = await db
    .insert(teamsTable)
    .values({ name, removedAt: options.removedAt ?? null })
    .returning()
  if (!team) throw new Error('expected a team fixture')
  return team
}

async function joinTeam(userId: string, teamId: string) {
  await db.insert(teamMembersTable).values({ userId, teamId })
}

async function insertProblem() {
  const [problem] = await db
    .insert(problemsTable)
    .values({ difficulty: 'easy', status: 'published' })
    .returning()
  if (!problem) throw new Error('expected a problem fixture')
  return problem
}

async function insertRound(
  name: string,
  fields: Partial<typeof roundsTable.$inferInsert> = {},
): Promise<typeof roundsTable.$inferSelect> {
  const [round] = await db
    .insert(roundsTable)
    .values({ name, durationMinutes: 60, ...fields })
    .returning()
  if (!round) throw new Error('expected a round fixture')
  return round
}

async function addRoundProblem(roundId: string, problemId: string, position = 0) {
  await db.insert(roundProblemsTable).values({ roundId, problemId, position })
}

let attemptCounter = 0

// roundId is the round the submission was stamped with at accept time (#176).
// `inRound` reads that stamp, never createdAt, so the fixtures below can put a
// row's createdAt anywhere and it still counts for the round it carries.
async function submit(teamId: string, problemId: string, roundId: string, createdAt?: Date) {
  const user = await insertUser()
  attemptCounter += 1
  await db.insert(submissionsTable).values({
    problemId,
    roundId,
    teamId,
    userId: user.id,
    workspace: {},
    generatedCode: '',
    caseResults: [],
    score: 100,
    attemptNumber: attemptCounter,
    acceptedAt: new Date(),
    ...(createdAt ? { createdAt } : {}),
  })
}

describe('getEventStats participants', () => {
  it('counts active participants per university, ignoring organizers and deactivated accounts', async () => {
    await insertUser({ university: 'pucrs' })
    await insertUser({ university: 'pucrs' })
    await insertUser({ university: 'merida' })
    await insertUser({ university: 'merida', role: 'organizer' })
    await insertUser({ university: 'pucrs', active: false })

    const stats = await getEventStats(db)

    expect(stats.participants.total).toBe(3)
    expect(stats.participants.pucrs).toBe(2)
    expect(stats.participants.merida).toBe(1)
  })

  it('splits participants into inTeam and withoutTeam, summing to the total', async () => {
    const team = await insertTeam('Time A')
    const inTeam = await insertUser()
    await joinTeam(inTeam.id, team.id)
    await insertUser()
    await insertUser()

    const stats = await getEventStats(db)

    expect(stats.participants.inTeam).toBe(1)
    expect(stats.participants.withoutTeam).toBe(2)
    expect(stats.participants.inTeam + stats.participants.withoutTeam).toBe(
      stats.participants.total,
    )
  })

  it('counts a deactivated member as neither inTeam nor withoutTeam', async () => {
    const team = await insertTeam('Time A')
    const inactive = await insertUser({ active: false })
    await joinTeam(inactive.id, team.id)

    const stats = await getEventStats(db)

    expect(stats.participants.total).toBe(0)
    expect(stats.participants.inTeam).toBe(0)
    expect(stats.participants.withoutTeam).toBe(0)
  })
})

describe('getEventStats teams', () => {
  it('ignores removed teams and puts their ex-members back in withoutTeam', async () => {
    // removeTeam (#50) deletes the team_members rows and only marks the team
    // removedAt, so the orphaned member has no membership row at all.
    const removed = await insertTeam('Time removido', { removedAt: new Date() })
    const orphan = await insertUser()
    const active = await insertTeam('Time ativo')
    const member = await insertUser()
    await joinTeam(member.id, active.id)

    const stats = await getEventStats(db)

    expect(stats.teams.total).toBe(1)
    expect(stats.participants.withoutTeam).toBe(1)
    expect(stats.participants.inTeam).toBe(1)
    expect(orphan.id).not.toBe(member.id)
    expect(removed.removedAt).not.toBeNull()
  })

  it('reports openSlots as the free seats across active teams', async () => {
    await db.insert(eventConfigTable).values({ id: 1, maxTeamSize: 3 })
    const teamA = await insertTeam('Time A')
    const teamB = await insertTeam('Time B')
    const first = await insertUser()
    const second = await insertUser()
    await joinTeam(first.id, teamA.id)
    await joinTeam(second.id, teamB.id)

    const stats = await getEventStats(db)

    expect(stats.teams.maxTeamSize).toBe(3)
    expect(stats.teams.openSlots).toBe(4)
  })

  it('clamps openSlots at zero per team when maxTeamSize was reduced after forming', async () => {
    await db.insert(eventConfigTable).values({ id: 1, maxTeamSize: 1 })
    const crowded = await insertTeam('Time cheio')
    const roomy = await insertTeam('Time vazio')
    for (let i = 0; i < 3; i += 1) {
      const member = await insertUser()
      await joinTeam(member.id, crowded.id)
    }

    const stats = await getEventStats(db)

    // The over-full team contributes 0, not -2, so the roomy team's single
    // free seat is what's left.
    expect(stats.teams.openSlots).toBe(1)
    expect(roomy.id).toBeDefined()
  })
})

describe('getEventStats submissions and rounds', () => {
  it('reports no round and a null inRound when the event has no round yet', async () => {
    const team = await insertTeam('Time A')
    const problem = await insertProblem()
    // A draft round: submissions.round_id is NOT NULL (#176), and a draft is
    // neither active nor last-closed, so the event still has no round to report.
    const draft = await insertRound('Rascunho')
    await addRoundProblem(draft.id, problem.id)
    await submit(team.id, problem.id, draft.id)

    const stats = await getEventStats(db)

    expect(stats.round.active).toBeNull()
    expect(stats.round.lastClosed).toBeNull()
    expect(stats.submissions.total).toBe(1)
    expect(stats.submissions.inRound).toBeNull()
  })

  it('counts a submission whose judging ends after the round closed in inRound', async () => {
    // The accept gate stamps round_id while the round is open; judging can
    // finish (and createdAt land) after closedAt. The stamp decides, not time.
    const team = await insertTeam('Time A')
    const problem = await insertProblem()
    const closedAt = new Date(Date.now() - 30 * 60_000)
    const round = await insertRound('Rodada 1', {
      status: 'closed',
      openedAt: new Date(Date.now() - 90 * 60_000),
      closesAt: closedAt,
      closedAt,
    })
    await addRoundProblem(round.id, problem.id)

    await submit(team.id, problem.id, round.id, new Date(closedAt.getTime() + 2 * 60_000))

    const stats = await getEventStats(db)

    expect(stats.round.lastClosed?.id).toBe(round.id)
    expect(stats.submissions.total).toBe(1)
    expect(stats.submissions.inRound).toBe(1)
  })

  it('counts only submissions stamped with the open round, even when a row stamped with another round falls in its window', async () => {
    const team = await insertTeam('Time A')
    const problem = await insertProblem()
    const older = await insertRound('Rodada 1', {
      status: 'closed',
      openedAt: new Date(Date.now() - 120 * 60_000),
      closesAt: new Date(Date.now() - 60 * 60_000),
      closedAt: new Date(Date.now() - 60 * 60_000),
    })
    const openedAt = new Date(Date.now() - 10 * 60_000)
    const open = await insertRound('Rodada 2', {
      status: 'open',
      openedAt,
      closesAt: new Date(Date.now() + 30 * 60_000),
    })
    await addRoundProblem(older.id, problem.id)
    await addRoundProblem(open.id, problem.id)

    // Stamped with the older round, yet created inside the open round's window.
    await submit(team.id, problem.id, older.id, new Date(openedAt.getTime() + 30_000))
    await submit(team.id, problem.id, open.id, new Date(openedAt.getTime() + 60_000))
    await submit(team.id, problem.id, open.id, new Date(openedAt.getTime() + 120_000))

    const stats = await getEventStats(db)

    expect(stats.submissions.total).toBe(3)
    expect(stats.submissions.inRound).toBe(2)
    expect(stats.round.active?.id).toBe(open.id)
    expect(stats.round.lastClosed?.id).toBe(older.id)
  })

  it('falls back to the last closed round as the reference when none is open', async () => {
    const team = await insertTeam('Time A')
    const problem = await insertProblem()
    const older = await insertRound('Rodada 1', {
      status: 'closed',
      openedAt: new Date(Date.now() - 180 * 60_000),
      closesAt: new Date(Date.now() - 150 * 60_000),
      closedAt: new Date(Date.now() - 150 * 60_000),
    })
    const newest = await insertRound('Rodada 2', {
      status: 'closed',
      openedAt: new Date(Date.now() - 120 * 60_000),
      closesAt: new Date(Date.now() - 90 * 60_000),
      closedAt: new Date(Date.now() - 90 * 60_000),
    })
    await addRoundProblem(older.id, problem.id)
    await addRoundProblem(newest.id, problem.id)

    await submit(team.id, problem.id, older.id, new Date(Date.now() - 170 * 60_000))
    await submit(team.id, problem.id, newest.id, new Date(Date.now() - 110 * 60_000))
    await submit(team.id, problem.id, newest.id, new Date(Date.now() - 100 * 60_000))

    const stats = await getEventStats(db)

    expect(stats.round.active).toBeNull()
    expect(stats.round.lastClosed?.id).toBe(newest.id)
    expect(stats.submissions.total).toBe(3)
    expect(stats.submissions.inRound).toBe(2)
  })

  it('never reports a round past its closesAt as active — it reaps first', async () => {
    const round = await insertRound('Rodada vencida', {
      status: 'open',
      openedAt: new Date(Date.now() - 90 * 60_000),
      closesAt: new Date(Date.now() - 30 * 60_000),
    })

    const stats = await getEventStats(db)

    expect(stats.round.active).toBeNull()
    expect(stats.round.lastClosed?.id).toBe(round.id)
    expect(stats.round.lastClosed?.status).toBe('closed')
  })

  it('reports zeros on a completely empty event', async () => {
    const stats = await getEventStats(db)

    expect(stats.participants).toEqual({
      total: 0,
      pucrs: 0,
      merida: 0,
      inTeam: 0,
      withoutTeam: 0,
    })
    expect(stats.teams).toEqual({ total: 0, openSlots: 0, maxTeamSize: 3 })
    expect(stats.submissions).toEqual({ total: 0, inRound: null })
    expect(stats.round).toEqual({ active: null, lastClosed: null })
  })
})

// --- Organizer live card (#279) ---

describe('getLiveStats', () => {
  beforeEach(() => {
    resetSubmissionThrottle()
  })

  it('composes the judge queue, the SSE connections and the submission load', () => {
    const now = 50_000_000
    recordAcceptedSubmission(now - 30_000)
    recordAcceptedSubmission(now - 90_000)
    acquireSubmissionSlot('team:a', now)

    const live = getLiveStats({ connections: () => 7 }, now)

    expect(live).toEqual({
      judge: { inFlight: 0, waiting: 0, concurrency: JUDGE_CONCURRENCY },
      sse: { connections: 7 },
      submissions: {
        inFlight: 1,
        lastMinute: 1,
        perMinute: [...Array(13).fill(0), 1, 1],
      },
    })
    expect(LiveStatsSchema.parse(live)).toEqual(live)
  })
})

describe('GET /organizer/stats/live', () => {
  const appDb = k.resolve('db')

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // A2: "without touching the database" is the handler and the service. The
  // one query per request left is requireUser's findUserById, fail-closed by
  // design (#174, ADR-0004) — pinned here so a second one cannot creep in.
  it('answers 100 parallel requests with no query beyond the auth lookup', async () => {
    const organizer = await insertUser({ role: 'organizer' })
    const token = await signJwt(
      { role: organizer.role, university: organizer.university },
      { secret: JWT_SECRET, subject: organizer.id, expiresInSeconds: TOKEN_TTL_SECONDS },
    )
    // Every statement drizzle's postgres-js driver sends goes through one of
    // these two: plain queries through unsafe(), transactions through begin().
    const unsafe = vi.spyOn(appDb.$client, 'unsafe')
    const begin = vi.spyOn(appDb.$client, 'begin')

    const responses = await Promise.all(
      Array.from({ length: 100 }, () =>
        app.request('/organizer/stats/live', { headers: { Authorization: `Bearer ${token}` } }),
      ),
    )

    expect(responses.map((res) => res.status)).toEqual(Array(100).fill(200))
    expect(unsafe).toHaveBeenCalledTimes(100)
    expect(begin).not.toHaveBeenCalled()

    const body = LiveStatsSchema.parse(await responses[0]?.json())
    expect(body.judge.concurrency).toBe(JUDGE_CONCURRENCY)
    expect(body.submissions.perMinute).toHaveLength(15)
  })
})
