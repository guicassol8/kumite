// rota temporária de dev — removida na #3
import { buildToolbox, defineKumiteBlocks, emptyWorkspaceState } from '@kumite/blocks'
import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'

import {
  BlocklyWorkspace,
  type BlocklyWorkspaceHandle,
  type WorkspaceState,
} from '@/components/blockly/blockly-workspace'
import { Button } from '@/components/ui/button'

// Os blocos precisam existir antes de qualquer workspace ser injetado — e o
// registro é global no Blockly, então o topo do módulo é o lugar certo.
defineKumiteBlocks('pt')

const toolbox = buildToolbox('pt')

export const Route = createFileRoute('/sandbox/editor')({
  component: SandboxEditor,
})

// Exemplo montado dentro do bloco-raiz: é assim que uma solução de verdade se
// parece, com corpo e valor de retorno.
const exampleState: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'kumite_solve',
        id: 'exemploRaiz',
        x: 40,
        y: 40,
        inputs: {
          BODY: {
            block: {
              type: 'controls_if',
              id: 'exemploIf',
              inputs: {
                IF0: {
                  block: { type: 'logic_boolean', id: 'exemploBool', fields: { BOOL: 'TRUE' } },
                },
              },
            },
          },
          RETURN: {
            block: { type: 'math_number', id: 'exemploNum', fields: { NUM: 42 } },
          },
        },
      },
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 md:flex-row">
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-md border">
          <BlocklyWorkspace
            ref={workspace}
            toolbox={toolbox}
            initialState={emptyWorkspaceState}
            onChange={setState}
          />
        </div>
        <pre
          data-testid="sandbox-json"
          className="h-40 shrink-0 overflow-auto rounded-md border p-2 text-xs md:h-auto md:w-80"
        >
          {state ? JSON.stringify(state, null, 2) : ''}
        </pre>
      </div>
    </main>
  )
}
