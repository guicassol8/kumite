import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app'
import { k } from '../context'
import { resetDatabase } from '../db/reset'
import { runExpiryTick, runRankingTick } from '../modules/sse/sse.service'
import { startProcessSampler } from '../modules/stats/stats.service'
import { resetSubmissionThrottle } from '../modules/submissions/submissions.service'

import { type LoadConfig, PRESETS } from './config'
import { exitCodeFor, runScenario } from './scenarios'
import type { FetchLike } from './sse-client'

// The whole run, in-process: app.fetch as the transport, the suite's own
// test database, the back's process sampler and its heartbeat tick switched
// on here the way main.ts does it. Timing rule (#431): only counts and the
// presence of sections are asserted — never a latency or a duration.

const db = k.resolve('db')
const ORGANIZER = { email: 'load-organizer@edu.pucrs.br', password: 'supersecret' }
const inProcess: FetchLike = async (input, init) => app.request(input, init)

let stopSampler: (() => void) | undefined
let tick: ReturnType<typeof setInterval> | undefined

beforeEach(async () => {
  process.env['ORGANIZER_EMAIL'] = ORGANIZER.email
  process.env['ORGANIZER_PASSWORD'] = ORGANIZER.password
  await resetDatabase(db)
  stopSampler = startProcessSampler({ windowMs: 100, keep: 600 })
  // Both ticks, as main.ts wires them: the settle phase compares the last
  // ranking.updated with the API, so the debounced emission must run.
  tick = setInterval(() => {
    void runExpiryTick(db, k.resolve('sseBus')).catch(() => {})
    void runRankingTick(db, k.resolve('sseBus')).catch(() => {})
  }, 200)
})

afterEach(() => {
  stopSampler?.()
  clearInterval(tick)
})

afterAll(async () => {
  await db.$client.end()
})

const minimal: LoadConfig = {
  ...PRESETS.smoke,
  scenario: 'smoke',
  url: 'http://localhost',
  teams: 2,
  members: 1,
  sse: 2,
  submissions: 2,
  badFraction: 0,
  restSeconds: 0,
  durationSeconds: 1,
  sampleIntervalMs: 100,
  cooldownMs: 0,
  out: '/tmp',
  allowRemote: false,
  organizerEmail: ORGANIZER.email,
  organizerPassword: ORGANIZER.password,
}

function subjectOf(authorization: string | null): string | null {
  const payload = authorization?.replace(/^Bearer /, '').split('.')[1]
  if (!payload) return null
  const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  return claims && typeof claims === 'object' && 'sub' in claims && typeof claims.sub === 'string'
    ? claims.sub
    : null
}

