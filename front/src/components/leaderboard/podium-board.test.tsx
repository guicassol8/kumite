import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '@/i18n'

import { isPresentationActive, setPresentationActive } from '@/lib/presentation-mode'
import { setTheme } from '@/lib/theme'
import { setMatchMediaMatches } from '@/test/match-media-jsdom'

import { PodiumBoard, type PodiumMember, type PodiumStatus, type PodiumTeam } from './podium-board'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

// Scores fall with the rank, the way `rankTeams` orders them.
function ranking(count: number, zeros = 0): PodiumTeam[] {
  return Array.from({ length: count + zeros }, (_, index) => ({
    teamId: `t${index + 1}`,
    teamName: `Time ${index + 1}`,
    rank: index + 1,
    totalScore: index < count ? (count - index) * 10 : 0,
  }))
}

const members = new Map<string, PodiumMember[]>([
  [
    't1',
    [
      { name: 'Ana Souza', university: 'pucrs' },
      { name: 'Luis Pech', university: 'merida' },
      // An account from before #122: no name on record.
      { name: null, university: 'pucrs' },
    ],
  ],
  ['t2', [{ name: 'Bruno Lima', university: 'pucrs' }]],
  ['t3', [{ name: 'Carla Díaz', university: 'merida' }]],
  ['t4', [{ name: 'Diego Ruiz', university: 'merida' }]],
])

function props(overrides: Partial<Parameters<typeof PodiumBoard>[0]> = {}) {
  return {
    teams: ranking(3),
    membersByTeam: members,
    status: 'ready' as PodiumStatus,
    onRetry: vi.fn(),
    onExit: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  document.documentElement.className = ''
  setTheme('system')
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
})

afterEach(() => {
  cleanup()
  setPresentationActive(false)
  setMatchMediaMatches(REDUCED_MOTION, false)
  document.documentElement.className = ''
  localStorage.clear()
})

