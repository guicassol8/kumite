import { allowedBlockTypes } from '@kumite/blocks'
import { describe, expect, it } from 'vitest'

import { LocaleSchema } from '../lib/locale'
import { WorkspaceSchema } from '../modules/judge/judge.schema'
import { generateJudgeSource, runJudge } from '../modules/judge/judge.service'
import { evaluateTestCaseCoverage } from '../modules/problems/problems.service'
import { PRACTICE_PROBLEMS } from './practice-problems'
import { SEED_PROBLEMS } from './seed'

const TEST_TIMEOUT_MS = 15_000

const ptTitleOf = (problem: { translations: { locale: string; title: string }[] }) =>
  problem.translations.find((t) => t.locale === 'pt')?.title

/** Every `type` in a serialized workspace, however deep — the raw state, so
 * this proves what is versioned, not what a workspace load would make of it. */
function blockTypesIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(blockTypesIn)
  if (value === null || typeof value !== 'object') return []
  const own = 'type' in value && typeof value.type === 'string' ? [value.type] : []
  return [...own, ...Object.values(value).flatMap(blockTypesIn)]
}

describe('PRACTICE_PROBLEMS', () => {
  it('holds the three problems of the progression, easy → easy → medium', () => {
    expect(PRACTICE_PROBLEMS.map(ptTitleOf)).toEqual([
      'Devolva a entrada',
      'É par?',
      'Soma da lista',
    ])
    expect(PRACTICE_PROBLEMS.map((problem) => problem.difficulty)).toEqual([
      'easy',
      'easy',
      'medium',
    ])
  })

  describe.each(PRACTICE_PROBLEMS.map((problem) => [ptTitleOf(problem), problem] as const))(
    '%s',
    (_title, problem) => {
      it(
        'has a reference solution that passes every case in the judge sandbox',
        async () => {
          const generated = generateJudgeSource(WorkspaceSchema.parse(problem.solution))
          if (!generated.ok) throw new Error(`unexpected codegen refusal: ${generated.error}`)

          const results = await runJudge(
            generated.source,
            problem.testCases.map(({ input, expected }) => ({ input, expected })),
            { timeoutMs: 2000, memoryMb: 64, concurrency: 4 },
          )

          expect(results).toHaveLength(problem.testCases.length)
          for (const result of results) expect(result.outcome).toBe('passed')
        },
        TEST_TIMEOUT_MS,
      )

      it('builds its solution only from blocks in allowedBlockTypes', () => {
        const types = blockTypesIn((problem.solution as { blocks: unknown }).blocks)

        expect(types.length).toBeGreaterThan(0)
        for (const type of types) expect(allowedBlockTypes).toContain(type)
      })

      it('has a statement in every locale', () => {
        expect(problem.translations.map((t) => t.locale).sort()).toEqual(
          [...LocaleSchema.options].sort(),
        )
        for (const translation of problem.translations) {
          expect(translation.title.trim()).not.toBe('')
          expect(translation.statementMd.trim()).not.toBe('')
        }
      })

      it('has at least two visible cases, no hidden one, and publishes as practice', () => {
        expect(problem.testCases.filter((tc) => !tc.hidden).length).toBeGreaterThanOrEqual(2)
        expect(problem.testCases.filter((tc) => tc.hidden)).toEqual([])
        expect(evaluateTestCaseCoverage(problem.testCases, 'practice')).toBe('ok')
      })
    },
  )

  it('never reuses a pt title of the competition seed', () => {
    const competition = new Set(SEED_PROBLEMS.map(ptTitleOf))

    for (const problem of PRACTICE_PROBLEMS) {
      expect(competition.has(ptTitleOf(problem))).toBe(false)
    }
  })
})
