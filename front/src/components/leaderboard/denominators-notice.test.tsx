import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import type { EventRankingRoundVerdict } from '@/lib/sse-schema'

import { DenominatorsNotice, EventDenominatorsNotice } from './denominators-notice'

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('pt')
})

describe('DenominatorsNotice (#318)', () => {
  it('warns that the round is not comparable when the verdict is inconsistent', () => {
    render(<DenominatorsNotice verdict="inconsistent" />)

    const notice = screen.getByTestId('leaderboard-denominators-inconsistent')
    expect(notice.textContent).toContain(i18n.t('leaderboard.denominators.inconsistent.title'))
    expect(notice.textContent).toContain(
      i18n.t('leaderboard.denominators.inconsistent.description'),
    )
    expect(notice.className).toContain('border-warning')
    expect(notice.getAttribute('role')).toBe('alert')
    expect(screen.queryByTestId('leaderboard-denominators-unknown')).toBeNull()
  })

  it('shows a discreet note when the verdict is unknown', () => {
    render(<DenominatorsNotice verdict="unknown" />)

    const note = screen.getByTestId('leaderboard-denominators-unknown')
    expect(note.textContent).toContain(i18n.t('leaderboard.denominators.unknown.description'))
    expect(note.className).not.toContain('border-warning')
    // A quiet note, not an assertive alert a screen reader would interrupt for.
    expect(note.getAttribute('role')).toBe('note')
    expect(screen.queryByTestId('leaderboard-denominators-inconsistent')).toBeNull()
  })

  it('renders nothing when the verdict is consistent', () => {
    const { container } = render(<DenominatorsNotice verdict="consistent" />)

    expect(container.innerHTML).toBe('')
  })
})

describe('EventDenominatorsNotice (#383)', () => {
  const round = (
    n: number,
    denominators: EventRankingRoundVerdict['denominators'],
  ): EventRankingRoundVerdict => ({ roundId: `r${n}`, roundName: `Rodada ${n}`, denominators })

  it('warns that the event total is not comparable, naming the one inconsistent round', () => {
    render(
      <EventDenominatorsNotice
        rounds={[round(1, 'consistent'), round(2, 'inconsistent'), round(3, 'consistent')]}
      />,
    )

    const notice = screen.getByTestId('leaderboard-event-denominators-inconsistent')
    expect(notice.textContent).toContain('O total do evento não é comparável entre os times')
    expect(notice.textContent).toContain(
      'Esta soma inclui uma rodada em que um mesmo problema foi pontuado em escalas diferentes: Rodada 2.',
    )
    expect(notice.textContent).not.toContain('Rodada 1')
    expect(notice.textContent).not.toContain('Rodada 3')
    expect(notice.className).toContain('border-warning')
    expect(notice.getAttribute('role')).toBe('alert')
    expect(screen.queryByTestId('leaderboard-event-denominators-unknown')).toBeNull()
  })

  it('names only the inconsistent rounds, in column order, in the plural', () => {
    render(
      <EventDenominatorsNotice
        rounds={[
          round(1, 'inconsistent'),
          round(2, 'unknown'),
          round(3, 'consistent'),
          round(4, 'inconsistent'),
        ]}
      />,
    )

    const notice = screen.getByTestId('leaderboard-event-denominators-inconsistent')
    expect(notice.textContent).toContain(
      'Esta soma inclui rodadas em que um mesmo problema foi pontuado em escalas diferentes: Rodada 1 e Rodada 4.',
    )
    expect(notice.textContent).not.toContain('Rodada 2')
  })

  it('lets inconsistent win over unknown: the warning alone, never both', () => {
    render(<EventDenominatorsNotice rounds={[round(1, 'unknown'), round(2, 'inconsistent')]} />)

    expect(screen.getByTestId('leaderboard-event-denominators-inconsistent')).toBeDefined()
    expect(screen.queryByTestId('leaderboard-event-denominators-unknown')).toBeNull()
  })

  it('shows a discreet note, naming no round, when some round is unknown and none inconsistent', () => {
    render(<EventDenominatorsNotice rounds={[round(1, 'consistent'), round(2, 'unknown')]} />)

    const note = screen.getByTestId('leaderboard-event-denominators-unknown')
    expect(note.textContent).toContain(
      'Não é possível confirmar que o total do evento está na mesma escala para todos os times',
    )
    expect(note.textContent).not.toContain('Rodada 2')
    expect(note.className).not.toContain('border-warning')
    expect(note.getAttribute('role')).toBe('note')
    expect(screen.queryByTestId('leaderboard-event-denominators-inconsistent')).toBeNull()
  })

  it('renders nothing when every summed round is consistent', () => {
    const { container } = render(
      <EventDenominatorsNotice rounds={[round(1, 'consistent'), round(2, 'consistent')]} />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when no round was summed', () => {
    const { container } = render(<EventDenominatorsNotice rounds={[]} />)

    expect(container.innerHTML).toBe('')
  })

  it('speaks Spanish, joining the round names with the Spanish conjunction', async () => {
    await i18n.changeLanguage('es')
    render(
      <EventDenominatorsNotice rounds={[round(1, 'inconsistent'), round(2, 'inconsistent')]} />,
    )

    const notice = screen.getByTestId('leaderboard-event-denominators-inconsistent')
    expect(notice.textContent).toContain('El total del evento no es comparable entre los equipos')
    expect(notice.textContent).toContain(
      'Esta suma incluye rondas en las que un mismo problema se puntuó en escalas diferentes: Rodada 1 y Rodada 2.',
    )
  })

  it('speaks English, in the singular and in the unknown note', async () => {
    await i18n.changeLanguage('en')
    render(<EventDenominatorsNotice rounds={[round(1, 'inconsistent')]} />)

    const notice = screen.getByTestId('leaderboard-event-denominators-inconsistent')
    expect(notice.textContent).toContain('The event total is not comparable between teams')
    expect(notice.textContent).toContain(
      'This sum includes a round where the same problem was scored on different scales: Rodada 1.',
    )
    cleanup()

    render(<EventDenominatorsNotice rounds={[round(1, 'unknown')]} />)
    expect(screen.getByTestId('leaderboard-event-denominators-unknown').textContent).toContain(
      'Unable to confirm that the event total is on the same scale for every team',
    )
  })
})
