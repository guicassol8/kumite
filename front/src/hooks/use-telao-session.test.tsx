import { cleanup, render, screen } from '@testing-library/react'
import { act, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isPresentationActive, setPresentationActive } from '@/lib/presentation-mode'
import { setTheme } from '@/lib/theme'

import { useTelaoSession } from './use-telao-session'

// The session a projected screen opens (#284 T1): the telão and the pódio
// both hide the chrome, force dark, focus their exit button and leave on
// either exit path. A bare component is enough to drive it — the hook owns
// no markup.
function Harness({ onExit }: { onExit: () => void }) {
  const exitRef = useRef<HTMLButtonElement>(null)
  useTelaoSession({ onExit, focusRef: exitRef })
  return (
    <button ref={exitRef} type="button" data-testid="harness-exit">
      exit
    </button>
  )
}

function setFullscreenElement(value: Element | null) {
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, value })
}

beforeEach(() => {
  document.documentElement.className = ''
  setTheme('system')
  setFullscreenElement(null)
})

afterEach(() => {
  cleanup()
  setPresentationActive(false)
  document.documentElement.className = ''
  localStorage.clear()
})

describe('useTelaoSession — mount and unmount', () => {
  it('raises the presentation signal and forces dark, restoring both on unmount', () => {
    setTheme('light')
    const { unmount } = render(<Harness onExit={vi.fn()} />)

    expect(isPresentationActive()).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    unmount()

    expect(isPresentationActive()).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it("restores the user's own dark choice, not a forced light, on unmount", () => {
    setTheme('dark')
    const { unmount } = render(<Harness onExit={vi.fn()} />)

    unmount()

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('moves focus to the element behind focusRef on mount', () => {
    render(<Harness onExit={vi.fn()} />)

    expect(document.activeElement).toBe(screen.getByTestId('harness-exit'))
  })
})

describe('useTelaoSession — the two exits', () => {
  it('calls onExit on an Escape keydown (the fallback without the Fullscreen API)', () => {
    const onExit = vi.fn()
    render(<Harness onExit={onExit} />)

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('ignores any other key', () => {
    const onExit = vi.fn()
    render(<Harness onExit={onExit} />)

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    })

    expect(onExit).not.toHaveBeenCalled()
  })

  it('calls onExit when the browser leaves fullscreen on its own', () => {
    const onExit = vi.fn()
    setFullscreenElement(document.createElement('main'))
    render(<Harness onExit={onExit} />)

    setFullscreenElement(null)
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('does not call onExit when the fullscreenchange is the one entering fullscreen', () => {
    const onExit = vi.fn()
    render(<Harness onExit={onExit} />)

    setFullscreenElement(document.documentElement)
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(onExit).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', () => {
    const onExit = vi.fn()
    const { unmount } = render(<Harness onExit={onExit} />)
    unmount()

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(onExit).not.toHaveBeenCalled()
  })
})
