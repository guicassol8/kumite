import type { BlockLocale } from '@kumite/blocks'
import * as Blockly from 'blockly'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { BlocklyWorkspaceHandle } from '@/components/blockly/blockly-workspace'
import { applyBlocklyLocale, registerVariablesFlyout } from '@/lib/blockly-setup'

function toBlockLocale(language: string): BlockLocale {
  return language === 'es' || language === 'en' ? language : 'pt'
}

/**
 * Keeps the Blockly toolbox and an already-open workspace in sync with the
 * active UI language (#57): applies the locale once up front, then whenever
 * it changes, reloads the live workspace through its own serialized state so
 * every block re-runs `init()` with the new locale's labels while what was
 * built stays exactly as connected.
 *
 * `onReady` must be wired to `BlocklyWorkspace`'s own `onReady` prop — it is
 * what does the *first* registration, tied to the exact instance Blockly
 * injects rather than to this hook's own effect timing (see that prop's doc
 * for why: React StrictMode's dev-only double-mount can otherwise leave the
 * registration on an instance Blockly has already disposed).
 *
 * `onCreateVariable` is what the flyout's "create variable" button calls
 * (#205). It is read through a ref, so both registrations — on ready and on
 * a language switch — always reach the latest one.
 */
export function useBlocklyLocale(
  workspaceRef: RefObject<BlocklyWorkspaceHandle | null>,
  onCreateVariable: (target: Blockly.WorkspaceSvg) => void,
): {
  toolbox: Blockly.utils.toolbox.ToolboxDefinition
  onReady: (workspace: Blockly.WorkspaceSvg) => void
} {
  const { i18n } = useTranslation()
  const locale = toBlockLocale(i18n.resolvedLanguage ?? i18n.language)
  const [toolbox, setToolbox] = useState(() => applyBlocklyLocale(locale))
  const appliedLocaleRef = useRef(locale)
  const localeRef = useRef(locale)
  localeRef.current = locale
  const onCreateVariableRef = useRef(onCreateVariable)
  onCreateVariableRef.current = onCreateVariable

  const createVariable = useCallback((target: Blockly.WorkspaceSvg) => {
    onCreateVariableRef.current(target)
  }, [])

  const onReady = useCallback(
    (workspace: Blockly.WorkspaceSvg) => {
      registerVariablesFlyout(workspace, localeRef.current, createVariable)
    },
    [createVariable],
  )

  useEffect(() => {
    if (appliedLocaleRef.current === locale) return
    appliedLocaleRef.current = locale

    setToolbox(applyBlocklyLocale(locale))

    const handle = workspaceRef.current
    if (!handle) return
    const workspace = handle.getWorkspace()
    if (workspace) registerVariablesFlyout(workspace, locale, createVariable)

    const state = handle.serialize()
    Blockly.Events.disable()
    try {
      handle.clear()
      handle.deserialize(state)
    } finally {
      Blockly.Events.enable()
    }
  }, [locale, workspaceRef, createVariable])

  return { toolbox, onReady }
}
