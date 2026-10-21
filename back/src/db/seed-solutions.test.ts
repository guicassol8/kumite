import { allowedBlockTypes, type WorkspaceState } from '@kumite/blocks'
import { describe, expect, it } from 'vitest'

import { WorkspaceSchema } from '../modules/judge/judge.schema'
import { generateJudgeSource, runJudge } from '../modules/judge/judge.service'
import type { TestCase } from '../modules/problems/problems.schema'
import { SEED_PROBLEMS } from './seed'
import { SEED_SOLUTIONS, SEED_TRAPS } from './seed-solutions'

const TEST_TIMEOUT_MS = 15_000

const ptTitleOf = (problem: { translations: { locale: string; title: string }[] }) =>
  problem.translations.find((t) => t.locale === 'pt')?.title ?? ''

/** Every `type` in a serialized workspace, however deep (as in
 * practice-problems.test.ts). */
function blockTypesIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(blockTypesIn)
  if (value === null || typeof value !== 'object') return []
  const own = 'type' in value && typeof value.type === 'string' ? [value.type] : []
  return [...own, ...Object.values(value).flatMap(blockTypesIn)]
}

/** Each case's outcome, in order, judged like a real submission. */
async function judge(solution: WorkspaceState, testCases: TestCase[]) {
  const generated = generateJudgeSource(WorkspaceSchema.parse(solution))
  if (!generated.ok) throw new Error(`unexpected codegen refusal: ${generated.error}`)

  const results = await runJudge(
    generated.source,
    testCases.map(({ input, expected }) => ({ input, expected })),
    { timeoutMs: 2000, memoryMb: 64, concurrency: 4 },
  )
  return results.map((result) => result.outcome)
}

describe('SEED_SOLUTIONS (#483)', () => {
  it('has exactly one reference solution per seed problem', () => {
    expect(Object.keys(SEED_SOLUTIONS).sort()).toEqual(SEED_PROBLEMS.map(ptTitleOf).sort())
  })

  describe.each(SEED_PROBLEMS.map((problem) => [ptTitleOf(problem), problem] as const))(
    '%s',
    (title, problem) => {
      const solution = SEED_SOLUTIONS[title] as WorkspaceState

      it(
        'has a reference solution that passes every case in the judge sandbox',
        async () => {
          const outcomes = await judge(solution, problem.testCases)

          expect(outcomes).toEqual(problem.testCases.map(() => 'passed'))
        },
        TEST_TIMEOUT_MS,
      )

      it('builds its solution only from blocks in allowedBlockTypes', () => {
        const types = blockTypesIn((solution as { blocks: unknown }).blocks)

        expect(types.length).toBeGreaterThan(0)
        for (const type of types) expect(allowedBlockTypes).toContain(type)
      })
    },
  )
})

describe('SEED_TRAPS (#483)', () => {
  it('only names seed problems', () => {
    for (const title of Object.keys(SEED_TRAPS)) {
      expect(SEED_PROBLEMS.map(ptTitleOf)).toContain(title)
    }
  })

  describe.each(Object.entries(SEED_TRAPS))('%s', (title, trap) => {
    const problem = SEED_PROBLEMS.find((p) => ptTitleOf(p) === title)

    it(
      'passes every visible case and fails at least one hidden case',
      async () => {
        const testCases = problem?.testCases ?? []
        const outcomes = await judge(trap, testCases)

        const visible = outcomes.filter((_, i) => !testCases[i]?.hidden)
        const hidden = outcomes.filter((_, i) => testCases[i]?.hidden)
        expect(visible.every((outcome) => outcome === 'passed')).toBe(true)
        expect(hidden.some((outcome) => outcome !== 'passed')).toBe(true)
      },
      TEST_TIMEOUT_MS,
    )
  })
})
