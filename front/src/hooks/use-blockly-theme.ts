import { kumiteTheme, kumiteThemeDark } from '@kumite/blocks'
import type * as Blockly from 'blockly'

import { useTheme } from '@/hooks/use-theme'

/**
 * The Blockly theme for the current UI mode (#218). Reads the *resolved*
 * mode, so with the choice on `system` the editor follows the OS live, like
 * the rest of the app. Feed it to `<BlocklyWorkspace theme>`, which swaps it in
 * place without remounting the editor.
 */
export function useBlocklyTheme(): Blockly.Theme {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'dark' ? kumiteThemeDark : kumiteTheme
}
