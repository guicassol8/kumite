import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/i18n'
import { DESKTOP_QUERY } from '@/hooks/use-media-query'
import { setMatchMediaMatches } from '@/test/match-media-jsdom'
import { ProblemPanels } from './problem-panels'

const problem = {
  id: 'p1',
  points: 10,
  difficulty: 'easy' as const,
  locale: 'pt' as const,
  title: 'Soma dos Pares',
  statementMd: 'Some os pares.',
  examples: [{ input: [1, 2, 3, 4], expected: 6 }],
  roundId: 'r1',
  visibility: 'round' as const,
  roundStatus: 'open' as const,
  bestSubmission: null,
  demoKey: null,
}

afterEach(() => {
  cleanup()
  setMatchMediaMatches(DESKTOP_QUERY, false)
  localStorage.clear()
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

  // #199: on the phone the statement folds down to its header strip and the
  // canvas takes the height. Every problem opens unfolded, and nothing of it
  // is stored (Q3).
  describe('folding the statement on < md (#199)', () => {
    function renderStacked(current = problem) {
      return render(
        <ProblemPanels
          problem={current}
          hasResults={false}
          editor={<div data-testid="fake-editor" />}
          actionsBar={<div data-testid="fake-actions" />}
        />,
      )
    }

    it('starts unfolded, folds on a click and unfolds on the next', () => {
      renderStacked()
      const toggle = screen.getByTestId('problem-statement-toggle')

      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(toggle.getAttribute('aria-label')).toBe('Recolher enunciado')
      expect(screen.getByTestId('problem-statement-body')).not.toBeNull()

      fireEvent.click(toggle)

      expect(toggle.getAttribute('aria-expanded')).toBe('false')
      expect(toggle.getAttribute('aria-label')).toBe('Mostrar enunciado')
      expect(screen.queryByTestId('problem-statement-body')).toBeNull()
      expect(screen.getByTestId('problem-statement-panel').textContent).toContain('Soma dos Pares')

      fireEvent.click(toggle)

      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(screen.getByTestId('problem-statement-body')).not.toBeNull()
    })

    it('never remounts the editor to fold or unfold (#178)', () => {
      renderStacked()
      const editor = screen.getByTestId('fake-editor')

      fireEvent.click(screen.getByTestId('problem-statement-toggle'))
      expect(screen.getByTestId('fake-editor')).toBe(editor)

      fireEvent.click(screen.getByTestId('problem-statement-toggle'))
      expect(screen.getByTestId('fake-editor')).toBe(editor)
    })

    it('keeps the focus on the toggle across the switch', () => {
      renderStacked()
      const toggle = screen.getByTestId('problem-statement-toggle')
      toggle.focus()

      fireEvent.click(toggle)

      expect(screen.getByTestId('problem-statement-toggle')).toBe(toggle)
      expect(document.activeElement).toBe(toggle)
    })

    it('opens the next problem unfolded, whatever the last one was left at', () => {
      const { rerender } = renderStacked()
      fireEvent.click(screen.getByTestId('problem-statement-toggle'))

      rerender(
        <ProblemPanels
          problem={{ ...problem, id: 'p2', title: 'Contar Negativos' }}
          hasResults={false}
          editor={<div data-testid="fake-editor" />}
          actionsBar={<div data-testid="fake-actions" />}
        />,
      )

      expect(screen.getByTestId('problem-statement-toggle').getAttribute('aria-expanded')).toBe(
        'true',
      )
      expect(screen.getByTestId('problem-statement-body')).not.toBeNull()
      expect(localStorage.length).toBe(0)
    })

    it('has no fold toggle on md+, which keeps its own collapse (#203)', () => {
      setMatchMediaMatches(DESKTOP_QUERY, true)
      renderStacked()

      expect(screen.queryByTestId('problem-statement-toggle')).toBeNull()
      expect(screen.getByTestId('problem-statement-collapse')).not.toBeNull()
    })
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

  it('restores a layout pre-seeded in storage instead of the hardcoded default sizes', () => {
    setMatchMediaMatches(DESKTOP_QUERY, true)
    // Written under the same key react-resizable-panels' own useDefaultLayout
    // reads/writes (`layoutStorage` just prefixes it) — this is what a
    // previous session's drag would have left behind.
    localStorage.setItem(
      'kumite:problem-layout:react-resizable-panels:problem-h',
      JSON.stringify({ statement: 40, editor: 60 }),
    )

    render(
      <ProblemPanels
        problem={problem}
        hasResults={false}
        editor={<div data-testid="fake-editor" />}
        actionsBar={<div data-testid="fake-actions" />}
      />,
    )

    // react-resizable-panels sets a Panel's own data-testid from its id, so
    // "statement" (not "problem-statement-panel", which is the Card inside
    // it) is the element actually carrying the computed flex-grow.
    expect(screen.getByTestId('statement').style.flexGrow).toBe('40')
  })

  it('gives the whole column to the editor before any result, whatever size was saved (#307)', () => {
    setMatchMediaMatches(DESKTOP_QUERY, true)
    // A band the participant dragged taller in an earlier session.
    const saved = JSON.stringify({ canvas: 60, results: 40 })
    localStorage.setItem('kumite:problem-layout:react-resizable-panels:problem-v', saved)

    render(
      <ProblemPanels
        problem={problem}
        hasResults={false}
        editor={<div data-testid="fake-editor" />}
        actionsBar={<div data-testid="fake-actions" />}
      />,
    )

    // No gap reserved for a band with nothing in it...
    expect(screen.getByTestId('results').style.flexGrow).toBe('0')
    expect(screen.getByTestId('canvas').style.flexGrow).toBe('100')
    // ...and the preference itself survives, for the first run to restore.
    expect(localStorage.getItem('kumite:problem-layout:react-resizable-panels:problem-v')).toBe(
      saved,
    )
  })

  // Persisting an actual drag needs a real pointer gesture on the separator
  // (`isUserInteraction: true` is exactly what `onlySaveAfterUserInteractions`
  // gates on, and — correctly — an imperative `.collapse()`/`.expand()` call
  // does not count, or a window resize would overwrite the participant's
  // choice too). jsdom cannot drive that gesture; e2e/problem-panels.spec.ts
  // (T10) is where the write path is actually exercised, across a reload.

  it.each([
    ['stacked', false],
    ['desktop', true],
  ])('forwards the team best score to the statement card in the %s layout (#206)', (_, desktop) => {
    setMatchMediaMatches(DESKTOP_QUERY, desktop)

    render(
      <ProblemPanels
        problem={problem}
        bestScore={{ kind: 'score', score: 5, maxScore: 10 }}
        hasResults={false}
        editor={<div data-testid="fake-editor" />}
        actionsBar={<div data-testid="fake-actions" />}
      />,
    )

    expect(screen.getByTestId('problem-best-score-badge').textContent).toContain('5/10')
  })
})
