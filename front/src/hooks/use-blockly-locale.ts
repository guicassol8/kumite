import type { BlockLocale } from '@kumite/blocks'
import * as Blockly from 'blockly'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { BlocklyWorkspaceHandle } from '@/components/blockly/blockly-workspace'
import { applyBlocklyLocale, registerVariablesFlyout } from '@/lib/blockly-setup'
import type { VariableDialogRequest } from '@/lib/blockly-variable-field'

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
 * `onVariableDialog` is what the flyout's "create variable" button (#205) and
 * a variable dropdown's "rename" and "delete" (#335) call. It is read through
 * a ref, so both registrations — on ready and on a language switch — always
 * reach the latest one.
 */
export function useBlocklyLocale(
  workspaceRef: RefObject<BlocklyWorkspaceHandle | null>,
  onVariableDialog: (request: VariableDialogRequest) => void,
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
  const onVariableDialogRef = useRef(onVariableDialog)
  onVariableDialogRef.current = onVariableDialog

  const variableDialog = useCallback((request: VariableDialogRequest) => {
    onVariableDialogRef.current(request)
  }, [])

  const onReady = useCallback(
    (workspace: Blockly.WorkspaceSvg) => {
      registerVariablesFlyout(workspace, localeRef.current, variableDialog)
    },
    [variableDialog],
  )

  useEffect(() => {
    if (appliedLocaleRef.current === locale) return
    appliedLocaleRef.current = locale

    setToolbox(applyBlocklyLocale(locale))

    const handle = workspaceRef.current
    if (!handle) return
    const workspace = handle.getWorkspace()
    if (workspace) registerVariablesFlyout(workspace, locale, variableDialog)

    const state = handle.serialize()
    Blockly.Events.disable()
    try {
      handle.clear()
      handle.deserialize(state)
    } finally {
      Blockly.Events.enable()
    }
  }, [locale, workspaceRef, variableDialog])

  return { toolbox, onReady }
}
