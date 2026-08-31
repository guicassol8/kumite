import { generateSolution, somaDosPares } from '@kumite/blocks'
import { describe, expect, it } from 'vitest'

import type { JudgeCase, JudgeConfig } from './judge.schema'
import { runJudge } from './judge.service'

const TEST_TIMEOUT_MS = 15_000

const testConfig: JudgeConfig = { timeoutMs: 2000, memoryMb: 64, concurrency: 4 }

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
})
