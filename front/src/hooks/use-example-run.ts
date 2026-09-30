import { type BlockLocale, generateSolution, type WorkspaceState } from '@kumite/blocks'
import { useCallback, useEffect, useRef, useState } from 'react'

import { deepEqual } from '@/lib/deep-equal'
import { type CaseOutcome, type ExampleCase, runExamples } from '@/lib/run-examples'
import { isEmptySolution } from '@/lib/solution-state'
import type { SolutionWorker } from '@/lib/solution-worker'

export type ExampleRunState =
  | { status: 'idle' }
  | { status: 'empty' }
  | { status: 'invalid'; message: string }
  /**
   * `examples` is the list the run was started with — the one the outcomes
   * pair with, index by index (#197). `null` marks a case that has not
   * answered yet.
   */
  | { status: 'running'; examples: readonly ExampleCase[]; outcomes: (CaseOutcome | null)[] }
  | { status: 'done'; examples: readonly ExampleCase[]; outcomes: CaseOutcome[] }

const IDLE: ExampleRunState = { status: 'idle' }

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
 *
 * `locale` is required, not defaulted: `generateSolution` re-registers the
 * kumite blocks globally in the locale it gets, the same registry the editor
 * draws from, so a run without the UI locale flipped every block created
 * afterwards back to pt (#183).
 *
 * `examples` can change under a run already on screen: the problem query
 * refetches on window focus, and an organizer may have edited them (#197).
 * A run whose examples are no longer the loaded ones — compared by content,
 * so a language switch's new array with the same cases keeps it — is
 * dropped back to `idle`, silently: the participant runs again. Whatever it
 * still has in flight lands nowhere.
 */
export function useExampleRun(
  examples: readonly ExampleCase[],
  locale: BlockLocale,
  options: UseExampleRunOptions = {},
) {
  const [state, setState] = useState<ExampleRunState>(IDLE)
  // Bumped by every run and every drop: a run only ever writes while it is
  // still the latest one. Executar comes back as soon as a run is dropped, so
  // a new run can start while the old one's workers are still answering.
  const runIdRef = useRef(0)

  // Read at call time, so passing an options literal does not re-create `run`
  // on every render.
  const optionsRef = useRef(options)
  optionsRef.current = options

  const run = useCallback(
    async (workspace: WorkspaceState) => {
      runIdRef.current += 1
      const runId = runIdRef.current
      const settle = (next: ExampleRunState) => {
        if (runIdRef.current === runId) setState(next)
      }

      if (isEmptySolution(workspace)) {
        settle({ status: 'empty' })
        return
      }

      let code: string
      try {
        code = generateSolution(workspace, locale)
      } catch (error) {
        // `BlocksError` is the expected shape here and its message is already
        // localized. Anything else is a bug, and showing its message beats an
        // unhandled rejection that leaves the button spinning forever.
        settle({
          status: 'invalid',
          message: error instanceof Error ? error.message : String(error),
        })
        return
      }

      const outcomes: (CaseOutcome | null)[] = examples.map(() => null)
      settle({ status: 'running', examples, outcomes: [...outcomes] })

      const settled = await runExamples(code, examples, {
        ...optionsRef.current,
        onCaseSettled: (index, outcome) => {
          outcomes[index] = outcome
          settle({ status: 'running', examples, outcomes: [...outcomes] })
        },
      })

      settle({ status: 'done', examples, outcomes: settled })
    },
    [examples, locale],
  )

  const stale =
    (state.status === 'running' || state.status === 'done') && !deepEqual(state.examples, examples)

  // Dropped for good, not just hidden: the old examples coming back must not
  // bring the old results with them, and the old run must stop writing.
  useEffect(() => {
    if (!stale) return
    runIdRef.current += 1
    setState(IDLE)
  }, [stale])

  // Derived as well, so not even the render before the effect pairs the
  // outcomes with examples they did not run against.
  return { state: stale ? IDLE : state, run }
}
