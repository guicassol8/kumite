import argon2 from 'argon2'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { parseEnv } from '../lib/env'
import type { Difficulty, TestCase, TranslationInput } from '../modules/problems/problems.schema'
import { createProblem, publishProblem, updateProblem } from '../modules/problems/problems.service'
import type { Db } from './client'
import { createDb } from './client'
import { PRACTICE_PROBLEMS } from './practice-problems'
import {
  eventCodesTable,
  eventConfigTable,
  problemsTable,
  problemTranslationsTable,
  usersTable,
} from './schema'

type SeedProblem = {
  difficulty: Difficulty
  points: number
  testCases: TestCase[]
  translations: TranslationInput[]
}

// pt/es/en title + statement, visible/hidden test cases, 3 difficulties.
// Every problem has a reference solution in seed-solutions.ts, run against
// its cases in the judge sandbox by seed-solutions.test.ts (#483) — proof it
// is solvable with the curated toolbox. "Soma dos Pares" mirrors the demo hardcode (front/src/components/problem/
// soma-dos-pares.ts) — keep the two in manual sync if either changes.
export const SEED_PROBLEMS: SeedProblem[] = [
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
    difficulty: 'easy',
    points: 100,
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
    difficulty: 'medium',
    points: 150,
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
  {
    difficulty: 'medium',
    points: 150,
    testCases: [
      { input: 7, expected: true, hidden: false },
      { input: 12, expected: false, hidden: false },
      { input: 1, expected: false, hidden: false },
      { input: 2, expected: true, hidden: true },
      { input: 0, expected: false, hidden: true },
      { input: 49, expected: false, hidden: true },
      { input: 91, expected: false, hidden: true },
      { input: 97, expected: true, hidden: true },
      { input: 7919, expected: true, hidden: true },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'Inscritos Primos',
        statementMd: [
          'O sensei tem uma superstição: só abre o torneio quando o número de inscritos é primo.',
          '',
          'A entrada é um número inteiro, 0 ou maior. Devolva `true` se ele for primo e `false` se não for. Um número é primo quando é maior que 1 e só pode ser dividido sem resto por 1 e por ele mesmo: 7 é primo, 12 não é (12 = 3 × 4).',
        ].join('\n'),
      },
      {
        locale: 'es',
        title: 'Inscritos Primos',
        statementMd: [
          'El sensei tiene una superstición: solo abre el torneo cuando el número de inscritos es primo.',
          '',
          'La entrada es un número entero, 0 o mayor. Devuelve `true` si es primo y `false` si no lo es. Un número es primo cuando es mayor que 1 y solo se puede dividir sin resto entre 1 y entre sí mismo: 7 es primo, 12 no lo es (12 = 3 × 4).',
        ].join('\n'),
      },
      {
        locale: 'en',
        title: 'Prime Sign-ups',
        statementMd: [
          'The sensei has a superstition: the tournament only opens when the number of sign-ups is prime.',
          '',
          'The input is an integer, 0 or greater. Return `true` if it is prime and `false` if it is not. A number is prime when it is greater than 1 and can only be divided with no remainder by 1 and by itself: 7 is prime, 12 is not (12 = 3 × 4).',
        ].join('\n'),
      },
    ],
  },
  {
    difficulty: 'medium',
    points: 150,
    testCases: [
      { input: 1, expected: 1, hidden: false },
      { input: 3, expected: 3, hidden: false },
      { input: 4, expected: 5, hidden: false },
      { input: 2, expected: 2, hidden: true },
      { input: 10, expected: 89, hidden: true },
      { input: 30, expected: 1346269, hidden: true },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'Escadaria do Dojo',
        statementMd: [
          'Para chegar ao dojo é preciso subir uma escada. A cada passo você sobe 1 ou 2 degraus.',
          '',
          'A entrada é o número de degraus, 1 ou mais. Devolva de quantas formas diferentes dá para subir a escada inteira. Com 3 degraus há 3 formas: 1 + 1 + 1, 1 + 2 e 2 + 1.',
        ].join('\n'),
      },
      {
        locale: 'es',
        title: 'La Escalera del Dojo',
        statementMd: [
          'Para llegar al dojo hay que subir una escalera. En cada paso subes 1 o 2 escalones.',
          '',
          'La entrada es el número de escalones, 1 o más. Devuelve de cuántas formas distintas se puede subir la escalera entera. Con 3 escalones hay 3 formas: 1 + 1 + 1, 1 + 2 y 2 + 1.',
        ].join('\n'),
      },
      {
        locale: 'en',
        title: 'The Dojo Staircase',
        statementMd: [
          'To reach the dojo you have to climb a staircase. Each step takes you up 1 or 2 stairs.',
          '',
          'The input is the number of stairs, 1 or more. Return how many different ways there are to climb the whole staircase. With 3 stairs there are 3 ways: 1 + 1 + 1, 1 + 2 and 2 + 1.',
        ].join('\n'),
      },
    ],
  },
  {
    difficulty: 'hard',
    points: 200,
    testCases: [
      { input: [5, 3, 5, 1], expected: 3, hidden: false },
      { input: [10, 20, 30], expected: 20, hidden: false },
      { input: [-1, -5, -3], expected: -3, hidden: true },
      { input: [7, 7, 7, 2], expected: 2, hidden: true },
      { input: [2, 9], expected: 2, hidden: true },
      { input: [4, 1, 4, 3, 4], expected: 3, hidden: true },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'Medalha de Prata',
        statementMd: [
          'A lista traz a pontuação final de cada lutador. O ouro vai para a maior pontuação, e a prata para a maior pontuação que seja **menor** que a do ouro. Se vários lutadores empatam no topo, todos ficam com o ouro.',
          '',
          'A entrada é uma lista de números inteiros com pelo menos dois valores diferentes. Devolva a pontuação da prata. Em `[5, 3, 5, 1]` o ouro é 5 e a prata é 3.',
        ].join('\n'),
      },
      {
        locale: 'es',
        title: 'Medalla de Plata',
        statementMd: [
          'La lista trae la puntuación final de cada luchador. El oro va para la mayor puntuación, y la plata para la mayor puntuación que sea **menor** que la del oro. Si varios luchadores empatan en lo más alto, todos se llevan el oro.',
          '',
          'La entrada es una lista de números enteros con al menos dos valores distintos. Devuelve la puntuación de la plata. En `[5, 3, 5, 1]` el oro es 5 y la plata es 3.',
        ].join('\n'),
      },
      {
        locale: 'en',
        title: 'Silver Medal',
        statementMd: [
          'The list holds the final score of each fighter. Gold goes to the highest score, and silver to the highest score that is **lower** than gold. If several fighters tie at the top, they all get gold.',
          '',
          'The input is a list of integers with at least two different values. Return the silver score. In `[5, 3, 5, 1]` gold is 5 and silver is 3.',
        ].join('\n'),
      },
    ],
  },
  {
    difficulty: 'hard',
    points: 200,
    testCases: [
      { input: [-2, 1, -3, 4, -1, 2, 1, -5, 4], expected: 6, hidden: false },
      { input: [1, 2, 3], expected: 6, hidden: false },
      { input: [-3, -1, -2], expected: -1, hidden: true },
      { input: [5], expected: 5, hidden: true },
      { input: [5, -9, 6], expected: 6, hidden: true },
      { input: [2, -1, 2, -1, 2], expected: 4, hidden: true },
      { input: [-1, 4, -10, 3, 3], expected: 6, hidden: true },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'Melhor Sequência de Golpes',
        statementMd: [
          'Cada número da lista é o saldo de um golpe na luta: positivo quando o golpe pontua, negativo quando dá ponto ao adversário. O treinador quer saber qual foi a melhor sequência de golpes seguidos.',
          '',
          'A entrada é uma lista de números inteiros com pelo menos um item. Devolva a maior soma possível de um trecho de itens **seguidos** da lista, com pelo menos um item. Em `[-2, 1, -3, 4, -1, 2, 1, -5, 4]` o melhor trecho é `4, -1, 2, 1`, que soma 6.',
        ].join('\n'),
      },
      {
        locale: 'es',
        title: 'Mejor Secuencia de Golpes',
        statementMd: [
          'Cada número de la lista es el saldo de un golpe en el combate: positivo cuando el golpe puntúa, negativo cuando le da un punto al rival. El entrenador quiere saber cuál fue la mejor secuencia de golpes seguidos.',
          '',
          'La entrada es una lista de números enteros con al menos un elemento. Devuelve la mayor suma posible de un tramo de elementos **seguidos** de la lista, con al menos un elemento. En `[-2, 1, -3, 4, -1, 2, 1, -5, 4]` el mejor tramo es `4, -1, 2, 1`, que suma 6.',
        ].join('\n'),
      },
      {
        locale: 'en',
        title: 'Best Combo',
        statementMd: [
          'Each number in the list is the balance of one strike in the fight: positive when the strike scores, negative when it hands a point to the opponent. The coach wants to know the best run of consecutive strikes.',
          '',
          'The input is a list of integers with at least one item. Return the largest possible sum of a stretch of **consecutive** items of the list, with at least one item. In `[-2, 1, -3, 4, -1, 2, 1, -5, 4]` the best stretch is `4, -1, 2, 1`, which adds up to 6.',
        ].join('\n'),
      },
    ],
  },
  {
    difficulty: 'hard',
    points: 200,
    testCases: [
      { input: 10, expected: '1010', hidden: false },
      { input: 5, expected: '101', hidden: false },
      { input: 1, expected: '1', hidden: false },
      { input: 0, expected: '0', hidden: true },
      { input: 2, expected: '10', hidden: true },
      { input: 37, expected: '100101', hidden: true },
      { input: 255, expected: '11111111', hidden: true },
      { input: 1024, expected: '10000000000', hidden: true },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'Placar em Binário',
        statementMd: [
          'O placar eletrônico do dojo é antigo e só mostra os dígitos 0 e 1: toda pontuação precisa aparecer em binário.',
          '',
          'A entrada é um número inteiro, 0 ou maior. Devolva esse número escrito em binário, sem zeros à esquerda: 10 vira `"1010"`, porque 10 = 8 + 2, e 0 vira `"0"`.',
          '',
          'A resposta é um **texto**, não um número: monte-a com os blocos de **Texto**.',
        ].join('\n'),
      },
      {
        locale: 'es',
        title: 'Marcador en Binario',
        statementMd: [
          'El marcador electrónico del dojo es antiguo y solo muestra los dígitos 0 y 1: toda puntuación tiene que aparecer en binario.',
          '',
          'La entrada es un número entero, 0 o mayor. Devuelve ese número escrito en binario, sin ceros a la izquierda: 10 se vuelve `"1010"`, porque 10 = 8 + 2, y 0 se vuelve `"0"`.',
          '',
          'La respuesta es un **texto**, no un número: ármala con los bloques de **Texto**.',
        ].join('\n'),
      },
      {
        locale: 'en',
        title: 'Binary Scoreboard',
        statementMd: [
          "The dojo's electronic scoreboard is old and only shows the digits 0 and 1: every score has to appear in binary.",
          '',
          'The input is an integer, 0 or greater. Return that number written in binary, with no leading zeros: 10 becomes `"1010"`, because 10 = 8 + 2, and 0 becomes `"0"`.',
          '',
          'The answer is **text**, not a number: build it with the **Text** blocks.',
        ].join('\n'),
      },
    ],
  },
  {
    difficulty: 'hard',
    points: 200,
    testCases: [
      {
        input: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        expected: 25,
        hidden: false,
      },
      {
        input: [
          [1, 2],
          [3, 4],
        ],
        expected: 10,
        hidden: false,
      },
      { input: [[5]], expected: 5, hidden: true },
      {
        input: [
          [1, 0, 0, 2],
          [0, 3, 4, 0],
          [0, 5, 6, 0],
          [7, 0, 0, 8],
        ],
        expected: 36,
        hidden: true,
      },
      {
        input: [
          [-1, 2, 3],
          [4, -5, 6],
          [7, 8, -9],
        ],
        expected: -5,
        hidden: true,
      },
      {
        input: [
          [1, 2, 3, 4, 5],
          [6, 7, 8, 9, 10],
          [11, 12, 13, 14, 15],
          [16, 17, 18, 19, 20],
          [21, 22, 23, 24, 25],
        ],
        expected: 117,
        hidden: true,
      },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'O X do Tatame',
        statementMd: [
          'O tatame é um quadriculado de N × N placas, e cada placa tem um número. Na cerimônia de abertura, os lutadores percorrem as duas diagonais, formando um X, e somam os números das placas que pisam.',
          '',
          'A entrada é uma lista de N linhas, e cada linha é uma lista de N números (N é 1 ou mais). Devolva a soma das placas das duas diagonais. Quando as diagonais se cruzam numa placa, ela conta **uma vez só**. Em `[[1, 2, 3], [4, 5, 6], [7, 8, 9]]` a soma é 1 + 5 + 9 + 3 + 7 = 25.',
          '',
          'Nas listas, o primeiro item fica na posição 1.',
        ].join('\n'),
      },
      {
        locale: 'es',
        title: 'La X del Tatami',
        statementMd: [
          'El tatami es una cuadrícula de N × N placas, y cada placa tiene un número. En la ceremonia de apertura, los luchadores recorren las dos diagonales, formando una X, y suman los números de las placas que pisan.',
          '',
          'La entrada es una lista de N filas, y cada fila es una lista de N números (N es 1 o más). Devuelve la suma de las placas de las dos diagonales. Cuando las diagonales se cruzan en una placa, esta cuenta **una sola vez**. En `[[1, 2, 3], [4, 5, 6], [7, 8, 9]]` la suma es 1 + 5 + 9 + 3 + 7 = 25.',
          '',
          'En las listas, el primer elemento está en la posición 1.',
        ].join('\n'),
      },
      {
        locale: 'en',
        title: 'The X on the Mat',
        statementMd: [
          'The mat is a grid of N × N tiles, and each tile has a number. At the opening ceremony, the fighters walk both diagonals, forming an X, and add up the numbers of the tiles they step on.',
          '',
          'The input is a list of N rows, and each row is a list of N numbers (N is 1 or more). Return the sum of the tiles on both diagonals. Where the diagonals cross on a tile, it counts **only once**. In `[[1, 2, 3], [4, 5, 6], [7, 8, 9]]` the sum is 1 + 5 + 9 + 3 + 7 = 25.',
          '',
          'In lists, the first item is at position 1.',
        ].join('\n'),
      },
    ],
  },
  {
    difficulty: 'hard',
    points: 300,
    testCases: [
      { input: [7, 1, 3, 3, 9], expected: 3, hidden: false },
      { input: [5, 2, 8], expected: 5, hidden: false },
      { input: [4], expected: 4, hidden: true },
      { input: [2, 2, 2, 1, 9], expected: 2, hidden: true },
      { input: [-5, 10, 0, -3, 7], expected: 0, hidden: true },
      { input: [9, 8, 7, 6, 5, 4, 3], expected: 6, hidden: true },
      { input: [1, 1, 5, 5, 5], expected: 5, hidden: true },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'O Lutador do Meio',
        statementMd: [
          'O sensei enfileira os lutadores do mais leve ao mais pesado e chama quem fica exatamente no meio da fila para ser o árbitro.',
          '',
          'A entrada é uma lista com o peso de cada lutador: um número ímpar de itens, fora de ordem e talvez com pesos repetidos. Devolva o peso de quem fica no meio da fila depois de ordenada (a mediana). `[7, 1, 3, 3, 9]` ordenada fica `1, 3, 3, 7, 9`, e o do meio é 3.',
          '',
          'Não existe bloco de ordenar: o desafio é achar o do meio sem ele.',
        ].join('\n'),
      },
      {
        locale: 'es',
        title: 'El Luchador del Medio',
        statementMd: [
          'El sensei pone en fila a los luchadores del más liviano al más pesado y llama a quien queda justo en el medio de la fila para que sea el árbitro.',
          '',
          'La entrada es una lista con el peso de cada luchador: un número impar de elementos, desordenados y quizá con pesos repetidos. Devuelve el peso de quien queda en el medio de la fila una vez ordenada (la mediana). `[7, 1, 3, 3, 9]` ordenada queda `1, 3, 3, 7, 9`, y el del medio es 3.',
          '',
          'No existe un bloque para ordenar: el desafío es encontrar el del medio sin él.',
        ].join('\n'),
      },
      {
        locale: 'en',
        title: 'The Middle Fighter',
        statementMd: [
          'The sensei lines the fighters up from lightest to heaviest and calls whoever stands exactly in the middle of the line to be the referee.',
          '',
          'The input is a list with the weight of each fighter: an odd number of items, out of order and maybe with repeated weights. Return the weight of whoever stands in the middle once the line is sorted (the median). `[7, 1, 3, 3, 9]` sorted becomes `1, 3, 3, 7, 9`, and the middle one is 3.',
          '',
          'There is no sorting block: the challenge is to find the middle one without it.',
        ].join('\n'),
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

// The practice catalog (#210). Same insert-if-missing rule as the competition
// seed, keyed on the pt title but only among practice problems, so no round
// problem can stand in for a practice one. The competition seed is the other
// way round on purpose: it matches its titles against every problem, so a seed
// problem the organizer turned into practice is not re-added as a round one
// (#287). Seed data can't collide — practice-problems.test.ts keeps the two
// sets of pt titles disjoint. Sequential on purpose: each insert is its
// own transaction, so `created_at` follows PRACTICE_PROBLEMS' order — the
// tie-break listPracticeProblems relies on inside a difficulty.
async function seedPracticeProblems(db: Db): Promise<void> {
  for (const practiceProblem of PRACTICE_PROBLEMS) {
    const ptTitle = practiceProblem.translations.find((t) => t.locale === 'pt')?.title
    if (!ptTitle) throw new Error('expected a pt translation in every practice problem')

    const [existing] = await db
      .select({ id: problemsTable.id })
      .from(problemTranslationsTable)
      .innerJoin(problemsTable, eq(problemsTable.id, problemTranslationsTable.problemId))
      .where(
        and(eq(problemTranslationsTable.title, ptTitle), eq(problemsTable.visibility, 'practice')),
      )
    if (existing) continue

    const problem = await createProblem(db, {
      difficulty: practiceProblem.difficulty,
      visibility: 'practice',
    })
    await updateProblem(db, problem.id, {
      testCases: practiceProblem.testCases,
      translations: practiceProblem.translations,
    })
    const published = await publishProblem(db, problem.id)
    if (!published.ok) {
      throw new Error(`expected practice problem "${ptTitle}" to publish, got ${published.error}`)
    }
  }
}

// Validated only here, not in config.ts's global EnvSchema — `pnpm dev` and
// `pnpm test` don't need an organizer account, only `pnpm db:seed` does.
const SeedEnvSchema = z.object({
  ORGANIZER_EMAIL: z.string().email(),
  ORGANIZER_PASSWORD: z.string().min(8),
})

// Fixed, not an env var (#122): the VPS and CI already run db:seed with the
// two variables above, and a third required one would break them.
const ORGANIZER_NAME = 'Organização kumite'

export async function seed(db: Db): Promise<void> {
  const { ORGANIZER_EMAIL, ORGANIZER_PASSWORD } = parseEnv(SeedEnvSchema, process.env, {
    subject: 'pnpm db:seed environment',
    hint: 'ORGANIZER_EMAIL and ORGANIZER_PASSWORD are required by db:seed only — see back/.env.example.',
  })

  const passwordHash = await argon2.hash(ORGANIZER_PASSWORD)
  // No target: the only unique constraints on `users` are the id PK (a fresh
  // random uuid) and the lower(email) index this seed itself would hit.
  await db
    .insert(usersTable)
    .values({
      email: ORGANIZER_EMAIL.toLowerCase(),
      name: ORGANIZER_NAME,
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

  // Insert-if-missing, like everything else in this seed (#287). deploy.yml
  // runs db:seed on every production deploy, so the seed must never overwrite
  // the organizer's configuration: #161 made this an upsert-with-reset to give
  // the test suites a known state, and that reset silently undid mixingLocked
  // / maxTeamSize on every release. The reset now lives in db/reset.ts
  // (`pnpm db:reset`), which truncates first and then calls this seed — the
  // suites get their clean state from there, production keeps its row.
  await db.insert(eventConfigTable).values({ id: 1 }).onConflictDoNothing()

  await seedProblems(db)
  await seedPracticeProblems(db)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = createDb()
  await seed(db)
  // postgres-js keeps the socket open otherwise, so the CLI script never exits.
  await db.$client.end()
}
