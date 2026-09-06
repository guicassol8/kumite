import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/i18n'

import { type SubmissionResult, SubmissionResultPanel } from './submission-result'

afterEach(cleanup)

const result: SubmissionResult = {
  submissionId: 's1',
  attemptNumber: 1,
  score: 20,
  maxScore: 30,
  cases: [
    { hidden: false, index: 0, outcome: 'passed', expected: 6, actual: 6, ms: 3 },
    { hidden: false, index: 1, outcome: 'failed', expected: 0, actual: 4, ms: 2 },
    { hidden: false, index: 2, outcome: 'timeout', expected: 20, ms: 2000 },
    {
      hidden: false,
      index: 3,
      outcome: 'runtime_error',
      expected: 10,
      detail: 'shift is not a function',
      ms: 1,
    },
    { hidden: true, index: 4, outcome: 'passed' },
    { hidden: true, index: 5, outcome: 'failed' },
  ],
}

describe('SubmissionResultPanel', () => {
  it('shows the score and every visible case with its detail', () => {
    render(<SubmissionResultPanel result={result} />)

    expect(screen.getByTestId('problem-verdict-panel')).toBeDefined()
    expect(screen.getByTestId('problem-verdict-summary').textContent).toContain('20')
    expect(screen.getByTestId('problem-verdict-summary').textContent).toContain('30')

    const passed = screen.getByTestId('problem-verdict-case-0')
    expect(passed.textContent).toContain('✓')

    const failed = screen.getByTestId('problem-verdict-case-1')
    expect(failed.textContent).toContain('✗')
    expect(failed.textContent).toContain('0')
    expect(failed.textContent).toContain('4')

    const timeout = screen.getByTestId('problem-verdict-case-2')
    expect(timeout.textContent).toContain('✗')
    expect(timeout.textContent).not.toContain('20')

    const runtimeError = screen.getByTestId('problem-verdict-case-3')
    expect(runtimeError.textContent).toContain('✗')
    expect(runtimeError.textContent).toContain('shift is not a function')
  })

  it('renders hidden cases as a bare numbered icon with no expected/actual detail', () => {
    render(<SubmissionResultPanel result={result} />)

    const hiddenPassed = screen.getByTestId('problem-verdict-case-4')
    expect(hiddenPassed.textContent).toContain('✓')
    expect(hiddenPassed.textContent).not.toContain('esperado')

    const hiddenFailed = screen.getByTestId('problem-verdict-case-5')
    expect(hiddenFailed.textContent).toContain('✗')
    expect(hiddenFailed.textContent).not.toContain('esperado')
  })
})
