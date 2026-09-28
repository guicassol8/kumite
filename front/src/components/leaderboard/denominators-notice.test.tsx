import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import i18n from '@/i18n'

import { DenominatorsNotice } from './denominators-notice'

afterEach(cleanup)

describe('DenominatorsNotice (#318)', () => {
  it('warns that the round is not comparable when the verdict is inconsistent', () => {
    render(<DenominatorsNotice verdict="inconsistent" />)

    const notice = screen.getByTestId('leaderboard-denominators-inconsistent')
    expect(notice.textContent).toContain(i18n.t('leaderboard.denominators.inconsistent.title'))
    expect(notice.textContent).toContain(
      i18n.t('leaderboard.denominators.inconsistent.description'),
    )
    expect(notice.className).toContain('border-warning')
    expect(screen.queryByTestId('leaderboard-denominators-unknown')).toBeNull()
  })

  it('shows a discreet note when the verdict is unknown', () => {
    render(<DenominatorsNotice verdict="unknown" />)

    const note = screen.getByTestId('leaderboard-denominators-unknown')
    expect(note.textContent).toContain(i18n.t('leaderboard.denominators.unknown.description'))
    expect(note.className).not.toContain('border-warning')
    expect(screen.queryByTestId('leaderboard-denominators-inconsistent')).toBeNull()
  })

  it('renders nothing when the verdict is consistent', () => {
    const { container } = render(<DenominatorsNotice verdict="consistent" />)

    expect(container.innerHTML).toBe('')
  })
})
