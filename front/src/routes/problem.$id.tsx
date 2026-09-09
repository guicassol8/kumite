import { emptyWorkspaceState, withRootBlock } from '@kumite/blocks'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  BlocklyWorkspace,
  type BlocklyWorkspaceHandle,
} from '@/components/blockly/blockly-workspace'
import { ExampleResults, type ExampleResultsNotice } from '@/components/problem/example-results'
import {
  type SubmissionResult,
  SubmissionResultPanel,
} from '@/components/problem/submission-result'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBlocklyLocale } from '@/hooks/use-blockly-locale'
import { useEventStream } from '@/hooks/use-event-stream'
import { type ExampleRunState, useExampleRun } from '@/hooks/use-example-run'
import { useWorkspaceAutoSave } from '@/hooks/use-workspace-autosave'
import { formatDate } from '@/i18n/format'
import { api } from '@/lib/api'
import { workspaceOptions } from '@/lib/blockly-setup'
import { fetchProblem, ProblemNotFoundError, problemQueryKey } from '@/lib/problems-query'
import { requireAuth } from '@/lib/route-guards'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/problem/$id')({
  beforeLoad: requireAuth,
  component: ProblemScreen,
})

function toApiLocale(language: string): 'pt' | 'es' | 'en' {
  return language === 'es' || language === 'en' ? language : 'pt'
}

function noticeFor(state: ExampleRunState): ExampleResultsNotice | undefined {
  if (state.status === 'empty') return 'empty'
  if (state.status === 'invalid') return { message: state.message }
  return undefined
}

function outcomesOf(state: ExampleRunState) {
  return state.status === 'running' || state.status === 'done' ? state.outcomes : []
}

// The banner shown after a submit attempt that did not produce a verdict —
// either a stable, translated reason or (codegen_rejected) the server's own
// already-localized message, verbatim.
type SubmitBanner = { key: string } | { message: string }

