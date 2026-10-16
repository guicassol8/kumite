import { generateSolution } from '@kumite/blocks'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app'
import { k } from '../context'
import { resetDatabase } from '../db/reset'
import { submissionsTable } from '../db/schema'
import { resetSubmissionThrottle } from '../modules/submissions/submissions.service'

import { createRecorder } from './recorder'
import { sleep } from './schedule'
import type { FetchLike } from './sse-client'
import { MAX_THROTTLE_RETRIES, runSubmissions } from './submitter'
import { createTransport } from './transport'
import { infiniteLoopWorkspace, somaDosPares } from './workspaces'
import { loginOrganizer, setupWorld } from './world'

// In-process, against the real judge. Timing rule (#431): the loop case
// takes a few seconds of judge timeouts, and nothing here asserts how long.

const db = k.resolve('db')
const ORGANIZER = { email: 'load-organizer@edu.pucrs.br', password: 'supersecret' }

beforeEach(async () => {
  process.env['ORGANIZER_EMAIL'] = ORGANIZER.email
  process.env['ORGANIZER_PASSWORD'] = ORGANIZER.password
  await resetDatabase(db)
})

afterAll(async () => {
  await db.$client.end()
})

describe('workspaces', () => {
  it('generates code for both workspaces without a codegen refusal', () => {
    expect(generateSolution(somaDosPares)).toContain('function')
    expect(generateSolution(infiniteLoopWorkspace)).toContain('while (true)')
  })
})

// The back's per-team cooldown is not what these tests are about: lifted
// before each submission, so a team can send several in a row.
const withoutCooldown: FetchLike = async (input, init) => {
  if (init?.method === 'POST' && new URL(input).pathname === '/submissions') {
    resetSubmissionThrottle()
  }
  return app.request(input, init)
}

async function world(runId: string, teams: number, problems = 1) {
  const recorder = createRecorder()
  recorder.setPhase('setup')
  const transport = createTransport({
    baseUrl: 'http://localhost',
    recorder,
    requestTimeoutMs: 60_000,
    fetch: withoutCooldown,
  })
  const organizerToken = await loginOrganizer(transport, recorder, ORGANIZER)
  const built = await setupWorld({
    transport,
    recorder,
    organizerToken,
    runId,
    config: {
      teams,
      members: 1,
      setupConcurrency: 4,
      submissions: 1,
      durationSeconds: 60,
      problems,
    },
  })
  recorder.setPhase('load')
  return { recorder, transport, built }
}