describe('PodiumBoard — the three places', () => {
  it('shows each place with its team, universities, named members and points', () => {
    render(<PodiumBoard {...props()} />)

    const first = screen.getByTestId('podium-place-1')
    expect(within(first).getByTestId('podium-team-name-1').textContent).toBe('Time 1')
    expect(within(first).getByTestId('university-badge-pucrs')).toBeDefined()
    expect(within(first).getByTestId('university-badge-merida')).toBeDefined()
    expect(within(first).getByTestId('podium-members-1').textContent).toContain('Ana Souza')
    expect(within(first).getByTestId('podium-members-1').textContent).toContain('Luis Pech')
    expect(within(first).getByTestId('podium-points-1').textContent).toBe('30 pontos')

    expect(
      within(screen.getByTestId('podium-place-2')).getByTestId('podium-members-2').textContent,
    ).toBe('Bruno Lima')
    expect(
      within(screen.getByTestId('podium-place-3')).getByTestId('podium-members-3').textContent,
    ).toBe('Carla Díaz')
  })

  it('keeps the DOM in rank order (1, 2, 3) and lays it out 2-1-3 on screen', () => {
    render(<PodiumBoard {...props()} />)

    // The places are the podium list's direct children; the members' own
    // list items sit one level further down.
    const order = [...screen.getByTestId('podium-places').children].map((place) =>
      place.getAttribute('data-testid'),
    )
    expect(order).toEqual(['podium-place-1', 'podium-place-2', 'podium-place-3'])

    expect(screen.getByTestId('podium-place-2').className).toContain('col-start-1')
    expect(screen.getByTestId('podium-place-1').className).toContain('col-start-2')
    expect(screen.getByTestId('podium-place-3').className).toContain('col-start-3')
  })

  it('announces each place by name for a screen reader', () => {
    render(<PodiumBoard {...props()} />)

    expect(screen.getByTestId('podium-place-1').textContent).toContain('1º lugar')
    expect(screen.getByTestId('podium-numeral-1').getAttribute('aria-hidden')).toBe('true')
  })

  it('paints only the winner numeral in brand red', () => {
    render(<PodiumBoard {...props()} />)

    expect(screen.getByTestId('podium-numeral-1').className).toContain('text-brand-text')
    expect(screen.getByTestId('podium-numeral-2').className).not.toContain('text-brand-text')
    expect(screen.getByTestId('podium-numeral-3').className).not.toContain('text-brand-text')
    expect(screen.getByTestId('podium-numeral-2').className).toContain('text-foreground')
  })

  it('sets the team name at 48px or more, bigger for the winner', () => {
    render(<PodiumBoard {...props()} />)

    expect(screen.getByTestId('podium-team-name-1').className).toContain('text-[56px]')
    expect(screen.getByTestId('podium-team-name-2').className).toContain('text-[48px]')
    expect(screen.getByTestId('podium-members-1').className).toContain('text-[28px]')
  })

  it('leaves a member with no name (or a blank one) out', () => {
    const withBlank = new Map(members)
    withBlank.set('t2', [
      { name: '  ', university: 'pucrs' },
      { name: 'Bruno Lima', university: 'pucrs' },
    ])
    render(<PodiumBoard {...props({ membersByTeam: withBlank })} />)

    const first = within(screen.getByTestId('podium-members-1')).getAllByRole('listitem')
    expect(first.map((item) => item.textContent)).toEqual(['Ana Souza', 'Luis Pech'])
    const second = within(screen.getByTestId('podium-members-2')).getAllByRole('listitem')
    expect(second.map((item) => item.textContent)).toEqual(['Bruno Lima'])
  })

  it('still shows the university of a member with no name', () => {
    const onlyNameless = new Map<string, PodiumMember[]>([
      ['t1', [{ name: null, university: 'merida' }]],
    ])
    render(<PodiumBoard {...props({ membersByTeam: onlyNameless })} />)

    expect(
      within(screen.getByTestId('podium-place-1')).getByTestId('university-badge-merida'),
    ).toBeDefined()
    expect(screen.queryByTestId('podium-members-1')).toBeNull()
  })

  it('splits a team of more than three members into two columns', () => {
    const big = new Map<string, PodiumMember[]>([
      [
        't1',
        ['Ana', 'Bia', 'Caio', 'Duda', 'Enzo'].map((name) => ({
          name,
          university: 'pucrs' as const,
        })),
      ],
    ])
    render(<PodiumBoard {...props({ membersByTeam: big })} />)

    expect(screen.getByTestId('podium-members-1').className).toContain('grid-cols-2')
    expect(within(screen.getByTestId('podium-members-1')).getAllByRole('listitem')).toHaveLength(5)
  })

  it('shows a team with no members as name and points only, without errors', () => {
    render(<PodiumBoard {...props({ membersByTeam: new Map() })} />)

    expect(screen.getByTestId('podium-team-name-1').textContent).toBe('Time 1')
    expect(screen.queryByTestId('podium-members-1')).toBeNull()
    expect(screen.queryByTestId('university-badge-pucrs')).toBeNull()
  })

  it('falls back to the unnamed label for a blank team name', () => {
    const teams = ranking(1)
    teams[0]!.teamName = '   '
    render(<PodiumBoard {...props({ teams })} />)

    expect(screen.getByTestId('podium-team-name-1').textContent).toBe('Time sem nome')
  })
})

describe('PodiumBoard — fewer than three, more than ten', () => {
  it('fills only the 1st place with a single scoring team', () => {
    render(<PodiumBoard {...props({ teams: ranking(1) })} />)

    expect(screen.getByTestId('podium-place-1')).toBeDefined()
    expect(screen.queryByTestId('podium-place-2')).toBeNull()
    expect(screen.queryByTestId('podium-place-3')).toBeNull()
    expect(screen.queryByTestId('podium-rest')).toBeNull()
    expect(screen.queryByTestId('podium-error')).toBeNull()
  })

  it('fills 1st and 2nd with two scoring teams, keeping the winner in the middle', () => {
    render(<PodiumBoard {...props({ teams: ranking(2) })} />)

    expect(screen.getByTestId('podium-place-1').className).toContain('col-start-2')
    expect(screen.getByTestId('podium-place-2')).toBeDefined()
    expect(screen.queryByTestId('podium-place-3')).toBeNull()
  })

  it('never puts a zero-point team on the podium (P1-A)', () => {
    render(<PodiumBoard {...props({ teams: ranking(2, 5) })} />)

    expect(screen.queryByTestId('podium-place-3')).toBeNull()
    expect(screen.queryByTestId('podium-rest')).toBeNull()
  })

  it('shows the empty state when nobody scored', () => {
    render(<PodiumBoard {...props({ teams: ranking(0, 4) })} />)

    expect(screen.getByTestId('podium-empty').textContent).toBe('Nenhum time pontuou ainda.')
    expect(screen.queryByTestId('podium-places')).toBeNull()
    expect(screen.queryByTestId('podium-confetti-button')).toBeNull()
  })

  it('lists 4th to 10th under the podium and stops there with twelve teams', () => {
    render(<PodiumBoard {...props({ teams: ranking(12) })} />)

    const rest = screen.getByTestId('podium-rest')
    expect(rest.getAttribute('start')).toBe('4')
    expect(within(rest).getByTestId('podium-rest-row-4')).toBeDefined()
    expect(within(rest).getByTestId('podium-rest-row-10')).toBeDefined()
    expect(screen.queryByTestId('podium-rest-row-11')).toBeNull()
    expect(within(rest).getAllByRole('listitem')).toHaveLength(7)
  })

  it('shows universities but no member names from the 4th place down (P3-A)', () => {
    render(<PodiumBoard {...props({ teams: ranking(4) })} />)

    const row = screen.getByTestId('podium-rest-row-4')
    expect(row.textContent).toContain('Time 4')
    expect(within(row).getByTestId('university-badge-merida')).toBeDefined()
    expect(row.textContent).not.toContain('Diego Ruiz')
    expect(row.className).toContain('text-[28px]')
  })
})

