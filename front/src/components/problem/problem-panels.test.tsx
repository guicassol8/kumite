import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/i18n'
import { setMatchMediaMatches } from '@/test/match-media-jsdom'
import { ProblemPanels } from './problem-panels'

const DESKTOP_QUERY = '(min-width: 768px)'

const problem = {
  id: 'p1',
  points: 10,
  difficulty: 'easy' as const,
  locale: 'pt' as const,
  title: 'Soma dos Pares',
  statementMd: 'Some os pares.',
  examples: [{ input: [1, 2, 3, 4], expected: 6 }],
  roundId: 'r1',
  roundStatus: 'open' as const,
  bestSubmission: null,
}

afterEach(() => {
  cleanup()
  setMatchMediaMatches(DESKTOP_QUERY, false)
})

describe('ProblemPanels', () => {
  it('renders the stacked layout on < md, with none of the desktop panel controls', () => {
    render(
      <ProblemPanels
        problem={problem}
        hasResults={false}
        editor={<div data-testid="fake-editor" />}
        actionsBar={<div data-testid="fake-actions" />}
      />,
    )

    expect(screen.getByTestId('problem-statement-panel')).not.toBeNull()
    expect(screen.queryByTestId('problem-statement-handle')).toBeNull()
    expect(screen.queryByTestId('problem-statement-collapse')).toBeNull()
    expect(screen.queryByTestId('problem-statement-rail')).toBeNull()
  })

  it('renders the handle and the collapse button on md+', () => {
    setMatchMediaMatches(DESKTOP_QUERY, true)

    render(
      <ProblemPanels
        problem={problem}
        hasResults={false}
        editor={<div data-testid="fake-editor" />}
        actionsBar={<div data-testid="fake-actions" />}
      />,
    )

    expect(screen.getByTestId('problem-statement-handle')).not.toBeNull()
    expect(screen.getByTestId('problem-statement-collapse')).not.toBeNull()
    expect(screen.queryByTestId('problem-statement-rail')).toBeNull()
  })

  it('swaps the statement card for the rail once collapsed, and back on a click', () => {
    setMatchMediaMatches(DESKTOP_QUERY, true)

    render(
      <ProblemPanels
        problem={problem}
        hasResults={false}
        editor={<div data-testid="fake-editor" />}
        actionsBar={<div data-testid="fake-actions" />}
      />,
    )

    fireEvent.click(screen.getByTestId('problem-statement-collapse'))

    expect(screen.getByTestId('problem-statement-rail')).not.toBeNull()

    fireEvent.click(screen.getByTestId('problem-statement-rail'))

    expect(screen.queryByTestId('problem-statement-rail')).toBeNull()
  })

  it('collapses the results band on a toggle click, and reopens it when a new run lands', () => {
    setMatchMediaMatches(DESKTOP_QUERY, true)

    const { rerender } = render(
      <ProblemPanels
        problem={problem}
        hasResults
        editor={<div data-testid="fake-editor" />}
        results={<div data-testid="fake-results" />}
        actionsBar={<div data-testid="fake-actions" />}
        resultsVersion={1}
      />,
    )

    const toggle = screen.getByTestId('problem-results-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    rerender(
      <ProblemPanels
        problem={problem}
        hasResults
        editor={<div data-testid="fake-editor" />}
        results={<div data-testid="fake-results" />}
        actionsBar={<div data-testid="fake-actions" />}
        resultsVersion={2}
      />,
    )

    expect(screen.getByTestId('problem-results-toggle').getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps the results split disabled and the toggle hidden before there is anything to show', () => {
    setMatchMediaMatches(DESKTOP_QUERY, true)

    render(
      <ProblemPanels
        problem={problem}
        hasResults={false}
        editor={<div data-testid="fake-editor" />}
        actionsBar={<div data-testid="fake-actions" />}
      />,
    )

    expect(screen.queryByTestId('problem-results-toggle')).toBeNull()
    // The canvas/results Separator and Panel stay mounted throughout (the
    // library does not expect a Group's panel count to change after mount —
    // adding them only once results exist crashed the whole route). Before
    // that, they are simply disabled and sized to 0%.
    const handle = screen.getByTestId('problem-results-handle')
    expect(handle.getAttribute('aria-disabled')).toBe('true')
  })
})
