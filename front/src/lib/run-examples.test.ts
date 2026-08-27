import { afterEach, describe, expect, it, vi } from 'vitest'

import { type CaseOutcome, EXAMPLE_TIMEOUT_MS, runExamples } from './run-examples'
import type { SolutionRequest, SolutionResponse, SolutionWorker } from './solution-worker'

/**
 * How a fake worker reacts to the one message it gets. Replies land
 * synchronously inside `postMessage` — the runner wires `onmessage` before it
 * posts, so this is enough to settle a case without touching the clock.
 */
type Behaviour =
  | { kind: 'reply'; response: SolutionResponse }
  | { kind: 'crash'; message: string }
  | { kind: 'hang' }

class FakeWorker implements SolutionWorker {
  onmessage: ((event: MessageEvent<SolutionResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminateCount = 0
  request: SolutionRequest | undefined

  constructor(private readonly behaviour: Behaviour) {}

  postMessage(request: SolutionRequest) {
    this.request = request
    if (this.behaviour.kind === 'reply') {
      this.onmessage?.(new MessageEvent('message', { data: this.behaviour.response }))
    }
    if (this.behaviour.kind === 'crash') {
      this.onerror?.(new ErrorEvent('error', { message: this.behaviour.message }))
    }
  }

  terminate() {
    this.terminateCount += 1
  }
}

function fakeWorkers(behaviours: Behaviour[]) {
  const spawned: FakeWorker[] = []
  return {
    spawned,
    spawnWorker: () => {
      const worker = new FakeWorker(behaviours[spawned.length] ?? { kind: 'hang' })
      spawned.push(worker)
      return worker
    },
  }
}

const returns = (value: unknown): Behaviour => ({ kind: 'reply', response: { ok: true, value } })
const throws = (message: string): Behaviour => ({
  kind: 'reply',
  response: { ok: false, message },
})

const CODE = 'function solve(input) { return input }'

afterEach(() => {
  vi.useRealTimers()
})

describe('runExamples', () => {
  it('runs each example in its own worker and passes when every value matches', async () => {
    const workers = fakeWorkers([returns(6), returns(0), returns(20)])

    const outcomes = await runExamples(
      CODE,
      [
        { input: [1, 2, 3, 4], expected: 6 },
        { input: [5, 7, 9], expected: 0 },
        { input: [2, 4, 6, 8], expected: 20 },
      ],
      workers,
    )

    expect(outcomes).toEqual<CaseOutcome[]>([
      { status: 'passed', actual: 6 },
      { status: 'passed', actual: 0 },
      { status: 'passed', actual: 20 },
    ])
    expect(workers.spawned).toHaveLength(3)
    expect(workers.spawned.map((worker) => worker.request?.input)).toEqual([
      [1, 2, 3, 4],
      [5, 7, 9],
      [2, 4, 6, 8],
    ])
  })

  it('fails the case whose value differs, keeping what was obtained', async () => {
    const workers = fakeWorkers([returns(6), returns(4)])

    const outcomes = await runExamples(
      CODE,
      [
        { input: [1, 2, 3, 4], expected: 6 },
        { input: [1, 3], expected: 0 },
      ],
      workers,
    )

    expect(outcomes).toEqual<CaseOutcome[]>([
      { status: 'passed', actual: 6 },
      { status: 'failed', actual: 4 },
    ])
  })

  it('compares strictly, so a string never passes for a number', async () => {
    const workers = fakeWorkers([returns('6')])

    const outcomes = await runExamples(CODE, [{ input: [], expected: 6 }], workers)

    expect(outcomes).toEqual<CaseOutcome[]>([{ status: 'failed', actual: '6' }])
  })

  it('aborts a case that never answers and keeps running the ones after it', async () => {
    vi.useFakeTimers()
    const workers = fakeWorkers([{ kind: 'hang' }, returns(0)])

    const promise = runExamples(
      CODE,
      [
        { input: [1], expected: 1 },
        { input: [], expected: 0 },
      ],
      workers,
    )
    await vi.advanceTimersByTimeAsync(EXAMPLE_TIMEOUT_MS)

    expect(await promise).toEqual<CaseOutcome[]>([
      { status: 'timeout' },
      { status: 'passed', actual: 0 },
    ])
    expect(workers.spawned[0]?.terminateCount).toBe(1)
  })

  it('reports the message of a case that throws and still runs the rest', async () => {
    const workers = fakeWorkers([throws('lista vazia'), returns(0), returns(20)])

    const outcomes = await runExamples(
      CODE,
      [
        { input: [1], expected: 1 },
        { input: [], expected: 0 },
        { input: [2, 4, 6, 8], expected: 20 },
      ],
      workers,
    )

    expect(outcomes).toEqual<CaseOutcome[]>([
      { status: 'error', message: 'lista vazia' },
      { status: 'passed', actual: 0 },
      { status: 'passed', actual: 20 },
    ])
  })

  it('turns a worker that errors out into a failed case', async () => {
    const workers = fakeWorkers([{ kind: 'crash', message: 'Worker falhou' }])

    const outcomes = await runExamples(CODE, [{ input: [], expected: 0 }], workers)

    expect(outcomes).toEqual<CaseOutcome[]>([{ status: 'error', message: 'Worker falhou' }])
  })

  it('announces each case in order, as soon as it settles', async () => {
    const workers = fakeWorkers([returns(6), returns(1), returns(20)])
    const settled: [number, CaseOutcome][] = []

    await runExamples(
      CODE,
      [
        { input: [1, 2, 3, 4], expected: 6 },
        { input: [5, 7, 9], expected: 0 },
        { input: [2, 4, 6, 8], expected: 20 },
      ],
      { ...workers, onCaseSettled: (index, outcome) => settled.push([index, outcome]) },
    )

    expect(settled).toEqual([
      [0, { status: 'passed', actual: 6 }],
      [1, { status: 'failed', actual: 1 }],
      [2, { status: 'passed', actual: 20 }],
    ])
  })

  it('terminates every worker it spawns, whatever the outcome', async () => {
    const workers = fakeWorkers([returns(6), throws('boom'), { kind: 'crash', message: 'x' }])

    await runExamples(
      CODE,
      [
        { input: [], expected: 6 },
        { input: [], expected: 0 },
        { input: [], expected: 0 },
      ],
      workers,
    )

    expect(workers.spawned.map((worker) => worker.terminateCount)).toEqual([1, 1, 1])
  })

  it('sends the same generated code to every worker', async () => {
    const workers = fakeWorkers([returns(1), returns(2)])

    await runExamples(
      CODE,
      [
        { input: [], expected: 1 },
        { input: [], expected: 2 },
      ],
      workers,
    )

    expect(workers.spawned.map((worker) => worker.request?.code)).toEqual([CODE, CODE])
  })

  it('returns no outcomes when there are no examples', async () => {
    const workers = fakeWorkers([])

    expect(await runExamples(CODE, [], workers)).toEqual([])
    expect(workers.spawned).toHaveLength(0)
  })
})
