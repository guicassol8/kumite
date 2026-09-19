import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/i18n'
import type { CaseOutcome, ExampleCase } from '@/lib/run-examples'
import { ExampleResults } from './example-results'

const examples: ExampleCase[] = [
  { input: [1, 2, 3, 4], expected: 6 },
  { input: [5, 7, 9], expected: 0 },
  { input: [2, 4, 6, 8], expected: 20 },
]

const passed = (actual: unknown): CaseOutcome => ({ status: 'passed', actual })

afterEach(cleanup)

describe('ExampleResults', () => {
  it('counts the passing cases and marks a full pass as a success', () => {
    render(<ExampleResults examples={examples} outcomes={[passed(6), passed(0), passed(20)]} />)

    const summary = screen.getByTestId('problem-results-summary')
    expect(summary.textContent).toBe('3/3 casos')
    expect(summary.dataset.state).toBe('passed')
  })

  it('does not mark a partial pass as a success', () => {
    render(
      <ExampleResults
        examples={examples}
        outcomes={[passed(6), { status: 'failed', actual: 1 }, passed(20)]}
      />,
    )

    const summary = screen.getByTestId('problem-results-summary')
    expect(summary.textContent).toBe('2/3 casos')
    expect(summary.dataset.state).toBe('failed')
  })

  it('shows expected against obtained on a failing case', () => {
    render(
      <ExampleResults
        examples={examples}
        outcomes={[{ status: 'failed', actual: '6' }, null, null]}
      />,
    )

    const row = screen.getByTestId('problem-result-0')
    expect(row.dataset.status).toBe('failed')
    expect(row.textContent).toContain('esperado 6')
    expect(row.textContent).toContain('obtido "6"')
  })

  it('lists a case that has not answered yet as pending', () => {
    render(<ExampleResults examples={examples} outcomes={[passed(6), null, null]} />)

    expect(screen.getByTestId('problem-result-1').textContent).toContain('executando...')
    expect(screen.getByTestId('problem-result-1').dataset.status).toBe('pending')
  })

  it('reports a timed-out case with the timeout it was given', () => {
    render(
      <ExampleResults
        examples={examples}
        outcomes={[{ status: 'timeout' }, null, null]}
        timeoutMs={2000}
      />,
    )

    const row = screen.getByTestId('problem-result-0')
    expect(row.textContent).toContain('Tempo esgotado (2s)')
    expect(row.dataset.status).toBe('timeout')
  })

  it('reports the message of a case that threw', () => {
    render(
      <ExampleResults
        examples={examples}
        outcomes={[{ status: 'error', message: 'lista vazia' }, null, null]}
      />,
    )

    const row = screen.getByTestId('problem-result-0')
    expect(row.textContent).toContain('Erro: lista vazia')
    expect(row.dataset.status).toBe('error')
  })

  it('numbers the cases from one', () => {
    render(<ExampleResults examples={examples} outcomes={[null, null, null]} />)

    expect(within(screen.getByTestId('problem-result-0')).getByText('Caso 1')).toBeDefined()
    expect(within(screen.getByTestId('problem-result-2')).getByText('Caso 3')).toBeDefined()
  })

  it('shows the friendly warning instead of the list when no solution is built', () => {
    render(<ExampleResults examples={examples} outcomes={[]} notice="empty" />)

    expect(screen.getByTestId('problem-results-empty').textContent).toBe(
      'Monte a sua solução dentro do bloco “resolver” e clique em Executar.',
    )
    expect(screen.queryByTestId('problem-result-0')).toBeNull()
    expect(screen.queryByTestId('problem-results-summary')).toBeNull()
  })

  it('shows the codegen error instead of the list when the workspace is invalid', () => {
    render(
      <ExampleResults
        examples={examples}
        outcomes={[]}
        notice={{ message: 'O bloco "text_print" não é permitido.' }}
      />,
    )

    expect(screen.getByTestId('problem-results-invalid').textContent).toBe(
      'O bloco "text_print" não é permitido.',
    )
    expect(screen.queryByTestId('problem-result-0')).toBeNull()
  })

  it('is always identifiable as the results panel', () => {
    render(<ExampleResults examples={examples} outcomes={[]} notice="empty" />)

    expect(screen.getByTestId('problem-results-panel')).toBeDefined()
  })

  describe('the identity restyle (#219)', () => {
    it('shows the case input alongside expected and obtained', () => {
      render(
        <ExampleResults
          examples={examples}
          outcomes={[{ status: 'failed', actual: 4 }, null, null]}
        />,
      )

      const row = screen.getByTestId('problem-result-0')
      expect(row.textContent).toContain('[1,2,3,4]')
      expect(row.textContent).toContain('esperado 6')
      expect(row.textContent).toContain('obtido 4')
    })

    it('states each case outcome in words, not only in colour', () => {
      render(
        <ExampleResults
          examples={examples}
          outcomes={[passed(6), { status: 'failed', actual: 1 }, null]}
        />,
      )

      expect(within(screen.getByTestId('problem-result-0')).getByText('Passou')).toBeDefined()
      expect(within(screen.getByTestId('problem-result-1')).getByText('Falhou')).toBeDefined()
      expect(within(screen.getByTestId('problem-result-2')).getByText('Executando')).toBeDefined()
    })

    it('reads the summary as a badge without changing what it says', () => {
      render(<ExampleResults examples={examples} outcomes={[passed(6), passed(0), passed(20)]} />)

      const summary = screen.getByTestId('problem-results-summary')
      // Still exactly the contract the run specs assert on.
      expect(summary.textContent).toBe('3/3 casos')
      expect(summary.dataset.slot).toBe('badge')
      expect(summary.dataset.variant).toBe('success')
    })

    it('drops the summary badge out of the success variant on a partial pass', () => {
      render(<ExampleResults examples={examples} outcomes={[passed(6), null, null]} />)

      expect(screen.getByTestId('problem-results-summary').dataset.variant).toBe('outline')
    })
  })
})
