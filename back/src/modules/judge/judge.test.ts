import { randomUUID } from 'node:crypto'

import { indiceAleatorio, raizDesabilitada, somaDosPares } from '@kumite/blocks'
import { javascriptGenerator } from 'blockly/javascript'
import { describe, expect, it, vi } from 'vitest'

import type { JudgeCase, JudgeCaseResult, JudgeConfig, Workspace } from './judge.schema'
import { WorkspaceSchema } from './judge.schema'
import {
  generateJudgeSource,
  getJudgeLoad,
  getJudgeTimings,
  runJudge,
  runJudgeAgainstWorker,
} from './judge.service'

const TEST_TIMEOUT_MS = 15_000

const testConfig: JudgeConfig = { timeoutMs: 2000, memoryMb: 64, concurrency: 4 }
const CRASH_WORKER_URL = new URL('../../judge-test-worker.mjs', import.meta.url)

/** The worker double under a URL of its own: the pool is keyed by URL
 * (#277), so a test reading spawn counts starts from an empty pool. */
function isolatedWorkerUrl(): URL {
  return new URL(`../../judge-test-worker.mjs?pool=${randomUUID()}`, import.meta.url)
}

/** Every live worker is an idle pooled one. terminate() is fire-and-forget:
 * a discarded worker's exit lands a moment after its submission returns, so
 * this is waited for, never assumed. */
function allAliveIdle(): Promise<void> {
  return vi.waitFor(
    () => {
      const { alive, idle } = getJudgeTimings().workers
      expect(alive).toBe(idle)
    },
    { timeout: 10_000, interval: 20 },
  )
}

// The fixture is typed WorkspaceState (Record<string, unknown>) by the blocks
// package; parsing it is how it becomes a Workspace here — the same step the
// route (#21) performs on the incoming body, never a cast.
const somaDosParesWorkspace = WorkspaceSchema.parse(somaDosPares)
const raizDesabilitadaWorkspace = WorkspaceSchema.parse(raizDesabilitada)
const indiceAleatorioWorkspace = WorkspaceSchema.parse(indiceAleatorio)
// U+000D built from its code point: it is invisible in an editor and some
// tools normalize it away on save, and its presence is the whole point.
const textoQueNaoParseia = WorkspaceSchema.parse({
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'kumite_solve',
        id: 'raiz',
        inputs: {
          RETURN: {
            block: {
              type: 'text',
              id: 'texto',
              fields: { TEXT: `a${String.fromCharCode(0x0d)}b` },
            },
          },
        },
      },
    ],
  },
})

/** Every test that needs runnable source goes through the judge's own codegen
 * — one path, so the suite can never prove a source shape the judge does not
 * actually produce. */
function sourceOf(workspace: Workspace): string {
  const result = generateJudgeSource(workspace)
  if (!result.ok) throw new Error(`unexpected codegen refusal: ${result.error}`)
  return result.source
}

