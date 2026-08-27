// Problema hardcoded para a demo — a integração com o catálogo real é a #7/#8.
export type ProblemExample = {
  input: number[]
  expected: number
}

export type Problem = {
  id: string
  title: string
  statement: string
  examples: ProblemExample[]
}

export const somaDosParesProblem: Problem = {
  id: 'soma-dos-pares',
  title: 'Soma dos Pares',
  statement:
    'Dada uma lista de números inteiros, retorne a soma de todos os números pares da lista.',
  examples: [
    { input: [1, 2, 3, 4], expected: 6 },
    { input: [5, 7, 9], expected: 0 },
    { input: [2, 4, 6, 8], expected: 20 },
  ],
}
