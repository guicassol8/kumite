// rota temporária de dev — removida na #3
import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'

import {
  BlocklyWorkspace,
  type BlocklyWorkspaceHandle,
  type WorkspaceState,
} from '@/components/blockly/blockly-workspace'
import { demoToolbox } from '@/components/blockly/demo-toolbox'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/sandbox/editor')({
  component: SandboxEditor,
})

const exampleState: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'controls_if',
        id: 'exemploIf',
        x: 40,
        y: 40,
        inputs: {
          IF0: {
            block: { type: 'logic_boolean', id: 'exemploBool', fields: { BOOL: 'TRUE' } },
          },
        },
      },
      { type: 'math_number', id: 'exemploNum', x: 40, y: 200, fields: { NUM: 42 } },
    ],
  },
}

// Strings hardcoded em PT de propósito: esta página não vai para o usuário
// final, ela só existe para exercitar o wrapper enquanto a #3 não traz o editor.
function SandboxEditor() {
  const workspace = useRef<BlocklyWorkspaceHandle>(null)
  const [state, setState] = useState<WorkspaceState | null>(null)

  return (
    <main className="flex h-dvh flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto font-semibold text-lg">sandbox do editor</h1>
        <Button
          data-testid="sandbox-load-example"
          onClick={() => workspace.current?.deserialize(exampleState)}
        >
          Carregar exemplo
        </Button>
        <Button
          data-testid="sandbox-clear"
          variant="outline"
          onClick={() => {
            workspace.current?.clear()
            setState(null)
          }}
        >
          Limpar
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="min-w-0 flex-1 overflow-hidden rounded-md border">
          <BlocklyWorkspace ref={workspace} toolbox={demoToolbox} onChange={setState} />
        </div>
        <pre
          data-testid="sandbox-json"
          className="w-80 shrink-0 overflow-auto rounded-md border p-2 text-xs"
        >
          {state ? JSON.stringify(state, null, 2) : ''}
        </pre>
      </div>
    </main>
  )
}
