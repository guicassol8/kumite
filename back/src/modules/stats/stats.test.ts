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
import { runJudgeAgainstWorker } from '../judge/judge.service'
import { createSseBus, runExpiryTick } from '../sse/sse.service'
import {
  acquireSubmissionSlot,
  recordAcceptedSubmission,
  resetSubmissionThrottle,
} from '../submissions/submissions.service'
import type { Role, University } from '../users/users.schema'

import { LiveStatsSchema, ProcessStatsSchema } from './stats.schema'
import { getEventStats, getLiveStats, getProcessStats, startProcessSampler } from './stats.service'

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

// --- Process metrics for the load harness (#136) ---
//
// Timing rule (#431): only one-sided assertions. CPU contention from another
// suite on the same machine can only make a window later or a delay longer,
// so every check below is a floor, and windows are awaited by polling with a
// wide deadline — never a fixed sleep.

async function waitFor<T>(read: () => T | undefined, deadlineMs = 15_000): Promise<T> {
  const started = Date.now()
  for (;;) {
    const value = read()
    if (value !== undefined) return value
    if (Date.now() - started > deadlineMs) throw new Error('waitFor: deadline passed')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

function busyWait(ms: number) {
  const until = performance.now() + ms
  while (performance.now() < until) {
    // spin: block the event loop on purpose
  }
}

describe('startProcessSampler', { timeout: 20_000 }, () => {
  let stop: (() => void) | undefined

  afterEach(() => {
    stop?.()
    stop = undefined
  })

  it('closes windows in order, each with bounded utilization', async () => {
    stop = startProcessSampler({ windowMs: 50, keep: 120 })

    const windows = await waitFor(() => {
      const current = getProcessStats().eventLoop.windows
      return current.length >= 3 ? current : undefined
    })

    for (let i = 1; i < windows.length; i++) {
      expect(windows[i]?.endedAt).toBeGreaterThanOrEqual(windows[i - 1]?.endedAt ?? 0)
    }
    for (const window of windows) {
      expect(window.utilization).toBeGreaterThanOrEqual(0)
      expect(window.utilization).toBeLessThanOrEqual(1)
      expect(Number.isFinite(window.delayP50Ms)).toBe(true)
      expect(Number.isFinite(window.delayP99Ms)).toBe(true)
      expect(Number.isFinite(window.delayMaxMs)).toBe(true)
    }
    expect(getProcessStats().eventLoop.windowMs).toBe(50)
  })

  it('records a blocked event loop as a delay of at least the block', async () => {
    stop = startProcessSampler({ windowMs: 50, keep: 120 })
    await waitFor(() => (getProcessStats().eventLoop.windows.length >= 1 ? true : undefined))

    busyWait(120)

    const blocked = await waitFor(() =>
      getProcessStats().eventLoop.windows.find((window) => window.delayMaxMs >= 100),
    )
    expect(blocked.delayMaxMs).toBeGreaterThanOrEqual(100)
  })

  it('keeps at most `keep` windows, dropping the oldest', async () => {
    stop = startProcessSampler({ windowMs: 20, keep: 3 })

    // Six windows closed means the ring has wrapped at least once.
    let closed = 0
    let lastEnd = 0
    await waitFor(() => {
      for (const window of getProcessStats().eventLoop.windows) {
        if (window.endedAt > lastEnd) {
          closed += 1
          lastEnd = window.endedAt
        }
      }
      return closed >= 6 ? true : undefined
    })

    const windows = getProcessStats().eventLoop.windows
    expect(windows.length).toBeLessThanOrEqual(3)
    expect(windows.at(-1)?.endedAt).toBeGreaterThanOrEqual(lastEnd)
  })

  it('empties the ring when stopped', async () => {
    stop = startProcessSampler({ windowMs: 20, keep: 10 })
    await waitFor(() => (getProcessStats().eventLoop.windows.length >= 1 ? true : undefined))

    stop()
    stop = undefined

    expect(getProcessStats().eventLoop.windows).toEqual([])
    expect(getProcessStats().eventLoop.windowMs).toBeNull()
  })

  it('reads CPU and memory without a sampler running', () => {
    const stats = getProcessStats()

    expect(stats.eventLoop.windows).toEqual([])
    expect(stats.cpu.userMicros + stats.cpu.systemMicros).toBeGreaterThan(0)
    expect(stats.memory.rss).toBeGreaterThan(0)
    expect(stats.memory.heapUsed).toBeGreaterThan(0)
    expect(stats.uptimeSeconds).toBeGreaterThan(0)
    expect(ProcessStatsSchema.parse(stats)).toEqual(stats)
  })
})

describe('GET /organizer/stats/process', { timeout: 20_000 }, () => {
  async function tokenFor(user: { id: string; role: Role; university: University }) {
    return signJwt(
      { role: user.role, university: user.university },
      { secret: JWT_SECRET, subject: user.id, expiresInSeconds: TOKEN_TTL_SECONDS },
    )
  }

  it('answers 401 without a token', async () => {
    const res = await app.request('/organizer/stats/process')
    expect(res.status).toBe(401)
  })

  it('answers 403 to a participant', async () => {
    const participant = await insertUser()
    const res = await app.request('/organizer/stats/process', {
      headers: { Authorization: `Bearer ${await tokenFor(participant)}` },
    })
    expect(res.status).toBe(403)
  })

  it('answers 200 to an organizer with the process metrics and the windows', async () => {
    const stop = startProcessSampler({ windowMs: 20, keep: 10 })
    try {
      await waitFor(() => (getProcessStats().eventLoop.windows.length >= 1 ? true : undefined))
      const organizer = await insertUser({ role: 'organizer' })

      const res = await app.request('/organizer/stats/process', {
        headers: { Authorization: `Bearer ${await tokenFor(organizer)}` },
      })

      expect(res.status).toBe(200)
      const body = ProcessStatsSchema.parse(await res.json())
      expect(body.memory.rss).toBeGreaterThan(0)
      expect(body.eventLoop.windows.length).toBeGreaterThanOrEqual(1)
    } finally {
      stop()
    }
  })
})

// #137/#138: the judge's and the fan-out's own timings, filtered by `since`
// so the harness polling once a second only receives what is new.
describe('process stats: judge and SSE timings', { timeout: 20_000 }, () => {
  const DOUBLE_WORKER_URL = new URL('../../judge-test-worker.mjs', import.meta.url)
  const judgeOnce = () =>
    runJudgeAgainstWorker(DOUBLE_WORKER_URL, 'unused', [{ input: 'a', expected: 'a' }], {
      timeoutMs: 2000,
      memoryMb: 64,
      concurrency: 4,
    })
  const heartbeatOnce = () => runExpiryTick(db, createSseBus())
  // The next millisecond, so `since` cleanly splits what came before it.
  const nextMillisecond = async () => {
    const now = Date.now()
    while (Date.now() <= now) await new Promise((resolve) => setTimeout(resolve, 1))
    return Date.now()
  }

  async function tokenFor(user: { id: string; role: Role; university: University }) {
    return signJwt(
      { role: user.role, university: user.university },
      { secret: JWT_SECRET, subject: user.id, expiresInSeconds: TOKEN_TTL_SECONDS },
    )
  }

  it('carries the judge config, the worker counters and the recorded runs and emissions', async () => {
    await judgeOnce()
    await heartbeatOnce()

    const stats = getProcessStats()

    expect(stats.judge.config.concurrency).toBe(JUDGE_CONCURRENCY)
    expect(stats.judge.workers.alive).toBe(stats.judge.workers.spawned - stats.judge.workers.exited)
    // #277: the warm pool's idle workers are alive ones.
    expect(stats.judge.workers.idle).toBeGreaterThanOrEqual(0)
    expect(stats.judge.workers.idle).toBeLessThanOrEqual(stats.judge.workers.alive)
    expect(stats.judge.runs.length).toBeGreaterThanOrEqual(1)
    expect(stats.sse.emissions.some((emission) => emission.kind === 'heartbeat')).toBe(true)
    expect(ProcessStatsSchema.parse(stats)).toEqual(stats)
  })

  it('drops what ended before `since` and keeps what ended after it', async () => {
    await judgeOnce()
    await heartbeatOnce()
    const before = getProcessStats()
    const oldRun = before.judge.runs.at(-1)?.seq
    const oldEmission = before.sse.emissions.at(-1)?.seq
    const since = await nextMillisecond()
    await judgeOnce()
    await heartbeatOnce()

    const stats = getProcessStats({ since })

    expect(stats.judge.runs.map((run) => run.seq)).not.toContain(oldRun)
    expect(stats.judge.runs).toHaveLength(1)
    expect(stats.sse.emissions.map((emission) => emission.seq)).not.toContain(oldEmission)
    expect(stats.sse.emissions).toHaveLength(1)
    expect(stats.sse.connects.every((connect) => connect.endedAt >= since)).toBe(true)
  })

  it('answers ?since= over HTTP, and refuses one that is not a non-negative integer', async () => {
    await judgeOnce()
    const organizer = await insertUser({ role: 'organizer' })
    const headers = { Authorization: `Bearer ${await tokenFor(organizer)}` }

    const all = await app.request('/organizer/stats/process?since=0', { headers })
    expect(all.status).toBe(200)
    const body = ProcessStatsSchema.parse(await all.json())
    expect(body.judge.runs.length).toBeGreaterThanOrEqual(1)

    const future = await app.request(`/organizer/stats/process?since=${Date.now() + 60_000}`, {
      headers,
    })
    expect(ProcessStatsSchema.parse(await future.json()).judge.runs).toEqual([])

    for (const since of ['-1', 'abc', '1.5']) {
      const res = await app.request(`/organizer/stats/process?since=${since}`, { headers })
      expect(res.status).toBe(422)
    }
  })
})
