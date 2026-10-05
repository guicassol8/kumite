import { describe, expect, it } from 'vitest'

import { createRecorder, routeKey } from './recorder'

describe('routeKey', () => {
  it('replaces uuids with :id and drops the origin and the query', () => {
    expect(
      routeKey('POST', 'http://localhost:3000/teams/0b7e3a52-8f0e-4c4b-9a39-6d1f3c1e2a10/join?x=1'),
    ).toBe('POST /teams/:id/join')
  })

  it('accepts a relative url and upper-cases the method', () => {
    expect(routeKey('get', '/organizer/stats/live')).toBe('GET /organizer/stats/live')
  })

  it('leaves non-uuid segments alone', () => {
    expect(routeKey('PATCH', '/organizer/event-codes/pucrs')).toBe(
      'PATCH /organizer/event-codes/pucrs',
    )
  })
})

describe('createRecorder', () => {
  it('groups requests by phase and route, with status and error-code counts', () => {
    const recorder = createRecorder()
    recorder.setPhase('setup')
    recorder.recordHttp({
      method: 'POST',
      url: '/auth/login',
      status: 200,
      errorCode: null,
      ms: 10,
    })
    recorder.recordHttp({
      method: 'POST',
      url: '/auth/login',
      status: 401,
      errorCode: 'invalid_credentials',
      ms: 30,
    })
    recorder.setPhase('load')
    recorder.recordHttp({
      method: 'POST',
      url: '/submissions',
      status: 429,
      errorCode: 'submission_throttled',
      ms: 5,
    })
    recorder.recordHttp({
      method: 'POST',
      url: '/submissions',
      status: null,
      errorCode: null,
      ms: 60_000,
      networkError: 'timeout',
    })
    recorder.recordHttp({
      method: 'POST',
      url: '/submissions',
      status: null,
      errorCode: null,
      ms: 3,
      networkError: 'ECONNREFUSED',
    })

    const { http } = recorder.snapshot()

    expect(http.setup?.['POST /auth/login']).toMatchObject({
      count: 2,
      byStatus: { '200': 1, '401:invalid_credentials': 1 },
      networkErrors: 0,
      timeouts: 0,
    })
    expect(http.setup?.['POST /auth/login']?.latencyMs.max).toBe(30)
    expect(http.load?.['POST /submissions']).toMatchObject({
      count: 3,
      byStatus: { '429:submission_throttled': 1, network: 2 },
      networkErrors: 2,
      timeouts: 1,
    })
    // Latency is only over the requests that completed.
    expect(http.load?.['POST /submissions']?.latencyMs.count).toBe(1)
  })

  it('counts actions started and completed per kind', () => {
    const recorder = createRecorder()
    recorder.actionStarted('submission')
    recorder.actionStarted('submission')
    recorder.actionCompleted('submission')
    recorder.actionStarted('signup')
    recorder.actionCompleted('signup')

    expect(recorder.snapshot().actions).toEqual({
      submission: { started: 2, completed: 1 },
      signup: { started: 1, completed: 1 },
    })
  })

  it('builds the kind × verdict matrix and counts the incoherent ones', () => {
    const recorder = createRecorder()
    recorder.recordVerdict('correct', 'accepted')
    recorder.recordVerdict('correct', 'accepted')
    recorder.recordVerdict('loop', 'timeout')
    recorder.recordVerdict('loop', 'accepted')

    const { verdicts } = recorder.snapshot()
    expect(verdicts.matrix).toEqual({
      correct: { accepted: 2 },
      loop: { timeout: 1, accepted: 1 },
    })
    expect(verdicts.incoherent).toBe(1)
  })

  it('keeps unexpected statuses, setup errors and warnings apart', () => {
    const recorder = createRecorder()
    recorder.setPhase('setup')
    recorder.recordUnexpected({
      method: 'POST',
      url: '/teams',
      status: 409,
      errorCode: 'name_taken',
    })
    recorder.recordError('another round is open: Rodada 1')
    recorder.recordWarning('the database was not clean')

    const snapshot = recorder.snapshot()
    expect(snapshot.unexpected).toEqual([
      { phase: 'setup', route: 'POST /teams', status: 409, errorCode: 'name_taken', count: 1 },
    ])
    expect(snapshot.errors).toEqual([
      { phase: 'setup', message: 'another round is open: Rodada 1' },
    ])
    expect(snapshot.warnings).toEqual(['the database was not clean'])
  })

  it('records a timeline of phases with their bounds', () => {
    let clock = 1_000
    const recorder = createRecorder({ clock: () => clock })
    recorder.setPhase('rest')
    clock = 2_000
    recorder.setPhase('setup')
    clock = 5_000
    recorder.endPhases()

    expect(recorder.snapshot().phases).toEqual([
      { phase: 'rest', startedAt: 1_000, endedAt: 2_000 },
      { phase: 'setup', startedAt: 2_000, endedAt: 5_000 },
    ])
  })
})
