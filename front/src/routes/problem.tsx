import { emptyWorkspaceState, withRootBlock } from '@kumite/blocks'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import {
  BlocklyWorkspace,
  type BlocklyWorkspaceHandle,
} from '@/components/blockly/blockly-workspace'
import { somaDosParesProblem } from '@/components/problem/soma-dos-pares'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useWorkspaceAutoSave } from '@/hooks/use-workspace-autosave'
// Importing this registers the blocks and the pt-br locale, before any
// workspace is injected.
import { registerVariablesFlyout, toolbox, workspaceOptions } from '@/lib/blockly-setup'

export const Route = createFileRoute('/problem')({
  component: ProblemScreen,
})

function ProblemScreen() {
  const { t } = useTranslation()
  const workspaceRef = useRef<BlocklyWorkspaceHandle>(null)
  const { initialState, handleChange, clearSaved } = useWorkspaceAutoSave(somaDosParesProblem.id)

  // The child injects the workspace in its own effect, which runs before this
  // one, and Blockly only resolves a `custom` category when it is clicked — so
  // registering here is early enough.
  useEffect(() => {
    registerVariablesFlyout(workspaceRef.current?.getWorkspace())
  }, [])

  return (
    <main className="flex h-dvh flex-col gap-4 p-4 md:flex-row">
      <Card
        data-testid="problem-statement-panel"
        aria-label={t('problem.statementLabel')}
        className="max-h-64 shrink-0 overflow-auto md:max-h-none md:w-96"
      >
        <CardHeader>
          <CardTitle>{somaDosParesProblem.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p>{somaDosParesProblem.statement}</p>
          <div>
            <h2 className="mb-2 font-semibold">{t('problem.examplesHeading')}</h2>
            <ul className="flex flex-col gap-2">
              {somaDosParesProblem.examples.map((example, index) => (
                <li
                  key={index}
                  data-testid={`problem-example-${index}`}
                  className="rounded-md border p-2"
                >
                  <div>
                    <span className="font-medium">{t('problem.exampleInput')}: </span>
                    {JSON.stringify(example.input)}
                  </div>
                  <div>
                    <span className="font-medium">{t('problem.exampleOutput')}: </span>
                    {example.expected}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
      <div
        data-testid="problem-workspace-panel"
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
      >
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-md border">
          <BlocklyWorkspace
            ref={workspaceRef}
            toolbox={toolbox}
            options={workspaceOptions}
            // A state saved before the root became undeletable may not have it,
            // and the toolbox never offers it back — re-seed instead of losing
            // the blocks.
            initialState={withRootBlock(initialState)}
            onChange={handleChange}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button data-testid="problem-run-button">{t('problem.executeButton')}</Button>
          <Button
            type="button"
            variant="destructive"
            data-testid="problem-clear-button"
            onClick={() => {
              if (!window.confirm(t('problem.clearConfirm'))) return
              // The root block isn't offered by the toolbox (it's seeded, not
              // dragged in), so "clear" resets to it rather than to nothing —
              // an empty workspace would leave no way back in.
              workspaceRef.current?.deserialize(emptyWorkspaceState)
              clearSaved()
            }}
          >
            {t('problem.clearButton')}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="problem-submit-button"
                  aria-disabled="true"
                  className="cursor-not-allowed opacity-50"
                >
                  {t('problem.submitButton')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('problem.submitHint')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </main>
  )
}
