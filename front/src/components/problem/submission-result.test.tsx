import { cleanup, render, screen, within } from '@testing-library/react'
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

    // Since #219 the outcome is an icon plus the state in words — the glyphs
    // `✓`/`✗` the pre-identity panel printed are gone on purpose.
    const passed = screen.getByTestId('problem-verdict-case-0')
    expect(within(passed).getByText('Passou')).toBeDefined()

    const failed = screen.getByTestId('problem-verdict-case-1')
    expect(within(failed).getByText('Falhou')).toBeDefined()
    expect(failed.textContent).toContain('0')
    expect(failed.textContent).toContain('4')

    const timeout = screen.getByTestId('problem-verdict-case-2')
    expect(within(timeout).getByText('Falhou')).toBeDefined()
    expect(timeout.textContent).not.toContain('20')

    const runtimeError = screen.getByTestId('problem-verdict-case-3')
    expect(within(runtimeError).getByText('Falhou')).toBeDefined()
    expect(runtimeError.textContent).toContain('shift is not a function')
  })

  it('renders hidden cases as a bare numbered icon with no expected/actual detail', () => {
    render(<SubmissionResultPanel result={result} />)

    const hiddenPassed = screen.getByTestId('problem-verdict-case-4')
    expect(within(hiddenPassed).getByText('Passou')).toBeDefined()
    expect(hiddenPassed.textContent).not.toContain('esperado')

    const hiddenFailed = screen.getByTestId('problem-verdict-case-5')
    expect(within(hiddenFailed).getByText('Falhou')).toBeDefined()
    expect(hiddenFailed.textContent).not.toContain('esperado')
  })

  describe('the verdict as an alert (#219)', () => {
    it('reads a full score as approved, in green', () => {
      render(<SubmissionResultPanel result={{ ...result, score: 30, maxScore: 30 }} />)

      const panel = screen.getByTestId('problem-verdict-panel')
      expect(panel.dataset.state).toBe('passed')
      expect(panel.getAttribute('role')).toBe('alert')
      expect(panel.className).toContain('border-success')
      expect(within(panel).getByText('Aprovado')).toBeDefined()
    })

    it('reads a partial score as rejected, in a crimson OUTLINE', () => {
      render(<SubmissionResultPanel result={result} />)

      const panel = screen.getByTestId('problem-verdict-panel')
      expect(panel.dataset.state).toBe('failed')
      expect(within(panel).getByText('Não aprovado')).toBeDefined()
      expect(panel.className).toContain('text-destructive')
      // The outline this test is named for. It comes from the primitive now
      // (`alertVariants.destructive`, #308); before that the panel rendered on
      // the neutral hairline and the assertion above still passed.
      expect(panel.className).toContain('border-destructive')
      // Identity § 5: an alert is never a filled plate.
      expect(panel.className).not.toContain('bg-destructive')
    })

    it('does not call a problem worth no points approved on 0/0', () => {
      render(<SubmissionResultPanel result={{ ...result, score: 0, maxScore: 0 }} />)

      expect(screen.getByTestId('problem-verdict-panel').dataset.state).toBe('failed')
    })

    it('opens the alert icon column with a direct-child svg', () => {
      render(<SubmissionResultPanel result={result} />)

      // `alertVariants` keys the icon gutter off `has-[>svg]`, so an icon
      // nested any deeper leaves the title over a 0-wide column.
      const panel = screen.getByTestId('problem-verdict-panel')
      expect(panel.querySelector(':scope > svg')).not.toBeNull()
    })

    it('still reports the score against the maximum', () => {
      render(<SubmissionResultPanel result={result} />)

      const summary = screen.getByTestId('problem-verdict-summary')
      expect(summary.textContent).toContain('20')
      expect(summary.textContent).toContain('30')
    })
  })
})