describe('runJudge', () => {
  it(
    'passes a correct solve(input) result',
    async () => {
      const source = sourceOf(somaDosParesWorkspace)
      const cases: JudgeCase[] = [{ input: [1, 2, 3, 4], expected: 6 }]
      const [result] = await runJudge(source, cases, testConfig)
      expect(result).toEqual({ outcome: 'passed', ms: expect.any(Number) })
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'fails a case whose solve(input) returns the wrong value',
    async () => {
      const source = 'function solve(input) { return input[0] + 1 }'
      const cases: JudgeCase[] = [{ input: [1], expected: 99 }]
      const [result] = await runJudge(source, cases, testConfig)
      expect(result).toEqual({ outcome: 'failed', expected: 99, actual: 2, ms: expect.any(Number) })
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'times out an infinite loop without crashing the main process',
    async () => {
      const source = 'function solve(input) { let x = 0; while (true) { x = x + 1 } return x }'
      const cases: JudgeCase[] = [{ input: [], expected: null }]
      const [result] = await runJudge(source, cases, testConfig)
      expect(result?.outcome).toBe('timeout')
    },
    TEST_TIMEOUT_MS,
  )

  const hostileProbes: Array<{ name: string; source: string }> = [
    {
      name: 'require',
      source: "function solve(input) { return require('node:fs').readdirSync('.') }",
    },
    { name: 'process', source: 'function solve(input) { return process.exit(0) }' },
    { name: 'fetch', source: "function solve(input) { return fetch('http://169.254.169.254/') }" },
  ]

  it.each(hostileProbes)(
    'reports $name as a runtime error with a detail message',
    async ({ source }) => {
      const cases: JudgeCase[] = [{ input: [], expected: null }]
      const [result] = await runJudge(source, cases, testConfig)
      expect(result?.outcome).toBe('runtime_error')
      expect(result && 'detail' in result ? result.detail : undefined).toBeTruthy()
    },
    TEST_TIMEOUT_MS,
  )

  it('classifies a memory bomb as a runtime error, not a timeout', {
    timeout: 25_000,
  }, async () => {
    const source =
      'function solve(input) { const a = []; while (true) { a.push(new Array(1e6).fill(0)) } return a.length }'
    const cases: JudgeCase[] = [{ input: [], expected: null }]
    const [result] = await runJudge(source, cases, testConfig)
    expect(result?.outcome).toBe('runtime_error')
  })

  // #120 wants the judge to run submissions in parallel: the second
  // submission's worker is alive while the first one's still is. #294
  // replaced a wall-clock check (parallel pair < 0.75 × serial pair) that
  // timed two pairs at two different moments: a runner that got busier
  // between them failed it (418 ms parallel vs 542 ms serial on CI), and its
  // busy-loop stopped on the clock, not on CPU, so it never measured
  // parallelism anyway. These tests read the overlap itself, with no
  // stopwatch: each submission's worker meets the other at a barrier (a
  // BroadcastChannel named per pair) and answers 'together' if the other
  // showed up, 'alone' if it waited waitMs in vain.
  //
  // The worker double (judge-test-worker.mjs), not QuickJS: the sandbox
  // blocks require and has no channel between workers, and the semaphore
  // plus the worker pool live in runJudgeAgainstWorker, which runJudge only
  // delegates to — the same seam the crash and getJudgeLoad tests use. The
  // double closes its channel before replying, and with the limit at 1 the
  // second submission only starts after that reply — on the first one's
  // pooled worker (#277) — so the serial control can never meet a stale
  // first barrier.
  async function runBarrierPair(concurrency: number, waitMs: number): Promise<JudgeCaseResult[]> {
    const barrier = randomUUID()
    const cases: JudgeCase[] = [{ input: { barrier, waitMs }, expected: 'together' }]
    const config = { ...testConfig, concurrency }
    const [first, second] = await Promise.all([
      runJudgeAgainstWorker(CRASH_WORKER_URL, 'unused', cases, config),
      runJudgeAgainstWorker(CRASH_WORKER_URL, 'unused', cases, config),
    ])
    return [...first, ...second]
  }

  // waitMs only matters on regression: healthy workers meet as soon as the
  // second one arrives. 5000 ms stays under the per-case watchdog
  // (timeoutMs 2000 + 5000 slack) and is ~5× the worst arrival gap measured
  // with 24 CPU hogs on one core (953 ms). On regression both submissions
  // wait it out in turn, hence the 20 s budget.
  it('runs two submissions at once when the concurrency limit allows it', {
    timeout: 20_000,
  }, async () => {
    const results = await runBarrierPair(2, 5000)
    expect(results).toEqual([
      { outcome: 'passed', ms: 0 },
      { outcome: 'passed', ms: 0 },
    ])
  })

  // The control proves the barrier can say no: one that always answered
  // 'together' would pass the test above without proving anything. Any
  // waitMs yields 'alone' here, so 300 ms keeps it fast.
  it(
    'runs them one at a time when the limit is 1, so the barrier can tell them apart',
    async () => {
      const results = await runBarrierPair(1, 300)
      const alone = { outcome: 'failed', expected: 'together', actual: 'alone', ms: 0 }
      expect(results).toEqual([alone, alone])
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'marks every case after a worker crash as runtime_error, no respawn mid-submission',
    async () => {
      // The real QuickJS memory-bomb path could not be forced to crash the
      // worker reliably (its own accounting always wins gracefully on this
      // machine) — a worker double lets this test trigger a real 'exit'
      // deterministically, which is the scenario the cascading logic below
      // needs to prove: case 2 kills the worker, case 3 never gets sent.
      const cases: JudgeCase[] = [
        { input: 'a', expected: 'a' },
        { input: '__crash__', expected: null },
        { input: 'c', expected: 'c' },
      ]
      const results = await runJudgeAgainstWorker(CRASH_WORKER_URL, 'unused', cases, testConfig)
      expect(results[0]).toEqual({ outcome: 'passed', ms: 0 })
      expect(results[1]?.outcome).toBe('runtime_error')
      expect(results[2]?.outcome).toBe('runtime_error')
    },
    TEST_TIMEOUT_MS,
  )
})

// #277: a worker whose submission ended clean goes back to the pool, and the
// next submission reuses it instead of paying the spawn and the QuickJS load.
describe('worker pool', () => {
  const spawned = () => getJudgeTimings().workers.spawned
  const single = { ...testConfig, concurrency: 1 }
  const okCase: JudgeCase[] = [{ input: 'ok', expected: 'ok' }]

  it(
    'reuses a warm worker: no spawn and a spawn time of 0 for the next submissions',
    async () => {
      const source = sourceOf(somaDosParesWorkspace)
      const cases: JudgeCase[] = [{ input: [1, 2, 3, 4], expected: 6 }]
      await runJudge(source, cases, testConfig)

      const before = spawned()
      const first = await runJudge(source, cases, testConfig)
      const second = await runJudge(source, cases, testConfig)

      expect([...first, ...second].map((result) => result.outcome)).toEqual(['passed', 'passed'])
      expect(spawned()).toBe(before)
      expect(
        getJudgeTimings()
          .runs.slice(-2)
          .map((run) => run.spawnMs),
      ).toEqual([0, 0])
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'discards a worker that died mid-submission: the next submission gets a fresh one',
    async () => {
      const workerUrl = isolatedWorkerUrl()
      const before = spawned()

      const warm = await runJudgeAgainstWorker(workerUrl, 'unused', okCase, single)
      const crashed = await runJudgeAgainstWorker(
        workerUrl,
        'unused',
        [
          { input: 'a', expected: 'a' },
          { input: '__crash__', expected: null },
          { input: 'c', expected: 'c' },
        ],
        single,
      )
      const after = await runJudgeAgainstWorker(workerUrl, 'unused', okCase, single)

      expect(warm.map((result) => result.outcome)).toEqual(['passed'])
      expect(crashed.map((result) => result.outcome)).toEqual([
        'passed',
        'runtime_error',
        'runtime_error',
      ])
      expect(after.map((result) => result.outcome)).toEqual(['passed'])
      // One for the warm-up, reused by the crash; one more after it.
      expect(spawned()).toBe(before + 2)
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'discards a worker that never replied: the watchdog, then a fresh worker',
    async () => {
      const workerUrl = isolatedWorkerUrl()
      const config = { ...single, timeoutMs: 100 }
      const before = spawned()

      const hung = await runJudgeAgainstWorker(
        workerUrl,
        'unused',
        [{ input: '__hang__', expected: null }],
        config,
      )
      const after = await runJudgeAgainstWorker(workerUrl, 'unused', okCase, config)

      expect(hung).toEqual([
        { outcome: 'runtime_error', detail: 'no reply from worker (watchdog)', ms: 5100 },
      ])
      expect(after.map((result) => result.outcome)).toEqual(['passed'])
      expect(spawned()).toBe(before + 2)
      await allAliveIdle()
    },
    TEST_TIMEOUT_MS,
  )

  it.each(['__memory__', '__error__'])(
    'discards a worker after a %s outcome: the next submission gets a fresh one',
    async (input) => {
      const workerUrl = isolatedWorkerUrl()
      const before = spawned()

      const [bad] = await runJudgeAgainstWorker(
        workerUrl,
        'unused',
        [{ input, expected: null }],
        single,
      )
      const after = await runJudgeAgainstWorker(workerUrl, 'unused', okCase, single)

      expect(bad?.outcome).toBe('runtime_error')
      expect(after.map((result) => result.outcome)).toEqual(['passed'])
      expect(spawned()).toBe(before + 2)
      await allAliveIdle()
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'leaks no guest global between cases or submissions on the same worker',
    async () => {
      const cases = (count: number): JudgeCase[] =>
        Array.from({ length: count }, (_, input) => ({ input, expected: 'undefined' }))
      await runJudge(sourceOf(somaDosParesWorkspace), [{ input: [], expected: 0 }], testConfig)
      const before = spawned()

      const writes = await runJudge(
        'function solve(input) { const seen = typeof vazou; globalThis.vazou = 42; return seen }',
        cases(2),
        testConfig,
      )
      const reads = await runJudge(
        'function solve(input) { return typeof vazou }',
        cases(1),
        testConfig,
      )

      expect([...writes, ...reads].map((result) => result.outcome)).toEqual([
        'passed',
        'passed',
        'passed',
      ])
      // The same warm worker served both: the isolation is the fresh runtime
      // and context per case, not a fresh worker.
      expect(spawned()).toBe(before)
    },
    TEST_TIMEOUT_MS,
  )
})

describe('getJudgeLoad', () => {
  // #279: the organizer's live card reads the semaphore as-is. The slot is
  // claimed synchronously, before runJudgeAgainstWorker's first await, so five
  // calls fired in one tick against a limit of 3 land exactly at 3 running and
  // 2 queued — no timer, no sleep.
  it(
    'reports 3 in flight and 2 waiting when 5 submissions share 3 slots',
    async () => {
      const cases: JudgeCase[] = [{ input: 'a', expected: 'a' }]
      const runs = Array.from({ length: 5 }, () =>
        runJudgeAgainstWorker(CRASH_WORKER_URL, 'unused', cases, { ...testConfig, concurrency: 3 }),
      )

      expect(getJudgeLoad()).toEqual({ inFlight: 3, waiting: 2 })

      await Promise.all(runs)
      expect(getJudgeLoad()).toEqual({ inFlight: 0, waiting: 0 })
    },
    TEST_TIMEOUT_MS,
  )
})

// #137: one entry per judged submission, read by the load harness through
// GET /organizer/stats/process. Only shapes and counts are asserted — never a
// duration against another, nor against a bound (#431).
describe('getJudgeTimings', () => {
  const lastRun = () => getJudgeTimings().runs.at(-1)

  it(
    'records a passed run on the real worker, with its spawn, execution and every case',
    async () => {
      const cases: JudgeCase[] = [
        { input: [1, 2, 3, 4], expected: 6 },
        { input: [], expected: 0 },
      ]
      const before = getJudgeTimings().runs.at(-1)?.seq ?? 0
      await runJudge(sourceOf(somaDosParesWorkspace), cases, testConfig)

      const run = lastRun()
      expect(run?.seq).toBeGreaterThan(before)
      expect(run).toMatchObject({
        outcome: 'passed',
        cases: 2,
        waitingAtArrival: 0,
        spawnMs: expect.any(Number),
        execMs: expect.any(Number),
        queueMs: expect.any(Number),
        caseMs: expect.any(Number),
      })
      expect(run?.spawnMs).toBeGreaterThanOrEqual(0)
      expect(run?.execMs).toBeGreaterThanOrEqual(0)
      expect(run?.endedAt).toBeGreaterThanOrEqual(run?.arrivedAt ?? Number.POSITIVE_INFINITY)
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'counts the queue position, not time: the second of two at concurrency 1 waited behind one',
    async () => {
      const cases: JudgeCase[] = [{ input: 'a', expected: 'a' }]
      const config = { ...testConfig, concurrency: 1 }
      const before = getJudgeTimings().runs.at(-1)?.seq ?? 0
      await Promise.all([
        runJudgeAgainstWorker(CRASH_WORKER_URL, 'unused', cases, config),
        runJudgeAgainstWorker(CRASH_WORKER_URL, 'unused', cases, config),
      ])

      const runs = getJudgeTimings().runs.filter((run) => run.seq > before)
      expect(runs.map((run) => run.waitingAtArrival).sort()).toEqual([0, 1])
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'records a worker that died before ready as runtime_error with no spawn time',
    async () => {
      // The double never sends `ready`, so there is no spawn to measure.
      const cases: JudgeCase[] = [{ input: '__crash__', expected: null }]
      await runJudgeAgainstWorker(CRASH_WORKER_URL, 'unused', cases, testConfig)
      expect(lastRun()).toMatchObject({ outcome: 'runtime_error', spawnMs: null, cases: 1 })
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'reports the worst case as the outcome: a timeout beats a pass',
    async () => {
      const source = 'function solve(input) { if (input === 1) { while (true) {} } return input }'
      const cases: JudgeCase[] = [
        { input: 0, expected: 0 },
        { input: 1, expected: 1 },
      ]
      await runJudge(source, cases, { ...testConfig, timeoutMs: 200 })
      expect(lastRun()?.outcome).toBe('timeout')
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'keeps every clean worker idle in the pool and leaves no other alive (#277)',
    async () => {
      const workerUrl = isolatedWorkerUrl()
      const before = getJudgeTimings().workers
      const cases: JudgeCase[] = [{ input: 'a', expected: 'a' }]
      await Promise.all(
        Array.from({ length: 3 }, () =>
          runJudgeAgainstWorker(workerUrl, 'unused', cases, testConfig),
        ),
      )

      const after = getJudgeTimings().workers
      expect(after.spawned).toBe(before.spawned + 3)
      expect(after.idle).toBe(before.idle + 3)
      await allAliveIdle()
    },
    TEST_TIMEOUT_MS,
  )

  it('reports the configuration the process judges with', () => {
    expect(getJudgeTimings().config).toEqual({
      concurrency: expect.any(Number),
      timeoutMs: expect.any(Number),
      memoryMb: expect.any(Number),
    })
  })
})

describe('WorkspaceSchema', () => {
  it('accepts a serialized workspace object', () => {
    expect(WorkspaceSchema.safeParse(somaDosPares).success).toBe(true)
  })

  // Deliberately permissive: the schema only proves "this is a JSON object".
  // The real shape belongs to Blockly's deserializer, and a second definition
  // in zod would drift away from it.
  it.each([
    { name: 'a string', value: 'texto' },
    { name: 'an array', value: [1, 2] },
    { name: 'null', value: null },
  ])('rejects $name', ({ value }) => {
    expect(WorkspaceSchema.safeParse(value).success).toBe(false)
  })
})

describe('generateJudgeSource', () => {
  it('generates the solve(input) source of a valid workspace', () => {
    const result = generateJudgeSource(somaDosParesWorkspace)
    expect(result.ok).toBe(true)
    expect(result.ok && result.source).toContain('function solve(input)')
  })

  it('refuses a workspace without the root block', () => {
    const result = generateJudgeSource({
      blocks: {
        languageVersion: 0,
        blocks: [{ type: 'math_number', id: 'solto', fields: { NUM: 1 } }],
      },
    })
    expect(result).toEqual({ ok: false, error: 'missing_root', message: expect.any(String) })
  })

  it('refuses a workspace with two root blocks', () => {
    const result = generateJudgeSource({
      blocks: {
        languageVersion: 0,
        blocks: [
          { type: 'kumite_solve', id: 'raizA', x: 0, y: 0 },
          { type: 'kumite_solve', id: 'raizB', x: 0, y: 200 },
        ],
      },
    })
    expect(result).toEqual({ ok: false, error: 'duplicate_root', message: expect.any(String) })
  })

  it('refuses a block outside the curated toolbox, naming it', () => {
    const result = generateJudgeSource({
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'kumite_solve',
            id: 'raiz',
            inputs: { BODY: { block: { type: 'text_print', id: 'proibido' } } },
          },
        ],
      },
    })
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ error: 'block_not_allowed', blockType: 'text_print' })
    expect(result.ok === false && result.message).toContain('text_print')
  })

  it('refuses a non-deterministic block option, naming the block (#182)', () => {
    // The workspace the editor can no longer build, arriving from a direct
    // POST. It used to be judged — differently on every attempt.
    const result = generateJudgeSource(indiceAleatorioWorkspace)

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({
      error: 'field_value_not_allowed',
      blockType: 'lists_getIndex',
    })
    expect(result.ok === false && result.message).toBe(
      'O bloco "lists_getIndex" está com uma opção que não é permitida: a sua solução precisa dar sempre o mesmo resultado.',
    )
    expect(generateJudgeSource(indiceAleatorioWorkspace, 'es')).toMatchObject({
      message:
        'El bloque "lists_getIndex" tiene una opción que no está permitida: tu solución tiene que dar siempre el mismo resultado.',
    })
    expect(generateJudgeSource(indiceAleatorioWorkspace, 'en')).toMatchObject({
      message:
        'The "lists_getIndex" block has an option that is not allowed: your solution must always give the same result.',
    })
  })

  it('refuses a workspace Blockly cannot read', () => {
    const result = generateJudgeSource({
      blocks: { languageVersion: 0, blocks: [{ semTipo: true }] },
    })
    expect(result).toEqual({ ok: false, error: 'malformed_workspace', message: expect.any(String) })
  })

  it('refuses a workspace whose root block is disabled', () => {
    const result = generateJudgeSource(raizDesabilitadaWorkspace)

    expect(result).toEqual({ ok: false, error: 'disabled_block', message: expect.any(String) })
    expect(result.ok === false && result.message).toBe(
      'Há um bloco desabilitado na sua solução. Reative-o para continuar.',
    )
    expect(generateJudgeSource(raizDesabilitadaWorkspace, 'en')).toMatchObject({
      message: 'There is a disabled block in your solution. Re-enable it to continue.',
    })
    // #419: the es refusal says "tú", like the rest of the product — no voseo.
    expect(generateJudgeSource(raizDesabilitadaWorkspace, 'es')).toMatchObject({
      message: 'Hay un bloque deshabilitado en tu solución. Reactívalo para continuar.',
    })
  })

  it('refuses a workspace whose source carries the signature but does not parse', () => {
    // A text field carrying U+000D: Blockly's `quote_` does not escape it, so
    // the source keeps the `solve` signature and still throws `SyntaxError` on
    // instantiation. Reached with a real workspace, no seam — this is what the
    // judge would otherwise have run, reporting every case as a runtime error.
    const result = generateJudgeSource(textoQueNaoParseia)

    expect(result).toEqual({
      ok: false,
      error: 'invalid_generated_code',
      message: expect.any(String),
    })
  })

  it('maps the structural guard to its own client code', () => {
    // Same seam as the blocks package's own test, for the empty-success shape
    // specifically: no workspace produces `"\n\n\n"` any more, and that is the
    // point — the mapping has to outlive the path that first needed it.
    const finish = vi.spyOn(javascriptGenerator, 'finish').mockReturnValue('\n\n\n')
    try {
      const result = generateJudgeSource(somaDosParesWorkspace)

      expect(result).toEqual({
        ok: false,
        error: 'invalid_generated_code',
        message: expect.any(String),
      })
    } finally {
      finish.mockRestore()
    }
  })

  it('localizes the refusal message', () => {
    const workspace = { blocks: { languageVersion: 0, blocks: [] } }
    const pt = generateJudgeSource(workspace, 'pt')
    const es = generateJudgeSource(workspace, 'es')

    expect(pt.ok === false && pt.message).toBe('A solução precisa do bloco "resolver".')
    expect(es.ok === false && es.message).toBe('La solución necesita el bloque "resolver".')
  })
})

describe('editor ↔ judge parity', () => {
  it(
    'runs the canonical fixture through codegen and the real sandbox',
    async () => {
      // The whole chain the submission route (#21) will walk: the workspace the
      // editor saves -> generateJudgeSource -> QuickJS. If the headless
      // generator and the editor's generator ever diverge, this is what fails.
      const source = sourceOf(somaDosParesWorkspace)
      const cases: JudgeCase[] = [
        { input: [1, 2, 3, 4], expected: 6 },
        { input: [], expected: 0 },
        { input: [1, 3, 5], expected: 0 },
      ]

      const results = await runJudge(source, cases, testConfig)

      // Three cases in one call also cover the generator's variable
      // declarations sitting above solve(): the worker builds a fresh QuickJS
      // runtime per case, so `soma` never leaks from one run into the next.
      expect(results.map((result) => result.outcome)).toEqual(['passed', 'passed', 'passed'])
    },
    TEST_TIMEOUT_MS,
  )
})
