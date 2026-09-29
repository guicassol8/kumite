import { praticaDevolvaEntrada, praticaEPar, praticaSomaLista } from '@kumite/blocks'
import { describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { deepEqual } from './deep-equal'
import { blockIdsIn, demoStepState, outermostRevealedAt } from './practice-demo'
import { PRACTICE_DEMOS } from './practice-demos'

/** The ids a step's block depends on: its parent, found in the solution. */
function parentOf(state: Record<string, unknown>, id: string): string | undefined {
  let found: string | undefined
  const walk = (value: unknown, parent: string | undefined) => {
    if (Array.isArray(value)) return value.forEach((item) => walk(item, parent))
    if (value === null || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    const own = typeof record['id'] === 'string' ? record['id'] : undefined
    if (own === id) found = parent
    for (const [key, child] of Object.entries(record)) {
      // `fields.VAR.id` is a variable id, not a block: never walk into fields.
      if (key === 'fields') continue
      walk(child, own ?? parent)
    }
  }
  walk(state['blocks'], undefined)
  return found
}

describe('PRACTICE_DEMOS', () => {
  it('ends each script on its own @kumite/blocks fixture, not on a copy', () => {
    expect(PRACTICE_DEMOS['devolva-entrada'].solution).toBe(praticaDevolvaEntrada)
    expect(PRACTICE_DEMOS['e-par'].solution).toBe(praticaEPar)
    expect(PRACTICE_DEMOS['soma-lista'].solution).toBe(praticaSomaLista)
  })

  it('has the step count the plan set: 2, 6 and 8', () => {
    expect(PRACTICE_DEMOS['devolva-entrada'].steps).toHaveLength(2)
    expect(PRACTICE_DEMOS['e-par'].steps).toHaveLength(6)
    expect(PRACTICE_DEMOS['soma-lista'].steps).toHaveLength(8)
  })

  describe.each(Object.entries(PRACTICE_DEMOS))('%s', (_key, script) => {
    const allIds = blockIdsIn(script.solution)
    const last = script.steps.length - 1

    it('reveals every block of the solution exactly once', () => {
      const revealed = script.steps.flatMap((step) => step.reveal)
      expect([...revealed].sort()).toEqual([...allIds].sort())
    })

    it('opens on the root block alone', () => {
      expect(script.steps[0]?.reveal).toEqual(['raiz'])
    })

    it('shows, on each step, exactly the blocks revealed so far — none orphaned', () => {
      script.steps.forEach((_step, index) => {
        const expected = script.steps.slice(0, index + 1).flatMap((step) => step.reveal)
        expect([...blockIdsIn(demoStepState(script, index))].sort()).toEqual([...expected].sort())
      })
    })

    it('never reveals a block before its parent', () => {
      const stepOf = new Map(
        script.steps.flatMap((step, index) => step.reveal.map((id) => [id, index] as const)),
      )
      for (const id of allIds) {
        const parent = parentOf(script.solution, id)
        if (parent === undefined) continue
        expect(stepOf.get(parent)).toBeLessThanOrEqual(stepOf.get(id) ?? -1)
      }
    })

    // #212 review: each step's glow lands on one block — the one the step's
    // sentence talks about — never on several at once.
    it('glows exactly one block on every step', () => {
      script.steps.forEach((_step, index) => {
        expect(outermostRevealedAt(script, index)).toHaveLength(1)
      })
    })

    it('ends on the reference solution', () => {
      expect(deepEqual(demoStepState(script, last), script.solution)).toBe(true)
    })

    it.each(['pt', 'es', 'en'] as const)('explains every step in %s', (locale) => {
      for (const step of script.steps) {
        // The raw resource, not t(): t() would fall back to pt and hide a
        // missing es/en sentence.
        const text: unknown = i18n.getResource(locale, 'translation', step.textKey)
        expect(typeof text).toBe('string')
        expect(String(text).trim()).not.toBe('')
        expect(text).not.toBe(step.textKey)
      }
    })
  })
})
