import {
  type BlockLocale,
  defineKumiteBlocks,
  emptyWorkspaceState,
  INPUT_BLOCK_TYPE,
  ROOT_BLOCK_TYPE,
  raizDesabilitada,
  somaDosPares,
  type WorkspaceState,
} from '@kumite/blocks'
import { act, renderHook } from '@testing-library/react'
import * as Blockly from 'blockly'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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
    const { result } = renderHook(() => useExampleRun(examples, 'pt', deferredWorkers()))

    expect(result.current.state).toEqual({ status: 'idle' })
  })

  it('warns instead of running when no solution is built', async () => {
    const workers = deferredWorkers()
    const { result } = renderHook(() => useExampleRun(examples, 'pt', workers))

    await act(async () => {
      await result.current.run(emptyWorkspaceState)
    })

    expect(result.current.state).toEqual({ status: 'empty' })
    expect(workers.spawned).toHaveLength(0)
  })

  it('surfaces the codegen error without spawning a worker', async () => {
    const workers = deferredWorkers()
    const { result } = renderHook(() => useExampleRun(examples, 'pt', workers))

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
    const { result } = renderHook(() => useExampleRun(examples, 'pt', workers))

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
    const { result } = renderHook(() => useExampleRun(examples, 'pt', workers))
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
    const { result } = renderHook(() => useExampleRun(examples, 'pt', workers))
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

/**
 * The labels a block created from the global registry *now* would show: what
 * the Variables flyout and the fresh root of "Limpar blocos" read after a run.
 */
function registryLabels(): { root: string; input: string } {
  const workspace = new Blockly.Workspace()
  try {
    return {
      root: workspace.newBlock(ROOT_BLOCK_TYPE).toString(),
      input: workspace.newBlock(INPUT_BLOCK_TYPE).toString(),
    }
  } finally {
    workspace.dispose()
  }
}

// #183: `generateSolution` re-registers the kumite blocks globally, so a run
// without the UI locale used to flip every block created afterwards to pt.
describe('useExampleRun keeps the block locale (#183)', () => {
  let locale: BlockLocale = 'pt'

  beforeEach(() => {
    // The editor already applied the UI locale before the click.
    defineKumiteBlocks(locale)
  })

  afterEach(() => {
    defineKumiteBlocks('pt')
  })

  const cases: {
    locale: BlockLocale
    message: string
    root: string
    input: string
    notRoot: string
  }[] = [
    {
      locale: 'en',
      message: 'There is a disabled block in your solution. Re-enable it to continue.',
      root: 'return',
      input: 'input',
      notRoot: 'retornar',
    },
    {
      locale: 'es',
      message: 'Hay un bloque deshabilitado en tu solución. Reactivalo para continuar.',
      root: 'devolver',
      input: 'entrada',
      notRoot: 'retornar',
    },
    {
      locale: 'pt',
      message: 'Há um bloco desabilitado na sua solução. Reative-o para continuar.',
      root: 'retornar',
      input: 'entrada',
      notRoot: 'devolver',
    },
  ]

  for (const expected of cases) {
    describe(`in ${expected.locale}`, () => {
      beforeEach(() => {
        locale = expected.locale
        defineKumiteBlocks(locale)
      })

      it('refuses in the UI language and leaves the registry in it', async () => {
        const workers = deferredWorkers()
        const { result } = renderHook(() => useExampleRun(examples, expected.locale, workers))

        await act(async () => {
          await result.current.run(raizDesabilitada)
        })

        expect(result.current.state).toEqual({ status: 'invalid', message: expected.message })
        const labels = registryLabels()
        expect(labels.root).toContain(expected.root)
        expect(labels.root).not.toContain(expected.notRoot)
        expect(labels.input).toBe(expected.input)
      })
    })
  }

  it('uses the new locale on the next run after the language changes', async () => {
    locale = 'pt'
    defineKumiteBlocks('pt')
    const workers = deferredWorkers()
    const { result, rerender } = renderHook(
      ({ current }: { current: BlockLocale }) => useExampleRun(examples, current, workers),
      { initialProps: { current: 'pt' as BlockLocale } },
    )

    defineKumiteBlocks('en')
    rerender({ current: 'en' })
    await act(async () => {
      await result.current.run(raizDesabilitada)
    })

    expect(result.current.state).toEqual({
      status: 'invalid',
      message: 'There is a disabled block in your solution. Re-enable it to continue.',
    })
    expect(registryLabels().input).toBe('input')
  })
})
