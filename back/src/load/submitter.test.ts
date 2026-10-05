import { generateSolution } from '@kumite/blocks'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app'
import { k } from '../context'
import { resetDatabase } from '../db/reset'

import { createRecorder } from './recorder'
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

async function world(runId: string, teams: number) {
  const recorder = createRecorder()
  recorder.setPhase('setup')
  const transport = createTransport({
    baseUrl: 'http://localhost',
    recorder,
    requestTimeoutMs: 60_000,
    fetch: async (input, init) => app.request(input, init),
  })
  const organizerToken = await loginOrganizer(transport, recorder, ORGANIZER)
  const built = await setupWorld({
    transport,
    recorder,
    organizerToken,
    runId,
    config: { teams, members: 1, setupConcurrency: 4, submissions: 1, durationSeconds: 60 },
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
    expect(snapshot.actions['submission']).toEqual({ started: 2, completed: 2 })
    expect(snapshot.http.load?.['POST /submissions']?.byStatus).toEqual({ '201': 2 })
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
