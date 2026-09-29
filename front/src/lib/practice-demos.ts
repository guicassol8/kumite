import { praticaDevolvaEntrada, praticaEPar, praticaSomaLista } from '@kumite/blocks'

import type { DemoScript } from './practice-demo'
import type { fetchProblem } from './problems-query'

/**
 * The keys the back links a seeded practice problem to (#212), straight from
 * `AppType`: a key added to the back's enum without a script below fails
 * `pnpm -r typecheck` on this Record.
 */
export type PracticeDemoKey = NonNullable<Awaited<ReturnType<typeof fetchProblem>>['demoKey']>

// Every script opens on the root block with the same sentence.
const ROOT_STEP = { reveal: ['raiz'], textKey: 'practice.demo.steps.root' } as const

const stepKey = (demo: PracticeDemoKey, n: number) => `practice.demo.steps.${demo}.${n}`

/**
 * The step-by-step demos of the three seeded practice problems (#210). Each
 * step names the block ids of the reference solution that enter on it; the
 * sentences live in the i18n catalogs under `practice.demo.steps`. Written by
 * the agent, reviewed by the organizer in the PR (decision of epic #208).
 */
export const PRACTICE_DEMOS: Record<PracticeDemoKey, DemoScript> = {
  'devolva-entrada': {
    solution: praticaDevolvaEntrada,
    steps: [ROOT_STEP, { reveal: ['entrada'], textKey: stepKey('devolva-entrada', 2) }],
  },
  'e-par': {
    solution: praticaEPar,
    steps: [
      ROOT_STEP,
      { reveal: ['restoZero'], textKey: stepKey('e-par', 2) },
      { reveal: ['resto'], textKey: stepKey('e-par', 3) },
      { reveal: ['entrada'], textKey: stepKey('e-par', 4) },
      { reveal: ['dois'], textKey: stepKey('e-par', 5) },
      { reveal: ['zero'], textKey: stepKey('e-par', 6) },
    ],
  },
  'soma-lista': {
    solution: praticaSomaLista,
    steps: [
      ROOT_STEP,
      { reveal: ['zeraTotal'], textKey: stepKey('soma-lista', 2) },
      { reveal: ['zero'], textKey: stepKey('soma-lista', 3) },
      { reveal: ['paraCada'], textKey: stepKey('soma-lista', 4) },
      { reveal: ['entrada'], textKey: stepKey('soma-lista', 5) },
      { reveal: ['acumula'], textKey: stepKey('soma-lista', 6) },
      { reveal: ['totalMais', 'leTotal', 'leNumero'], textKey: stepKey('soma-lista', 7) },
      { reveal: ['devolveTotal'], textKey: stepKey('soma-lista', 8) },
    ],
  },
}
