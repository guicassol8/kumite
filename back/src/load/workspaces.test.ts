import { generateSolution } from '@kumite/blocks'
import { describe, expect, it } from 'vitest'

import { SEED_PROBLEMS } from '../db/seed'
import { generateJudgeSource, runJudge } from '../modules/judge/judge.service'

import { memoryBombWorkspace, WORKSPACES } from './workspaces'

// What the harness submits must come back with the verdict it is counted
// against (verdict.ts): proven here on the real judge, with the default
// limits, before any run relies on it (#137).

const JUDGE = { timeoutMs: 2000, memoryMb: 64, concurrency: 4 }

const somaDosParesCases = (() => {
  const problem = SEED_PROBLEMS.find((p) =>
    p.translations.some((t) => t.title === 'Soma dos Pares'),
  )
  if (!problem) throw new Error('seed has no "Soma dos Pares"')
  return problem.testCases.map(({ input, expected }) => ({ input, expected }))
})()

function sourceOf(kind: keyof typeof WORKSPACES): string {
  const result = generateJudgeSource(WORKSPACES[kind])
  if (!result.ok) throw new Error(`codegen refused ${kind}: ${result.error}`)
  return result.source
}

describe('memoryBombWorkspace', () => {
  it('is accepted by codegen: every block comes from the curated toolbox', () => {
    expect(() => generateSolution(memoryBombWorkspace)).not.toThrow()
    expect(generateJudgeSource(WORKSPACES.memory).ok).toBe(true)
  })

  it('runs out of memory on every case of "Soma dos Pares", never timing out', {
    timeout: 60_000,
  }, async () => {
    const results = await runJudge(sourceOf('memory'), somaDosParesCases, JUDGE)

    expect(results).toHaveLength(somaDosParesCases.length)
    for (const result of results) {
      expect(result.outcome).toBe('runtime_error')
      expect(result.outcome === 'runtime_error' ? result.detail : '').toMatch(/memory/i)
    }
  })
})
