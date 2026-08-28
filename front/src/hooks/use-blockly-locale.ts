import type { BlockLocale } from '@kumite/blocks'
import * as Blockly from 'blockly'
import { type RefObject, useEffect, useRef, useState } from 'react'
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
 */
export function useBlocklyLocale(
  workspaceRef: RefObject<BlocklyWorkspaceHandle | null>,
): Blockly.utils.toolbox.ToolboxDefinition {
  const { i18n } = useTranslation()
  const locale = toBlockLocale(i18n.resolvedLanguage ?? i18n.language)
  const [toolbox, setToolbox] = useState(() => applyBlocklyLocale(locale))
  const appliedLocaleRef = useRef(locale)

  useEffect(() => {
    registerVariablesFlyout(workspaceRef.current?.getWorkspace(), locale)

    if (appliedLocaleRef.current === locale) return
    appliedLocaleRef.current = locale

    setToolbox(applyBlocklyLocale(locale))

    const handle = workspaceRef.current
    if (!handle) return
    const state = handle.serialize()
    Blockly.Events.disable()
    try {
      handle.clear()
      handle.deserialize(state)
    } finally {
      Blockly.Events.enable()
    }
  }, [locale, workspaceRef])

  return toolbox
}