function ProblemScreen() {
  const { t, i18n } = useTranslation()
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const locale = toApiLocale(i18n.resolvedLanguage ?? i18n.language)
  const lang = i18n.resolvedLanguage ?? i18n.language

  const workspaceRef = useRef<BlocklyWorkspaceHandle>(null)
  const { toolbox, onReady: onWorkspaceReady } = useBlocklyLocale(workspaceRef)
  const { initialState, handleChange, clearSaved } = useWorkspaceAutoSave(id)

  useEventStream(() => queryClient.invalidateQueries({ queryKey: problemQueryKey(id) }))

  const problem = useQuery({
    queryKey: [...problemQueryKey(id), locale],
    queryFn: () => fetchProblem(id, locale),
  })

  const examples = problem.data?.examples ?? []
  const { state: runState, run } = useExampleRun(examples)
  const isRunning = runState.status === 'running'

  const [verdict, setVerdict] = useState<SubmissionResult | null>(null)
  const [submitBanner, setSubmitBanner] = useState<SubmitBanner | null>(null)

  const submit = useMutation({
    mutationFn: async () => {
      const data = problem.data
      if (!data || !data.roundId) throw new Error('no active round')
      return api.submissions.$post({
        json: {
          problemId: data.id,
          roundId: data.roundId,
          workspace: workspaceRef.current?.serialize() ?? {},
          locale,
        },
      })
    },
  })

  async function handleSubmit() {
    setSubmitBanner(null)
    try {
      const res = await submit.mutateAsync()
      if (res.status === 201) {
        setVerdict(await res.json())
        return
      }
      if (res.status === 429) {
        setSubmitBanner({ key: 'problem.submitError.cooldown' })
        return
      }
      if (res.status === 400) {
        const body = await res.json().catch(() => null)
        setSubmitBanner(
          body ? { message: body.message } : { key: 'problem.submitError.unexpected' },
        )
        return
      }
      if (res.status === 404) {
        // not_in_team / no_active_round / problem_not_found — only ever a
        // race (team left, round closed mid-edit).
        setSubmitBanner({ key: 'problem.submitError.race' })
        return
      }
      // Any other/undeclared status (a genuine 5xx included) is not a race —
      // same generic fallback the rest of the front uses for this case
      // (teams.tsx, organizer.rounds.new.tsx).
      setSubmitBanner({ key: 'problem.submitError.unexpected' })
    } catch {
      setSubmitBanner({ key: 'problem.submitError.unexpected' })
    }
  }

  if (problem.isError) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 p-8">
        {problem.error instanceof ProblemNotFoundError ? (
          <div data-testid="problem-not-found" className="flex flex-col items-start gap-2">
            <p>{t('problem.notFound.title')}</p>
            <Link to="/" className="text-primary text-sm underline">
              {t('problem.notFound.backHome')}
            </Link>
          </div>
        ) : (
          <div data-testid="problem-load-error" className="flex flex-col items-start gap-2">
            <p>{t('problem.loadError.message')}</p>
            <Button
              type="button"
              variant="outline"
              data-testid="problem-load-retry"
              onClick={() => problem.refetch()}
            >
              {t('problem.loadError.retry')}
            </Button>
          </div>
        )}
      </main>
    )
  }

  if (problem.isPending) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 p-8">
        <p data-testid="problem-loading">{t('problem.loading')}</p>
      </main>
    )
  }

  const data = problem.data
  const isClosed = data.roundStatus === 'closed'
  // Drives both the results band and how much room the statement gives up
  // for it on the stacked (mobile) layout.
  const hasResults = runState.status !== 'idle' || verdict !== null

  return (
    <main className="flex min-h-0 grow basis-0 flex-col gap-4 overflow-hidden p-4 md:flex-row">
      <Card
        data-testid="problem-statement-panel"
        aria-label={t('problem.statementLabel')}
        className={cn(
          'overflow-auto md:max-h-none md:w-96 md:shrink-0',
          // Stacked layout only: the side column on md+ owns a whole column
          // and never competes with the band for height.
          hasResults ? 'max-h-36' : 'max-h-64',
        )}
      >
        <CardHeader>
          <CardTitle>{data.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p>{data.statementMd}</p>
          <div>
            <h2 className="mb-2 font-semibold">{t('problem.examplesHeading')}</h2>
            <ul className="flex flex-col gap-2">
              {data.examples.map((example, index) => (
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
                    {JSON.stringify(example.expected)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
      <div
        data-testid="problem-workspace-panel"
        className="flex min-h-0 min-w-0 grow basis-0 flex-col gap-4"
      >
        {isClosed && (
          <Alert data-testid="problem-closed-notice" className="shrink-0">
            <AlertDescription className="flex flex-col gap-1">
              <span>{t('problem.closedRound.notice')}</span>
              {data.bestSubmission ? (
                <span data-testid="problem-closed-best-score">
                  {t('problem.closedRound.bestScore', {
                    score: data.bestSubmission.score,
                    attempts: data.bestSubmission.attempts,
                    date: formatDate(new Date(data.bestSubmission.achievedAt), lang),
                  })}
                </span>
              ) : (
                <span data-testid="problem-closed-never-submitted">
                  {t('problem.closedRound.neverSubmitted')}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {submitBanner && (
          <Alert
            variant="destructive"
            className="shrink-0"
            data-testid={
              'key' in submitBanner && submitBanner.key === 'problem.submitError.cooldown'
                ? 'problem-cooldown-banner'
                : 'problem-submit-error-banner'
            }
          >
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>{'key' in submitBanner ? t(submitBanner.key) : submitBanner.message}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSubmitBanner(null)}
              >
                {t('problem.submitError.dismiss')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="min-h-44 min-w-0 grow basis-0 overflow-hidden rounded-md border">
          <BlocklyWorkspace
            ref={workspaceRef}
            toolbox={toolbox}
            options={workspaceOptions}
            // A state saved before the root became undeletable may not have it,
            // and the toolbox never offers it back — re-seed instead of losing
            // the blocks.
            initialState={withRootBlock(initialState)}
            onChange={handleChange}
            onReady={onWorkspaceReady}
          />
        </div>
        {hasResults && (
          // The one scrollable strip of the panel: results grow into it and it
          // gives way (up to 45% of the panel) instead of pushing the bar off
          // screen (#155).
          <div
            data-testid="problem-results-band"
            className="flex max-h-[45%] min-h-0 shrink flex-col gap-4 overflow-auto"
          >
            {runState.status !== 'idle' && (
              <ExampleResults
                examples={examples}
                outcomes={outcomesOf(runState)}
                notice={noticeFor(runState)}
              />
            )}
            {verdict && <SubmissionResultPanel result={verdict} />}
          </div>
        )}
        {/* Last in the panel and never shrinking: that is what keeps Executar,
            Limpar and Enviar on screen whatever the results do. */}
        <div
          data-testid="problem-actions-bar"
          className="flex shrink-0 items-center gap-2 border-t pt-4"
        >
          <Button
            type="button"
            data-testid="problem-run-button"
            disabled={isRunning}
            onClick={() => {
              // The run owns its own errors and settles into a state — nothing
              // here has to await it.
              void run(workspaceRef.current?.serialize() ?? {})
            }}
          >
            {isRunning ? t('problem.executeRunning') : t('problem.executeButton')}
          </Button>
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
          {!isClosed && (
            <Button
              type="button"
              data-testid="problem-submit-button"
              disabled={submit.isPending}
              onClick={() => void handleSubmit()}
            >
              {submit.isPending ? t('problem.submitProgress') : t('problem.submitButton')}
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
