import argon2 from 'argon2'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import type { Difficulty, TestCase, TranslationInput } from '../modules/problems/problems.schema'
import { createProblem, publishProblem, updateProblem } from '../modules/problems/problems.service'
import type { Db } from './client'
import { createDb } from './client'
import { eventCodesTable, eventConfigTable, problemTranslationsTable, usersTable } from './schema'

type SeedProblem = {
  difficulty: Difficulty
  points: number
  testCases: TestCase[]
  translations: TranslationInput[]
}

// pt/es/en title + statement, visible/hidden test cases, 3 difficulties.
// "Soma dos Pares" mirrors the demo hardcode (front/src/components/problem/
// soma-dos-pares.ts) — keep the two in manual sync if either changes.
const SEED_PROBLEMS: SeedProblem[] = [
  {
    difficulty: 'easy',
    points: 100,
    testCases: [
      { input: [1, 2, 3, 4], expected: 6, hidden: false },
      { input: [5, 7, 9], expected: 0, hidden: false },
      { input: [2, 4, 6, 8], expected: 20, hidden: false },
      { input: [10, -4, 7, 3], expected: 6, hidden: true },
      { input: [], expected: 0, hidden: true },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'Soma dos Pares',
        statementMd:
          'Dada uma lista de números inteiros, retorne a soma de todos os números pares da lista.',
      },
      {
        locale: 'es',
        title: 'Suma de los Pares',
        statementMd:
          'Dada una lista de números enteros, devuelve la suma de todos los números pares de la lista.',
      },
      {
        locale: 'en',
        title: 'Sum of Evens',
        statementMd: 'Given a list of integers, return the sum of all even numbers in the list.',
      },
    ],
  },
  {
    difficulty: 'easy',
    points: 100,
    testCases: [
      { input: [3, 1, 4, 1, 5], expected: 5, hidden: false },
      { input: [-2, -8, -1], expected: -1, hidden: false },
      { input: [7], expected: 7, hidden: true },
      { input: [100, 42, 99], expected: 100, hidden: true },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'Maior Valor da Lista',
        statementMd: 'Dada uma lista de números inteiros, retorne o maior valor da lista.',
      },
      {
        locale: 'es',
        title: 'Valor Máximo de la Lista',
        statementMd: 'Dada una lista de números enteros, devuelve el valor más grande de la lista.',
      },
      {
        locale: 'en',
        title: 'Largest Value in the List',
        statementMd: 'Given a list of integers, return the largest value in the list.',
      },
    ],
  },
  {
    difficulty: 'medium',
    points: 150,
    testCases: [
      { input: [1, -2, 3, -4, -5], expected: 3, hidden: false },
      { input: [1, 2, 3], expected: 0, hidden: false },
      { input: [-1, -1, -1, -1], expected: 4, hidden: true },
      { input: [0, 0, 0], expected: 0, hidden: true },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'Contar Números Negativos',
        statementMd: 'Dada uma lista de números inteiros, retorne quantos deles são negativos.',
      },
      {
        locale: 'es',
        title: 'Contar Números Negativos',
        statementMd: 'Dada una lista de números enteros, devuelve cuántos de ellos son negativos.',
      },
      {
        locale: 'en',
        title: 'Count Negative Numbers',
        statementMd: 'Given a list of integers, return how many of them are negative.',
      },
    ],
  },
  {
    difficulty: 'hard',
    points: 200,
    testCases: [
      { input: [1, 2, 3, 4, 5], expected: 3, hidden: false },
      { input: [10, 20, 30], expected: 20, hidden: false },
      { input: [1, 2], expected: 2, hidden: true },
      { input: [4, 4, 4, 5], expected: 4, hidden: true },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'Média Arredondada',
        statementMd:
          'Dada uma lista de números inteiros, retorne a média aritmética arredondada para o inteiro mais próximo.',
      },
      {
        locale: 'es',
        title: 'Media Redondeada',
        statementMd:
          'Dada una lista de números enteros, devuelve la media aritmética redondeada al entero más cercano.',
      },
      {
        locale: 'en',
        title: 'Rounded Average',
        statementMd:
          'Given a list of integers, return the arithmetic mean rounded to the nearest integer.',
      },
    ],
  },
]

async function seedProblems(db: Db): Promise<void> {
  for (const seedProblem of SEED_PROBLEMS) {
    const ptTitle = seedProblem.translations.find((t) => t.locale === 'pt')?.title
    if (!ptTitle) throw new Error('expected a pt translation in every seed problem')

    // Lookup by pt title: neither `problems` nor `problem_translations` has a
    // unique business-key column, so this is the idempotency check.
    const [existing] = await db
      .select()
      .from(problemTranslationsTable)
      .where(eq(problemTranslationsTable.title, ptTitle))
    if (existing) continue

    const problem = await createProblem(db, {
      difficulty: seedProblem.difficulty,
      points: seedProblem.points,
    })
    await updateProblem(db, problem.id, {
      testCases: seedProblem.testCases,
      translations: seedProblem.translations,
    })
    const published = await publishProblem(db, problem.id)
    if (!published.ok) {
      throw new Error(`expected seed problem "${ptTitle}" to publish, got ${published.error}`)
    }
  }
}

// Validated only here, not in config.ts's global EnvSchema — `pnpm dev` and
// `pnpm test` don't need an organizer account, only `pnpm db:seed` does.
const SeedEnvSchema = z.object({
  ORGANIZER_EMAIL: z.string().email(),
  ORGANIZER_PASSWORD: z.string().min(8),
})

export async function seed(db: Db): Promise<void> {
  const { ORGANIZER_EMAIL, ORGANIZER_PASSWORD } = SeedEnvSchema.parse(process.env)

  const passwordHash = await argon2.hash(ORGANIZER_PASSWORD)
  // No target: the only unique constraints on `users` are the id PK (a fresh
  // random uuid) and the lower(email) index this seed itself would hit.
  await db
    .insert(usersTable)
    .values({
      email: ORGANIZER_EMAIL.toLowerCase(),
      passwordHash,
      role: 'organizer',
      university: 'pucrs',
    })
    .onConflictDoNothing()

  await db
    .insert(eventCodesTable)
    .values([
      {
        code: 'PUCRS2026',
        university: 'pucrs',
        allowedEmailSuffixes: ['edu.pucrs.br', 'pucrs.br'],
      },
      {
        code: 'MERIDA2026',
        university: 'merida',
        allowedEmailSuffixes: ['merida.edu.mx'],
      },
    ])
    .onConflictDoNothing()

  // Reset, not additive: the singleton event_config row is event-wide mutable
  // state that the vitest suite and the hurl files leave dirty, so seeding is
  // the point where it comes back to a known state. `onConflictDoNothing()`
  // would preserve whatever ran last, which is what #161 fixed.
  // Keep these values in sync with the `.default()`s on `eventConfigTable`.
  const eventConfigDefaults = { mixingLocked: false, maxTeamSize: 3 }
  await db
    .insert(eventConfigTable)
    .values({ id: 1, ...eventConfigDefaults })
    .onConflictDoUpdate({
      target: eventConfigTable.id,
      set: { ...eventConfigDefaults, updatedAt: new Date() },
    })

  await seedProblems(db)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = createDb()
  await seed(db)
  // postgres-js keeps the socket open otherwise, so the CLI script never exits.
  await db.$client.end()
}