describe('runScenario', { timeout: 120_000 }, () => {
  it('runs a minimal smoke end to end with no failure and every section filled', async () => {
    const report = await runScenario({ config: minimal, fetch: inProcess, runId: 'mini' })

    expect(report.failures).toEqual([])
    expect(report.status).toBe('PASS')
    expect(exitCodeFor(report)).toBe(0)
    expect(report.phases.map((phase) => phase.phase)).toEqual([
      'rest',
      'setup',
      'sse-ramp',
      'load',
      'settle',
      'teardown',
    ])
    expect(report.settle?.drain.drained).toBe(true)
    expect(report.settle?.consistency).toMatchObject({ compared: 2, matchesApi: true })
    expect(report.world).toMatchObject({ teams: 2, participants: 2 })
    expect(report.verdicts).toEqual({ matrix: { correct: { accepted: 2 } }, incoherent: 0 })
    expect(report.actions['submission']).toEqual({ started: 2, completed: 2 })
    expect(report.http.setup?.['POST /auth/signup']?.byStatus).toEqual({ '201': 2 })
    expect(report.http.load?.['POST /submissions']?.byStatus).toEqual({ '201': 2 })
    expect(report.sse).toMatchObject({ requested: 2, opened: 2, closedByHarness: 2, dropped: 0 })
    expect(report.sse.eventsPerConnection['state.sync']).toEqual({ min: 1, mean: 1, max: 1 })
    expect(report.timeline.samples.length).toBeGreaterThan(0)
    expect(report.timeline.windows.length).toBeGreaterThan(0)
    expect(report.phases.find((phase) => phase.phase === 'load')?.rssMaxBytes).toBeGreaterThan(0)
  })

  it('runs a mini burst: every kind coherent, the judge drained, one ranking before and after the storm', async () => {
    // The per-team cooldown is not what this is about: lifted before each
    // submission so a team can send its two in a row.
    const withoutCooldown: FetchLike = async (input, init) => {
      if (init?.method === 'POST' && new URL(input).pathname === '/submissions') {
        resetSubmissionThrottle()
      }
      return app.request(input, init)
    }
    const config: LoadConfig = {
      ...PRESETS.burst,
      scenario: 'burst',
      url: 'http://localhost',
      teams: 2,
      members: 1,
      sse: 2,
      submissions: 4,
      badFraction: 0.5,
      memoryShare: 0.5,
      problems: 2,
      restSeconds: 0,
      durationSeconds: 60,
      sampleIntervalMs: 100,
      cooldownMs: 0,
      out: '/tmp',
      allowRemote: false,
      organizerEmail: ORGANIZER.email,
      organizerPassword: ORGANIZER.password,
    }

    const report = await runScenario({ config, fetch: withoutCooldown, runId: 'miniburst' })

    expect(report.failures).toEqual([])
    expect(report.status).toBe('PASS')
    expect(report.phases.map((phase) => phase.phase)).toEqual([
      'rest',
      'setup',
      'sse-ramp',
      'load',
      'settle',
      'storm',
      'teardown',
    ])
    expect(report.verdicts).toEqual({
      matrix: {
        correct: { accepted: 2 },
        loop: { timeout: 1 },
        memory: { runtime_error: 1 },
      },
      incoherent: 0,
    })
    expect(report.world?.problemIds).toHaveLength(2)
    // The warm pool's idle workers stay alive (#277): drained means every
    // live worker is an idle one.
    expect(report.settle?.drain.drained).toBe(true)
    expect(report.settle?.drain.workersAlive).toBe(report.settle?.drain.workersIdle)
    expect(report.settle?.consistency).toMatchObject({
      compared: 2,
      distinctDigests: 1,
      matchesApi: true,
    })
    expect(report.storm).toMatchObject({
      requested: 2,
      sse: { opened: 2, failedToOpen: 0, dropped: 0 },
      consistency: { compared: 2, distinctDigests: 1, matchesApi: true },
    })
    expect(report.storm?.consistency.apiDigest).toBe(report.settle?.consistency.apiDigest)
    expect(report.judge?.byOutcome).toEqual({ passed: 2, timeout: 1, runtime_error: 1 })
    expect(report.judge?.workers?.alive).toBe(report.judge?.workers?.idle)
    expect(report.sse.closedByHarness).toBe(2)
    expect(Object.keys(report.submissions.latencyMs).sort()).toEqual(['correct', 'loop', 'memory'])
  })

  it('counts an injected 500 and a dropped SSE connection, finishes the run and fails it', async () => {
    const organizerLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ORGANIZER),
    })
    const { token: organizerToken } = (await organizerLogin.json()) as { token: string }

    let injected = false
    const faulty: FetchLike = async (input, init) => {
      const url = new URL(input)
      if (!injected && init?.method === 'POST' && url.pathname === '/submissions') {
        injected = true
        // The submitting user is banned mid-run: its open /sse stream drops.
        const subject = subjectOf(new Headers(init.headers).get('Authorization'))
        await app.request(`/organizer/users/${subject}/deactivate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${organizerToken}` },
        })
        return Response.json({ error: 'internal', message: 'injected' }, { status: 500 })
      }
      return app.request(input, init)
    }

    const report = await runScenario({ config: minimal, fetch: faulty, runId: 'faulty' })

    expect(report.status).toBe('FAIL')
    expect(exitCodeFor(report)).toBe(1)
    expect(report.http.load?.['POST /submissions']?.byStatus['500:internal']).toBe(1)
    expect(report.sse.dropped).toBe(1)
    expect(report.sse.droppedBy).toEqual({ 'session.revoked': 1 })
    expect(report.failures).toContain('1× 500:internal on POST /submissions (load)')
    expect(report.failures).toContain('1 SSE connection(s) dropped: {"session.revoked":1}')
    // The run still reached its end and closed what it opened.
    expect(report.phases.at(-1)?.phase).toBe('teardown')
    expect(report.aborted).toBe(false)
  })

  it('stops the setup on Ctrl-C: no new signup and no round', async () => {
    const controller = new AbortController()
    let signups = 0
    const abortAfterFirstSignup: FetchLike = async (input, init) => {
      const res = await app.request(input, init)
      if (new URL(input).pathname === '/auth/signup' && ++signups === 1) controller.abort()
      return res
    }

    const report = await runScenario({
      config: { ...minimal, teams: 5, setupConcurrency: 1 },
      fetch: abortAfterFirstSignup,
      runId: 'midsetup',
      signal: controller.signal,
    })

    expect(report.aborted).toBe(true)
    expect(report.world).toBeNull()
    expect(report.actions['signup']).toEqual({ started: 1, completed: 1 })
    expect(report.http.setup?.['POST /organizer/rounds']).toBeUndefined()
  })

  it('writes a partial report when aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const report = await runScenario({
      config: minimal,
      fetch: inProcess,
      runId: 'aborted',
      signal: controller.signal,
    })

    expect(report.aborted).toBe(true)
    expect(report.status).toBe('FAIL')
    expect(report.world).toBeNull()
    expect(report.failures).toContain(
      'run aborted before the end (SIGINT) — this report is partial',
    )
  })
})
