import { generateSolution, somaDosPares } from '@kumite/blocks'
import { describe, expect, it } from 'vitest'

import { executeSolution } from './execute-solution'

describe('executeSolution', () => {
  it('runs the generated solve(input) and returns its value', () => {
    const code = generateSolution(somaDosPares)

    expect(executeSolution(code, [1, 2, 3, 4])).toBe(6)
    expect(executeSolution(code, [5, 7, 9])).toBe(0)
  })

  it('keeps the generator-hoisted variables from leaking between runs', () => {
    // `javascriptGenerator.finish()` declares `var soma, numero` above `solve`;
    // a single shared instantiation would carry the previous run's accumulator
    // into the next one.
    const code = generateSolution(somaDosPares)

    expect(executeSolution(code, [2, 4, 6, 8])).toBe(20)
    expect(executeSolution(code, [2, 4, 6, 8])).toBe(20)
  })

  it('propagates an error thrown by the solution', () => {
    expect(() => executeSolution('function solve() { throw new Error("boom") }', [])).toThrow(
      'boom',
    )
  })
})
