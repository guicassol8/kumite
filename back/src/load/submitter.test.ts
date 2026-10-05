import { generateSolution } from '@kumite/blocks'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app'
import { k } from '../context'
import { resetDatabase } from '../db/reset'

import { createRecorder } from './recorder'
import { runSubmissions } from './submitter'
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
