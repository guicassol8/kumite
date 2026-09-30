import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import '@/i18n'
import type { fetchProblem } from '@/lib/problems-query'
import { StatementCard } from './statement-card'

type Problem = Awaited<ReturnType<typeof fetchProblem>>

function problem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: 'p1',
    points: 100,
    difficulty: 'easy',
    locale: 'pt',
    title: 'Soma dos Pares',
    statementMd: 'Some os **pares** da lista.',
    examples: [
      { input: [1, 2, 3, 4], expected: 6 },
      { input: [5, 7, 9], expected: 0 },
    ],
    visibility: 'round',
    roundId: 'r1',
    roundStatus: 'open',
    bestSubmission: null,
    ...overrides,
  } as Problem
}

afterEach(cleanup)

describe('StatementCard', () => {
  it('reads the difficulty as the identity badge for that level', () => {
    render(<StatementCard problem={problem({ difficulty: 'easy' })} hasResults={false} />)

    const badge = screen.getByTestId('problem-difficulty-badge')
    expect(badge.textContent).toBe('Fácil')
    expect(badge.dataset.variant).toBe('success')
  })

  it('puts "Médio" on the amber-TEXT token, never on pure amber', () => {
    render(<StatementCard problem={problem({ difficulty: 'medium' })} hasResults={false} />)

    const badge = screen.getByTestId('problem-difficulty-badge')
    expect(badge.textContent).toBe('Médio')
    // `warning` is `border-warning text-warning-text` (badge.tsx): pure
    // `--warning` as text is 1,95:1 and identity § 3 forbids it.
    expect(badge.dataset.variant).toBe('warning')
    expect(badge.className).toContain('text-warning-text')
  })

  it('keeps "Difícil" a crimson outline rather than a filled plate', () => {
    render(<StatementCard problem={problem({ difficulty: 'hard' })} hasResults={false} />)

    const badge = screen.getByTestId('problem-difficulty-badge')
    expect(badge.textContent).toBe('Difícil')
    expect(badge.className).toContain('border-destructive')
    expect(badge.className).toContain('text-destructive')
    expect(badge.className).not.toContain('bg-destructive')
  })

  it('shows the problem points as a badge', () => {
    render(<StatementCard problem={problem({ points: 100 })} hasResults={false} />)

    expect(screen.getByTestId('problem-points-badge').textContent).toBe('100 pts')
  })

  // #211: practice does not score, so "N pts" would contradict it — the
  // difficulty stays.
  it('drops the points badge on a practice problem, keeping the difficulty', () => {
    render(
      <StatementCard
        problem={problem({ visibility: 'practice', roundId: null, roundStatus: 'none' })}
        hasResults={false}
      />,
    )

    expect(screen.queryByTestId('problem-points-badge')).toBeNull()
    expect(screen.getByTestId('problem-difficulty-badge').textContent).toBe('Fácil')
  })

  it('shows the round position letter only when the round supplies one', () => {
    const { unmount } = render(
      <StatementCard problem={problem()} hasResults={false} positionLabel="B" />,
    )
    expect(screen.getByTestId('problem-position-badge').textContent).toBe('Problema B')

    unmount()
    render(<StatementCard problem={problem()} hasResults={false} />)
    expect(screen.queryByTestId('problem-position-badge')).toBeNull()
  })

  it('renders the statement as markdown instead of printing the asterisks', () => {
    render(<StatementCard problem={problem()} hasResults={false} />)

    const statement = screen.getByTestId('problem-statement-body')
    expect(within(statement).getByText('pares').tagName).toBe('STRONG')
    expect(statement.textContent).not.toContain('**')
  })

  it('reads each example in mono as input → expected', () => {
    render(<StatementCard problem={problem()} hasResults={false} />)

    const example = screen.getByTestId('problem-example-0')
    expect(example.textContent).toContain('[1,2,3,4]')
    expect(example.textContent).toContain('6')
    expect(example.className).toContain('font-mono')
    // The arrow carries no meaning on its own — the labels stay for a reader.
    expect(within(example).getByText(/Entrada/)).toBeDefined()
    expect(within(example).getByText(/Saída esperada/)).toBeDefined()
  })

  it('keeps the panel testid the rest of the screen identifies it by', () => {
    render(<StatementCard problem={problem()} hasResults={false} />)

    expect(screen.getByTestId('problem-statement-panel')).toBeDefined()
  })

  describe('team best score badge (#206)', () => {
    it('shows the team best score when given one', () => {
      render(
        <StatementCard
          problem={problem()}
          hasResults={false}
          bestScore={{ kind: 'score', score: 70, maxScore: 100 }}
        />,
      )

      // Beside the maximum this score was computed against (#319).
      expect(screen.getByTestId('problem-best-score-badge').textContent).toBe(
        'Melhor do time: 70/100',
      )
      expect(screen.queryByTestId('problem-no-submission-badge')).toBeNull()
    })

    it('shows "no submissions" when the team never submitted', () => {
      render(<StatementCard problem={problem()} hasResults={false} bestScore={{ kind: 'none' }} />)

      expect(screen.getByTestId('problem-no-submission-badge').textContent).toBe('Sem submissão')
      expect(screen.queryByTestId('problem-best-score-badge')).toBeNull()
    })

    it('shows no badge at all when there is no team best to speak of', () => {
      render(<StatementCard problem={problem()} hasResults={false} />)

      expect(screen.queryByTestId('problem-best-score-badge')).toBeNull()
      expect(screen.queryByTestId('problem-no-submission-badge')).toBeNull()
    })
  })
})
