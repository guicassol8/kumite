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

    expect(result.current.state).toEqual({
      status: 'running',
      examples,
      outcomes: [null, null, null],
    })
    expect(workers.spawned[0]?.request?.code).toContain('function solve(input)')

    await act(async () => {
      workers.spawned[0]?.reply({ ok: true, value: 6 })
    })
    expect(result.current.state).toEqual({
      status: 'running',
      examples,
      outcomes: [{ status: 'passed', actual: 6 }, null, null],
    })

    await act(async () => {
      workers.spawned[1]?.reply({ ok: true, value: 1 })
    })
    expect(result.current.state).toEqual({
      status: 'running',
      examples,
      outcomes: [{ status: 'passed', actual: 6 }, { status: 'failed', actual: 1 }, null],
    })

    await act(async () => {
      workers.spawned[2]?.reply({ ok: true, value: 20 })
      await Promise.all(finished)
    })
    expect(result.current.state).toEqual({
      status: 'done',
      examples,
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

// #197: the examples on screen are refetched on window focus, so they can
// change under a run already on screen. Each run keeps the examples it ran
// against, and a run that no longer matches the loaded ones is dropped —
// never paired by index with a list it did not run.
describe('useExampleRun pairs the outcomes with the examples they ran against (#197)', () => {
  type Props = { current: readonly ExampleCase[] }

  function renderRun(workers: ReturnType<typeof deferredWorkers>) {
    return renderHook(({ current }: Props) => useExampleRun(current, 'pt', workers), {
      initialProps: { current: examples } as Props,
    })
  }

  /** Runs the right solution to the end: every case of `examples` passes. */
  async function runToDone(
    result: { current: ReturnType<typeof useExampleRun> },
    workers: ReturnType<typeof deferredWorkers>,
  ) {
    let finished: Promise<void> | undefined
    await act(async () => {
      finished = result.current.run(somaDosPares)
    })
    for (const value of [6, 0, 20]) {
      await act(async () => {
        workers.spawned[workers.spawned.length - 1]?.reply({ ok: true, value })
      })
    }
    await act(async () => {
      await finished
    })
    expect(result.current.state.status).toBe('done')
  }

  it('drops a finished run once the examples are reordered', async () => {
    const workers = deferredWorkers()
    const { result, rerender } = renderRun(workers)
    await runToDone(result, workers)

    const [first, second, third] = examples as [ExampleCase, ExampleCase, ExampleCase]
    rerender({ current: [second, first, third] })

    expect(result.current.state).toEqual({ status: 'idle' })
  })

  it('drops a finished run once an example is removed', async () => {
    const workers = deferredWorkers()
    const { result, rerender } = renderRun(workers)
    await runToDone(result, workers)

    rerender({ current: examples.slice(0, 2) })

    expect(result.current.state).toEqual({ status: 'idle' })
  })

  it('keeps a finished run when the same examples come back as a new array', async () => {
    const workers = deferredWorkers()
    const { result, rerender } = renderRun(workers)
    await runToDone(result, workers)
    const before = result.current.state

    // What a language switch or an unchanged refetch hands the screen: a new
    // array, the same content (#178/#183).
    rerender({ current: structuredClone(examples) })

    expect(result.current.state).toEqual(before)
  })

  it('does not bring a dropped run back when the old examples return', async () => {
    const workers = deferredWorkers()
    const { result, rerender } = renderRun(workers)
    await runToDone(result, workers)

    rerender({ current: examples.slice(0, 2) })
    rerender({ current: examples })

    expect(result.current.state).toEqual({ status: 'idle' })
  })

  it('never lets a dropped run write over the run that replaced it', async () => {
    const workers = deferredWorkers()
    const { result, rerender } = renderRun(workers)

    // Run A answers its first case, then the examples change under it.
    await act(async () => {
      void result.current.run(somaDosPares)
    })
    await act(async () => {
      workers.spawned[0]?.reply({ ok: true, value: 6 })
    })
    const pendingOfA = workers.spawned[1]
    const edited = examples.slice(0, 2)
    rerender({ current: edited })
    expect(result.current.state).toEqual({ status: 'idle' })

    // Run B starts on the new examples; A's worker answers only afterwards,
    // and A goes on to its last case and finishes.
    await act(async () => {
      void result.current.run(somaDosPares)
    })
    const firstOfB = workers.spawned[2]
    await act(async () => {
      pendingOfA?.reply({ ok: true, value: 0 })
    })
    await act(async () => {
      workers.spawned[3]?.reply({ ok: true, value: 20 })
    })

    expect(result.current.state).toEqual({
      status: 'running',
      examples: edited,
      outcomes: [null, null],
    })

    // B itself still lands.
    await act(async () => {
      firstOfB?.reply({ ok: true, value: 6 })
    })
    await act(async () => {
      workers.spawned[workers.spawned.length - 1]?.reply({ ok: true, value: 0 })
    })
    expect(result.current.state).toEqual({
      status: 'done',
      examples: edited,
      outcomes: [
        { status: 'passed', actual: 6 },
        { status: 'passed', actual: 0 },
      ],
    })
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

// #183: `generateSolution` used to re-register the kumite blocks globally, so a
// run without the UI locale flipped every block created afterwards to pt.
// Since #380 codegen never touches the registry; these stay as a regression
// lock.
describe('useExampleRun keeps the block locale (#183)', () => {
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
        // The editor already applied the UI locale before the click.
        defineKumiteBlocks(expected.locale)
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
