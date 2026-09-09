import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clearSession, type SessionUser, setSession } from '@/lib/session'
import { useSession } from './use-session'

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

function Probe() {
  const { status, user } = useSession()
  return <div data-testid="probe">{`${status}:${user?.email ?? 'none'}`}</div>
}

beforeEach(() => {
  clearSession('manual')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('useSession', () => {
  it('reflects setSession and clearSession updates', () => {
    render(<Probe />)

    expect(screen.getByTestId('probe').textContent).toBe('anonymous:none')

    act(() => {
      setSession(fakeUser, 'tok-1')
    })
    expect(screen.getByTestId('probe').textContent).toBe('authenticated:ada@edu.pucrs.br')

    act(() => {
      clearSession('manual')
    })
    expect(screen.getByTestId('probe').textContent).toBe('anonymous:none')
  })
})
