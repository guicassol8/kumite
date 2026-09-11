import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setTheme, THEME_STORAGE_KEY } from '@/lib/theme'
import { useTheme } from './use-theme'

function Probe() {
  const { theme, resolvedTheme, setTheme: choose } = useTheme()
  return (
    <button data-testid="probe" onClick={() => choose('dark')} type="button">
      {`${theme}:${resolvedTheme}`}
    </button>
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  setTheme('system')
  localStorage.clear()
})

afterEach(cleanup)

describe('useTheme', () => {
  it('reports the saved choice and what it resolves to', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(<Probe />)

    expect(screen.getByTestId('probe').textContent).toBe('dark:dark')
  })

  it('re-renders when the theme changes outside React', () => {
    render(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe('system:light')

    act(() => setTheme('dark'))

    expect(screen.getByTestId('probe').textContent).toBe('dark:dark')
  })

  it('exposes a setter that drives the store', () => {
    render(<Probe />)

    act(() => {
      screen.getByTestId('probe').click()
    })

    expect(screen.getByTestId('probe').textContent).toBe('dark:dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})
