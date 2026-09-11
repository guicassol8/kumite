import {
  emptyWorkspaceState,
  ROOT_BLOCK_TYPE,
  raizDesabilitada,
  somaDosPares,
  type WorkspaceState,
} from '@kumite/blocks'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ExampleCase } from '@/lib/run-examples'
import type { SolutionRequest, SolutionResponse, SolutionWorker } from '@/lib/solution-worker'
import { useExampleRun } from './use-example-run'

const examples: ExampleCase[] = [
  { input: [1, 2, 3, 4], expected: 6 },
  { input: [5, 7, 9], expected: 0 },
  { input: [2, 4, 6, 8], expected: 20 },
]

/** Answers only when the test says so, which is how the progressive fill is observed. */
class DeferredWorker implements SolutionWorker {
  onmessage: ((event: MessageEvent<SolutionResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  request: SolutionRequest | undefined

  postMessage(request: SolutionRequest) {
    this.request = request
  }

  terminate() {}

  reply(response: SolutionResponse) {
    this.onmessage?.(new MessageEvent('message', { data: response }))
  }
}

function deferredWorkers() {
  const spawned: DeferredWorker[] = []
  return {
    spawned,
    spawnWorker: () => {
      const worker = new DeferredWorker()
      spawned.push(worker)
      return worker
    },
  }
}

const forbidden: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: ROOT_BLOCK_TYPE,
        id: 'raiz',
        inputs: { BODY: { block: { type: 'text_print', id: 'proibido' } } },
      },
    ],
  },
}

describe('useExampleRun', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useExampleRun(examples, deferredWorkers()))

    expect(result.current.state).toEqual({ status: 'idle' })
  })

  it('warns instead of running when no solution is built', async () => {
    const workers = deferredWorkers()
    const { result } = renderHook(() => useExampleRun(examples, workers))

    await act(async () => {
      await result.current.run(emptyWorkspaceState)
    })

    expect(result.current.state).toEqual({ status: 'empty' })
    expect(workers.spawned).toHaveLength(0)
  })

  it('surfaces the codegen error without spawning a worker', async () => {
    const workers = deferredWorkers()
    const { result } = renderHook(() => useExampleRun(examples, workers))

    await act(async () => {
      await result.current.run(forbidden)
    })

    expect(result.current.state).toEqual({
      status: 'invalid',
      message: 'O bloco "text_print" não é permitido nesta solução.',
    })
    expect(workers.spawned).toHaveLength(0)
  })

  it('surfaces the disabled-block refusal without spawning a worker', async () => {
    const workers = deferredWorkers()
    const { result } = renderHook(() => useExampleRun(examples, workers))

    await act(async () => {
      await result.current.run(raizDesabilitada)
    })

    // #181, finding #15: this used to "run" a source with no solve at all and
    // report every example as a runtime error, with no hint about the cause.
    expect(result.current.state).toEqual({
      status: 'invalid',
      message: 'Há um bloco desabilitado na sua solução. Reative-o para continuar.',
    })
    expect(workers.spawned).toHaveLength(0)
  })

  it('fills the results in case by case and lands on done', async () => {
    const workers = deferredWorkers()
    const { result } = renderHook(() => useExampleRun(examples, workers))
    const finished: Promise<void>[] = []

    await act(async () => {
      finished.push(result.current.run(somaDosPares))
    })

    expect(result.current.state).toEqual({ status: 'running', outcomes: [null, null, null] })
    expect(workers.spawned[0]?.request?.code).toContain('function solve(input)')

    await act(async () => {
      workers.spawned[0]?.reply({ ok: true, value: 6 })
    })
    expect(result.current.state).toEqual({
      status: 'running',
      outcomes: [{ status: 'passed', actual: 6 }, null, null],
    })

    await act(async () => {
      workers.spawned[1]?.reply({ ok: true, value: 1 })
    })
    expect(result.current.state).toEqual({
      status: 'running',
      outcomes: [{ status: 'passed', actual: 6 }, { status: 'failed', actual: 1 }, null],
    })

    await act(async () => {
      workers.spawned[2]?.reply({ ok: true, value: 20 })
      await Promise.all(finished)
    })
    expect(result.current.state).toEqual({
      status: 'done',
      outcomes: [
        { status: 'passed', actual: 6 },
        { status: 'failed', actual: 1 },
        { status: 'passed', actual: 20 },
      ],
    })
  })

  it('sends each example input to its own worker', async () => {
    const workers = deferredWorkers()
    const { result } = renderHook(() => useExampleRun(examples, workers))
    const finished: Promise<void>[] = []

    await act(async () => {
      finished.push(result.current.run(somaDosPares))
    })
    for (const value of [6, 0, 20]) {
      await act(async () => {
        workers.spawned[workers.spawned.length - 1]?.reply({ ok: true, value })
      })
    }
    await act(async () => {
      await Promise.all(finished)
    })

    expect(workers.spawned.map((worker) => worker.request?.input)).toEqual([
      [1, 2, 3, 4],
      [5, 7, 9],
      [2, 4, 6, 8],
    ])
  })
})
