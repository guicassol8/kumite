import { generateSolution, type WorkspaceState } from '@kumite/blocks'
import { useCallback, useRef, useState } from 'react'

import { type CaseOutcome, type ExampleCase, runExamples } from '@/lib/run-examples'
import { isEmptySolution } from '@/lib/solution-state'
import type { SolutionWorker } from '@/lib/solution-worker'

export type ExampleRunState =
  | { status: 'idle' }
  | { status: 'empty' }
  | { status: 'invalid'; message: string }
  /** `null` marks a case that has not answered yet. */
  | { status: 'running'; outcomes: (CaseOutcome | null)[] }
  | { status: 'done'; outcomes: CaseOutcome[] }

export type UseExampleRunOptions = {
  spawnWorker?: () => SolutionWorker
  timeoutMs?: number
}

/**
 * Drives one run of the example cases, from the click to the last outcome.
 *
 * Codegen happens here, on the main thread, and only the resulting source
 * crosses into a worker: a workspace the curated toolbox refuses is rejected
 * before any worker starts, and the worker bundle stays free of Blockly.
 */
export function useExampleRun(
  examples: readonly ExampleCase[],
  options: UseExampleRunOptions = {},
) {
  const [state, setState] = useState<ExampleRunState>({ status: 'idle' })

  // Read at call time, so passing an options literal does not re-create `run`
  // on every render.
  const optionsRef = useRef(options)
  optionsRef.current = options

  const run = useCallback(
    async (workspace: WorkspaceState) => {
      if (isEmptySolution(workspace)) {
        setState({ status: 'empty' })
        return
      }

      let code: string
      try {
        code = generateSolution(workspace)
      } catch (error) {
        // `BlocksError` is the expected shape here and its message is already
        // localized. Anything else is a bug, and showing its message beats an
        // unhandled rejection that leaves the button spinning forever.
        setState({
          status: 'invalid',
          message: error instanceof Error ? error.message : String(error),
        })
        return
      }

      const outcomes: (CaseOutcome | null)[] = examples.map(() => null)
      setState({ status: 'running', outcomes: [...outcomes] })

      const settled = await runExamples(code, examples, {
        ...optionsRef.current,
        onCaseSettled: (index, outcome) => {
          outcomes[index] = outcome
          setState({ status: 'running', outcomes: [...outcomes] })
        },
      })

      setState({ status: 'done', outcomes: settled })
    },
    [examples],
  )

  return { state, run }
}