describe('PodiumBoard — loading, error and the invite', () => {
  it('shows a skeleton while loading, with no invite yet', () => {
    render(<PodiumBoard {...props({ status: 'loading' })} />)

    expect(screen.getByTestId('podium-loading')).toBeDefined()
    expect(screen.queryByTestId('podium-invite')).toBeNull()
  })

  it('shows a destructive alert whose retry calls onRetry', () => {
    const onRetry = vi.fn()
    render(<PodiumBoard {...props({ status: 'error', onRetry })} />)

    expect(screen.getByTestId('podium-error').getAttribute('role')).toBe('alert')
    fireEvent.click(screen.getByTestId('podium-error-retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('closes with the invite to the next edition (P2-A)', () => {
    render(<PodiumBoard {...props()} />)

    expect(screen.getByTestId('podium-invite').textContent).toBe(
      'Obrigado por participar — até a próxima edição!',
    )
  })
})

describe('PodiumBoard — entry and confetti', () => {
  it('starts the places hidden and rises them in when motion is allowed', () => {
    render(<PodiumBoard {...props()} />)

    expect(screen.getByTestId('podium-place-1').style.opacity).toBe('0')
    expect(screen.getByTestId('podium-place-3').style.opacity).toBe('0')
  })

  it('renders every place already in its final state with reduced motion', () => {
    setMatchMediaMatches(REDUCED_MOTION, true)
    render(<PodiumBoard {...props({ teams: ranking(5) })} />)

    for (const id of ['podium-place-1', 'podium-place-2', 'podium-place-3', 'podium-rest']) {
      expect(screen.getByTestId(id).style.opacity).not.toBe('0')
    }
    expect(screen.getByTestId('podium-invite').style.opacity).not.toBe('0')
  })

  it('fires a confetti burst from its button', () => {
    render(<PodiumBoard {...props()} />)
    expect(screen.queryByTestId('podium-confetti')).toBeNull()

    fireEvent.click(screen.getByTestId('podium-confetti-button'))

    expect(screen.getByTestId('podium-confetti')).toBeDefined()
    expect(screen.getByTestId('podium-confetti-button').getAttribute('aria-label')).toBe(
      'Soltar confete',
    )
  })
})

describe('PodiumBoard — a telão session', () => {
  it('hides the chrome and forces dark while mounted, restoring both on unmount', () => {
    setTheme('light')
    const { unmount } = render(<PodiumBoard {...props()} />)

    expect(isPresentationActive()).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    unmount()

    expect(isPresentationActive()).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('opens with focus on the exit button, which has an accessible name', () => {
    render(<PodiumBoard {...props()} />)

    const exit = screen.getByTestId('podium-exit-button')
    expect(document.activeElement).toBe(exit)
    expect(exit.getAttribute('aria-label')).toBe('Sair do telão')
  })

  it('exits through the button, Escape and the browser leaving fullscreen', () => {
    const onExit = vi.fn()
    render(<PodiumBoard {...props({ onExit })} />)

    fireEvent.click(screen.getByTestId('podium-exit-button'))
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(onExit).toHaveBeenCalledTimes(3)
  })

  it('exits from the error state too', () => {
    const onExit = vi.fn()
    render(<PodiumBoard {...props({ status: 'error', onExit })} />)

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('never shows the denominators notices', () => {
    render(<PodiumBoard {...props()} />)

    expect(screen.queryByTestId('leaderboard-denominators-inconsistent')).toBeNull()
    expect(screen.queryByTestId('leaderboard-denominators-unknown')).toBeNull()
  })
})
