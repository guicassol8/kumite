import {
  praticaDevolvaEntrada,
  praticaEPar,
  praticaSomaLista,
  type WorkspaceState,
} from '@kumite/blocks'

import type { Difficulty, TestCase, TranslationInput } from '../modules/problems/problems.schema'

export type PracticeProblem = {
  difficulty: Difficulty
  testCases: TestCase[]
  translations: TranslationInput[]
  /** Reference solution, versioned in `@kumite/blocks` so the demo (#212)
   * replays the same workspace. practice-problems.test.ts runs it against
   * `testCases` in the judge sandbox. */
  solution: WorkspaceState
}

// The practice catalog (#210), in the order of the progression: seedPracticeProblems
// inserts them one by one, so `created_at` keeps this order inside a difficulty.
// Every case is visible — practice has Executar, never Submeter — and the
// statements name the blocks the way the editor shows them in each language.
// Seeded insert-if-missing (#287): once in production, a text fix goes
// through the organizer CRUD, not through this file.
export const PRACTICE_PROBLEMS: PracticeProblem[] = [
  {
    difficulty: 'easy',
    testCases: [
      { input: 7, expected: 7, hidden: false },
      { input: 42, expected: 42, hidden: false },
      { input: -3, expected: -3, hidden: false },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'Devolva a entrada',
        statementMd: [
          'A entrada é um número. Devolva esse mesmo número, sem mudar nada.',
          '',
          'Toda solução começa no bloco **resolver**. O bloco **entrada** (em **Variáveis**) traz o valor que o problema entrega, e o que você encaixar em **retornar** é a sua resposta.',
          '',
          'Aqui basta encaixar **entrada** em **retornar**.',
        ].join('\n'),
      },
      {
        locale: 'es',
        title: 'Devuelve la entrada',
        statementMd: [
          'La entrada es un número. Devuelve ese mismo número, sin cambiar nada.',
          '',
          'Toda solución empieza en el bloque **resolver**. El bloque **entrada** (en **Variables**) trae el valor que el problema entrega, y lo que encajes en **devolver** es tu respuesta.',
          '',
          'Aquí basta con encajar **entrada** en **devolver**.',
        ].join('\n'),
      },
      {
        locale: 'en',
        title: 'Return the input',
        statementMd: [
          'The input is a number. Return that same number, unchanged.',
          '',
          'Every solution starts at the **solve** block. The **input** block (in **Variables**) holds the value the problem hands you, and whatever you plug into **return** is your answer.',
          '',
          'Here, just plug **input** into **return**.',
        ].join('\n'),
      },
    ],
    solution: praticaDevolvaEntrada,
  },
  {
    difficulty: 'easy',
    testCases: [
      { input: 4, expected: true, hidden: false },
      { input: 7, expected: false, hidden: false },
      { input: 0, expected: true, hidden: false },
      { input: -3, expected: false, hidden: false },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'É par?',
        statementMd: [
          'A entrada é um número inteiro. Descubra se ele é par.',
          '',
          'A resposta aparece como `true` ou `false`: `true` significa verdadeiro (sim, é par) e `false` significa falso (não, é ímpar).',
          '',
          'Um número é par quando o resto da divisão dele por 2 é 0. Em **Matemática** há um bloco que calcula o resto de uma divisão, e em **Lógica** um bloco que compara dois valores. Encaixe a comparação direto em **retornar**: ela já é a resposta.',
        ].join('\n'),
      },
      {
        locale: 'es',
        title: '¿Es par?',
        statementMd: [
          'La entrada es un número entero. Descubre si es par.',
          '',
          'La respuesta aparece como `true` o `false`: `true` significa verdadero (sí, es par) y `false` significa falso (no, es impar).',
          '',
          'Un número es par cuando el resto de dividirlo entre 2 es 0. En **Matemáticas** hay un bloque que calcula el resto de una división, y en **Lógica** un bloque que compara dos valores. Encaja la comparación directamente en **devolver**: ya es la respuesta.',
        ].join('\n'),
      },
      {
        locale: 'en',
        title: 'Is it even?',
        statementMd: [
          'The input is an integer. Find out whether it is even.',
          '',
          'The answer shows up as `true` or `false`: `true` means yes, it is even, and `false` means no, it is odd.',
          '',
          'A number is even when the remainder of dividing it by 2 is 0. **Math** has a block that computes the remainder of a division, and **Logic** has a block that compares two values. Plug the comparison straight into **return**: it is already the answer.',
        ].join('\n'),
      },
    ],
    solution: praticaEPar,
  },
  {
    difficulty: 'medium',
    testCases: [
      { input: [1, 2, 3], expected: 6, hidden: false },
      { input: [10, -5, 5], expected: 10, hidden: false },
      { input: [], expected: 0, hidden: false },
    ],
    translations: [
      {
        locale: 'pt',
        title: 'Soma da lista',
        statementMd: [
          'A entrada é uma lista de números inteiros. Devolva a soma de todos eles. A soma de uma lista vazia é 0.',
          '',
          'Em **Variáveis**, use **Criar variável...** para guardar um total e comece-o em 0. Depois, com o bloco de **Laços** que passa por cada item de uma lista, some cada número ao total. No fim, encaixe o total em **retornar**.',
        ].join('\n'),
      },
      {
        locale: 'es',
        title: 'Suma de la lista',
        statementMd: [
          'La entrada es una lista de números enteros. Devuelve la suma de todos ellos. La suma de una lista vacía es 0.',
          '',
          'En **Variables**, usa **Crear variable...** para guardar un total y empiézalo en 0. Después, con el bloque de **Bucles** que recorre cada elemento de una lista, suma cada número al total. Al final, encaja el total en **devolver**.',
        ].join('\n'),
      },
      {
        locale: 'en',
        title: 'Sum of the list',
        statementMd: [
          'The input is a list of integers. Return the sum of all of them. The sum of an empty list is 0.',
          '',
          'In **Variables**, use **Create variable...** to keep a total and start it at 0. Then, with the **Loops** block that goes through each item of a list, add each number to the total. At the end, plug the total into **return**.',
        ].join('\n'),
      },
    ],
    solution: praticaSomaLista,
  },
]
