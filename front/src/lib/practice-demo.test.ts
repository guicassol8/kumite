import type { WorkspaceState } from '@kumite/blocks'
import { describe, expect, it } from 'vitest'

import { deepEqual } from './deep-equal'
import { blockIdsIn, type DemoScript, demoStepState, revealedAt } from './practice-demo'

// Synthetic, not one of the real scripts: a root with a value input, a
// statement input with a `next` chain, and a variable — every shape the
// pruning has to handle, independent of what the three fixtures happen to use.
const solution: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'kumite_solve',
        id: 'root',
        x: 40,
        y: 40,
        inputs: {
          BODY: {
            block: {
              type: 'variables_set',
              id: 'set',
              fields: { VAR: { id: 'v' } },
              inputs: { VALUE: { block: { type: 'math_number', id: 'num', fields: { NUM: 1 } } } },
              next: {
                block: {
                  type: 'variables_set',
                  id: 'again',
                  fields: { VAR: { id: 'v' } },
                },
              },
            },
          },
          RETURN: { block: { type: 'variables_get', id: 'get', fields: { VAR: { id: 'v' } } } },
        },
      },
    ],
  },
  variables: [{ name: 'x', id: 'v' }],
}

const script: DemoScript = {
  solution,
  steps: [
    { reveal: ['root'], textKey: 'a' },
    { reveal: ['set'], textKey: 'b' },
    { reveal: ['num', 'again'], textKey: 'c' },
    { reveal: ['get'], textKey: 'd' },
  ],
}

describe('blockIdsIn', () => {
  it('lists every block id, however deep, in document order', () => {
    expect(blockIdsIn(solution)).toEqual(['root', 'set', 'num', 'again', 'get'])
  })

  it('finds nothing in a workspace with no blocks', () => {
    expect(blockIdsIn({})).toEqual([])
  })
})

describe('demoStepState', () => {
  it('keeps only the root on the first step, with every input and next pruned', () => {
    expect(demoStepState(script, 0)).toEqual({
      blocks: {
        languageVersion: 0,
        blocks: [{ type: 'kumite_solve', id: 'root', x: 40, y: 40 }],
      },
      variables: [{ name: 'x', id: 'v' }],
    })
  })

  it('accumulates the blocks revealed so far and drops a `next` not yet revealed', () => {
    const state = demoStepState(script, 1)

    expect(blockIdsIn(state)).toEqual(['root', 'set'])
    expect(JSON.stringify(state)).not.toContain('"next"')
  })

  it('always keeps the variables, even before a block uses them', () => {
    expect(demoStepState(script, 0)['variables']).toEqual([{ name: 'x', id: 'v' }])
  })

  it('never mutates the solution it prunes', () => {
    const before = JSON.stringify(solution)
    demoStepState(script, 0)
    demoStepState(script, 2)
    expect(JSON.stringify(solution)).toBe(before)
  })

  it('ends on the solution itself', () => {
    expect(deepEqual(demoStepState(script, script.steps.length - 1), solution)).toBe(true)
  })

  it('refuses a step outside the script', () => {
    expect(() => demoStepState(script, -1)).toThrow(RangeError)
    expect(() => demoStepState(script, script.steps.length)).toThrow(RangeError)
  })
})

describe('revealedAt', () => {
  it('names only the blocks that enter on that step', () => {
    expect(revealedAt(script, 0)).toEqual(['root'])
    expect(revealedAt(script, 2)).toEqual(['num', 'again'])
  })

  it('refuses a step outside the script', () => {
    expect(() => revealedAt(script, 4)).toThrow(RangeError)
  })
})
