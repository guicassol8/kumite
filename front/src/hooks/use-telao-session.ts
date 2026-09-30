import { type RefObject, useEffect } from 'react'

import { setPresentationActive } from '@/lib/presentation-mode'
import { applyTheme } from '@/lib/theme'

/**
 * What any projected screen does while it is up (#220, extracted in #284 so
 * the telão and the pódio share it instead of copying it):
 *
 * - raises the presentation signal (header and footer hide, whether or not
 *   real fullscreen ever engaged) and forces dark, independent of the user's
 *   own theme choice — never through `setTheme`, which would persist it. Both
 *   come back on unmount through `applyTheme()`, which re-reads that choice;
 * - moves focus to `focusRef` (the exit button) on mount;
 * - listens to the two exits identity.md § 5 makes mandatory: the browser
 *   leaving fullscreen on its own (`fullscreenchange` with no element — Esc
 *   consumed by the browser, F11, a system gesture) and an `Escape` keydown,
 *   which is the only one that fires when `requestFullscreen` never took
 *   effect. Either calls `onExit`.
 */
export function useTelaoSession({
  onExit,
  focusRef,
}: {
  onExit: () => void
  focusRef: RefObject<HTMLElement | null>
}): void {
  useEffect(() => {
    setPresentationActive(true)
    document.documentElement.classList.add('dark')
    focusRef.current?.focus()
    return () => {
      setPresentationActive(false)
      applyTheme()
    }
  }, [focusRef])

  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) onExit()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onExit()
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onExit])
}
