import { kumiteTheme, kumiteThemeDark, ROOT_BLOCK_TYPE, type WorkspaceState } from '@kumite/blocks'
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  BlocklyWorkspace,
  type BlocklyWorkspaceHandle,
} from '@/components/blockly/blockly-workspace'
import i18n from '@/i18n'
import { DARK_SCHEME_QUERY, setTheme, watchSystemTheme } from '@/lib/theme'
import { setMatchMediaMatches } from '@/test/match-media-jsdom'
import { useBlocklyLocale } from './use-blockly-locale'
import { useBlocklyTheme } from './use-blockly-theme'

const fixture: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      { type: ROOT_BLOCK_TYPE, id: 'kumiteSolveRoot', x: 40, y: 40 },
      { type: 'math_number', id: 'fixtureNum', x: 20, y: 20, fields: { NUM: 42 } },
    ],
  },
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  setTheme('system')
  localStorage.clear()
})

afterEach(async () => {
  cleanup()
  setMatchMediaMatches(DARK_SCHEME_QUERY, false)
  await i18n.changeLanguage('pt')
})

describe('useBlocklyTheme', () => {
  it('follows the explicit choice', () => {
    const { result } = renderHook(() => useBlocklyTheme())

    act(() => setTheme('dark'))
    expect(result.current).toBe(kumiteThemeDark)

    act(() => setTheme('light'))
    expect(result.current).toBe(kumiteTheme)
  })

  it('follows the OS preference while the choice is "system"', () => {
    const stopWatching = watchSystemTheme()
    const { result } = renderHook(() => useBlocklyTheme())
    expect(result.current).toBe(kumiteTheme)

    act(() => setMatchMediaMatches(DARK_SCHEME_QUERY, true))

    expect(result.current).toBe(kumiteThemeDark)
    stopWatching()
  })

  it('keeps the theme on the workspace across a language switch', async () => {
    const workspaceRef = createRef<BlocklyWorkspaceHandle>()
    function Host() {
      const { toolbox, onReady } = useBlocklyLocale(workspaceRef, () => {})
      const theme = useBlocklyTheme()
      return (
        <BlocklyWorkspace
          ref={workspaceRef}
          toolbox={toolbox}
          theme={theme}
          initialState={fixture}
          onReady={onReady}
        />
      )
    }
    render(<Host />)
    act(() => setTheme('dark'))
    expect(workspaceRef.current?.getWorkspace()?.getTheme().name).toBe('kumite-dark')

    await act(async () => {
      await i18n.changeLanguage('es')
    })

    expect(workspaceRef.current?.getWorkspace()?.getTheme().name).toBe('kumite-dark')
    expect(workspaceRef.current?.serialize().blocks?.blocks).toHaveLength(2)
  })
})
