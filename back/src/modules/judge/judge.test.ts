import { generateSolution, somaDosPares } from '@kumite/blocks'
import { describe, expect, it } from 'vitest'

import type { JudgeCase, JudgeConfig } from './judge.schema'
import { WorkspaceSchema } from './judge.schema'
import { generateJudgeSource, runJudge, runJudgeAgainstWorker } from './judge.service'

const TEST_TIMEOUT_MS = 15_000

const testConfig: JudgeConfig = { timeoutMs: 2000, memoryMb: 64, concurrency: 4 }
const CRASH_WORKER_URL = new URL('../../judge-test-worker.mjs', import.meta.url)

// The fixture is typed WorkspaceState (Record<string, unknown>) by the blocks
// package; parsing it is how it becomes a Workspace here — the same step the
// route (#21) performs on the incoming body, never a cast.
const somaDosParesWorkspace = WorkspaceSchema.parse(somaDosPares)

describe('runJudge', () => {
  it(
    'passes a correct solve(input) result',
    async () => {
      const source = generateSolution(somaDosPares)
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

  it(
    'queues submissions beyond the concurrency limit instead of refusing them',
    async () => {
      // A short busy-loop, well under timeoutMs, so ordering can be read
      // straight off wall-clock elapsed time without any side channel.
      const source =
        'function solve(input) { const until = Date.now() + 200; while (Date.now() < until) {} return 1 }'
      const cases: JudgeCase[] = [{ input: [], expected: 1 }]

      const start = Date.now()
      const [a, b] = await Promise.all([
        runJudge(source, cases, { ...testConfig, concurrency: 1 }),
        runJudge(source, cases, { ...testConfig, concurrency: 1 }),
      ])
      const elapsed = Date.now() - start

      expect(a[0]?.outcome).toBe('passed')
      expect(b[0]?.outcome).toBe('passed')
      // Serialized: the second call's worker only spawns after the first
      // releases its slot, so total wall time is roughly 2x one call.
      expect(elapsed).toBeGreaterThanOrEqual(350)
    },
    TEST_TIMEOUT_MS,
  )

  it(
    'runs submissions in parallel when the concurrency limit allows it',
    async () => {
      const source =
        'function solve(input) { const until = Date.now() + 200; while (Date.now() < until) {} return 1 }'
      const cases: JudgeCase[] = [{ input: [], expected: 1 }]

      const start = Date.now()
      const [a, b] = await Promise.all([
        runJudge(source, cases, { ...testConfig, concurrency: 2 }),
        runJudge(source, cases, { ...testConfig, concurrency: 2 }),
      ])
      const elapsed = Date.now() - start

      expect(a[0]?.outcome).toBe('passed')
      expect(b[0]?.outcome).toBe('passed')
      // Parallel: total wall time stays close to one call's duration,
      // not double — guards against a queue that always serializes.
      expect(elapsed).toBeLessThan(350)
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
})