describe('runSubmissions', { timeout: 120_000 }, () => {
  it('sends one correct submission per team, each accepted and coherent', async () => {
    const { recorder, transport, built } = await world('subs', 2)

    await runSubmissions({
      transport,
      recorder,
      world: built,
      config: { submissions: 2, badFraction: 0, cooldownMs: 0 },
      deadline: Date.now() + 60_000,
    })

    const snapshot = recorder.snapshot()
    expect(snapshot.verdicts).toEqual({ matrix: { correct: { accepted: 2 } }, incoherent: 0 })
    expect(snapshot.submissions.latencyMs.correct?.count).toBe(2)
    expect(snapshot.actions['submission']).toEqual({ started: 2, completed: 2 })
    expect(snapshot.http.load?.['POST /submissions']?.byStatus).toEqual({ '201': 2 })
  })

  it('rotates each team’s submissions over the round’s problems (#138)', async () => {
    const { recorder, transport, built } = await world('rota', 2, 3)

    await runSubmissions({
      transport,
      recorder,
      world: built,
      config: { submissions: 6, badFraction: 0, memoryShare: 0, cooldownMs: 0 },
      deadline: Date.now() + 60_000,
    })

    expect(recorder.snapshot().verdicts).toEqual({
      matrix: { correct: { accepted: 6 } },
      incoherent: 0,
    })
    const rows = await db.select().from(submissionsTable)
    for (const team of built.teams) {
      const problems = rows.filter((row) => row.teamId === team.id).map((row) => row.problemId)
      expect(problems.sort()).toEqual([...built.problemIds].sort())
    }
  })

  it('gives each team its own share, whatever team is slower (#453)', async () => {
    const { recorder, built } = await world('share', 2, 3)
    // Team 1 holds its first submission until team 0 has had three answered:
    // with a pool shared by the teams, team 0 took the rest meanwhile.
    const [team0, team1] = built.teams.map((team) => `Bearer ${team.members[0]?.token}`)
    let answeredToTeam0 = 0
    let release = () => {}
    const team0Done = new Promise<void>((resolve) => {
      release = resolve
    })
    const slowTeam1: FetchLike = async (input, init) => {
      if (init?.method !== 'POST' || new URL(input).pathname !== '/submissions') {
        return withoutCooldown(input, init)
      }
      const auth = new Headers(init.headers).get('authorization')
      if (auth === team1) await team0Done
      const res = await withoutCooldown(input, init)
      if (auth === team0 && ++answeredToTeam0 === 3) release()
      return res
    }
    const transport = createTransport({
      baseUrl: 'http://localhost',
      recorder,
      requestTimeoutMs: 60_000,
      fetch: slowTeam1,
    })

    await runSubmissions({
      transport,
      recorder,
      world: built,
      config: { submissions: 6, badFraction: 0, memoryShare: 0, cooldownMs: 0 },
      deadline: Date.now() + 60_000,
    })

    expect(recorder.snapshot().verdicts).toEqual({
      matrix: { correct: { accepted: 6 } },
      incoherent: 0,
    })
    const rows = await db.select().from(submissionsTable)
    for (const team of built.teams) {
      const problems = rows.filter((row) => row.teamId === team.id).map((row) => row.problemId)
      expect(problems.sort()).toEqual([...built.problemIds].sort())
    }
  })

  it('sleeps no cooldown after a team’s last submission (#453)', async () => {
    const { recorder, transport, built } = await world('last', 2)
    // An hour of cooldown: one slept after either team's only submission
    // would hold the run far past the race below.
    const controller = new AbortController()
    const run = runSubmissions({
      transport,
      recorder,
      world: built,
      config: { submissions: 2, badFraction: 0, cooldownMs: 3_600_000 },
      deadline: Date.now() + 60_000,
      signal: controller.signal,
    }).then(() => 'resolved' as const)
    const held = sleep(60_000, controller.signal).then(() => 'held in a cooldown' as const)

    const outcome = await Promise.race([run, held])
    controller.abort()
    await run

    expect(outcome).toBe('resolved')
    expect(recorder.snapshot().verdicts).toEqual({
      matrix: { correct: { accepted: 2 } },
      incoherent: 0,
    })
  })

  it('sends the memory bomb and gets a coherent runtime error back (#137)', async () => {
    const { recorder, transport, built } = await world('bomb', 1)

    await runSubmissions({
      transport,
      recorder,
      world: built,
      config: { submissions: 1, badFraction: 1, memoryShare: 1, cooldownMs: 0 },
      deadline: Date.now() + 60_000,
    })

    const snapshot = recorder.snapshot()
    expect(snapshot.verdicts).toEqual({ matrix: { memory: { runtime_error: 1 } }, incoherent: 0 })
    expect(snapshot.submissions.latencyMs.memory?.count).toBe(1)
  })

  it('sends the infinite loop and gets a coherent timeout back', async () => {
    const { recorder, transport, built } = await world('loop', 1)

    await runSubmissions({
      transport,
      recorder,
      world: built,
      config: { submissions: 1, badFraction: 1, cooldownMs: 0 },
      deadline: Date.now() + 60_000,
    })

    const snapshot = recorder.snapshot()
    expect(snapshot.verdicts).toEqual({ matrix: { loop: { timeout: 1 } }, incoherent: 0 })
    expect(snapshot.actions['submission']).toEqual({ started: 1, completed: 1 })
  })

  // The first `count` POST /submissions answer 429 the way the back's throttle
  // does; everything else reaches the app.
  function throttlingFirst(count: number): FetchLike {
    let left = count
    return async (input, init) => {
      if (init?.method === 'POST' && new URL(input).pathname === '/submissions' && left > 0) {
        left -= 1
        return Response.json(
          { error: 'submission_throttled', message: 'throttled' },
          { status: 429 },
        )
      }
      return app.request(input, init)
    }
  }

  it('waits and retries a 429, then counts the verdict of the retry', async () => {
    const { recorder, built } = await world('retry', 1)
    const transport = createTransport({
      baseUrl: 'http://localhost',
      recorder,
      requestTimeoutMs: 60_000,
      fetch: throttlingFirst(MAX_THROTTLE_RETRIES),
    })

    await runSubmissions({
      transport,
      recorder,
      world: built,
      config: { submissions: 1, badFraction: 0, cooldownMs: 0 },
      deadline: Date.now() + 60_000,
    })

    const snapshot = recorder.snapshot()
    expect(snapshot.verdicts).toEqual({ matrix: { correct: { accepted: 1 } }, incoherent: 0 })
    expect(snapshot.actions['submission']).toEqual({ started: 1, completed: 1 })
    expect(snapshot.http.load?.['POST /submissions']?.byStatus).toEqual({
      '201': 1,
      '429:submission_throttled': MAX_THROTTLE_RETRIES,
    })
    expect(snapshot.unexpected).toEqual([])
  })

  it('gives up after the last retry and counts the submission as rejected', async () => {
    const { recorder, built } = await world('giveup', 1)
    const transport = createTransport({
      baseUrl: 'http://localhost',
      recorder,
      requestTimeoutMs: 60_000,
      fetch: throttlingFirst(MAX_THROTTLE_RETRIES + 1),
    })

    await runSubmissions({
      transport,
      recorder,
      world: built,
      config: { submissions: 1, badFraction: 0, cooldownMs: 0 },
      deadline: Date.now() + 60_000,
    })

    const snapshot = recorder.snapshot()
    // A 429 is never an unexpected status; running out of retries shows up
    // as an incoherent verdict instead, which fails the run.
    expect(snapshot.verdicts).toEqual({
      matrix: { correct: { 'rejected:submission_throttled': 1 } },
      incoherent: 1,
    })
    expect(snapshot.actions['submission']).toEqual({ started: 1, completed: 1 })
    expect(snapshot.http.load?.['POST /submissions']?.byStatus).toEqual({
      '429:submission_throttled': MAX_THROTTLE_RETRIES + 1,
    })
    expect(snapshot.unexpected).toEqual([])
  })

  // #138: undici's error when the back closes an idle keep-alive socket as
  // the harness reuses it — before any byte of a response.
  const staleSocket = () =>
    new TypeError('fetch failed', {
      cause: {
        code: 'UND_ERR_SOCKET',
        message: 'other side closed',
        socket: { bytesWritten: 4144, bytesRead: 695 },
      },
    })

  function failingFirst(errors: Array<() => Error>): FetchLike {
    const left = [...errors]
    return async (input, init) => {
      const next = left.shift()
      if (next && init?.method === 'POST' && new URL(input).pathname === '/submissions') {
        throw next()
      }
      return withoutCooldown(input, init)
    }
  }

  async function submitThrough(fetch: FetchLike, runId: string, resendStale = true) {
    const { recorder, built } = await world(runId, 1)
    const transport = createTransport({
      baseUrl: 'http://localhost',
      recorder,
      requestTimeoutMs: 60_000,
      fetch,
      resendStale,
    })
    await runSubmissions({
      transport,
      recorder,
      world: built,
      config: { submissions: 1, badFraction: 0, cooldownMs: 0 },
      deadline: Date.now() + 60_000,
    })
    return recorder.snapshot()
  }

  it('retries once a POST whose reused socket closed before any response, and counts it', async () => {
    const snapshot = await submitThrough(failingFirst([staleSocket]), 'stale')

    expect(snapshot.verdicts).toEqual({ matrix: { correct: { accepted: 1 } }, incoherent: 0 })
    expect(snapshot.actions['submission']).toEqual({ started: 1, completed: 1 })
    expect(snapshot.retries).toEqual([
      {
        phase: 'load',
        route: 'POST /submissions',
        reason: 'UND_ERR_SOCKET · request · reused',
        count: 1,
      },
    ])
    expect(snapshot.http.load?.['POST /submissions']).toMatchObject({
      networkErrors: 1,
      byStatus: { '201': 1, network: 1 },
    })
  })

  it('does not resend at all without --resend-stale: the failure stands, as through Caddy', async () => {
    const snapshot = await submitThrough(failingFirst([staleSocket]), 'nostale', false)

    expect(snapshot.actions['submission']).toEqual({ started: 1, completed: 0 })
    expect(snapshot.retries).toEqual([])
  })

  it('retries only once: a second stale socket leaves the submission unfinished', async () => {
    const snapshot = await submitThrough(failingFirst([staleSocket, staleSocket]), 'stale2')

    expect(snapshot.actions['submission']).toEqual({ started: 1, completed: 0 })
    expect(snapshot.retries[0]?.count).toBe(1)
    expect(snapshot.http.load?.['POST /submissions']?.networkErrors).toBe(2)
  })

  it('never retries any other network error', async () => {
    const refused = () => new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } })
    const fresh = () =>
      new TypeError('fetch failed', {
        cause: { code: 'UND_ERR_SOCKET', socket: { bytesWritten: 2000, bytesRead: 0 } },
      })
    for (const [error, runId] of [
      [refused, 'refused'],
      [fresh, 'fresh'],
    ] as const) {
      const snapshot = await submitThrough(failingFirst([error]), runId)
      expect(snapshot.actions['submission']).toEqual({ started: 1, completed: 0 })
      expect(snapshot.retries).toEqual([])
    }
  })

  it('starts nothing once the deadline has passed', async () => {
    const { recorder, transport, built } = await world('late', 1)

    await runSubmissions({
      transport,
      recorder,
      world: built,
      config: { submissions: 5, badFraction: 0, cooldownMs: 0 },
      deadline: Date.now() - 1,
    })

    expect(recorder.snapshot().actions['submission']).toBeUndefined()
  })
})
