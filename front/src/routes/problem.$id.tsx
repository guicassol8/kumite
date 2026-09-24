import { emptyWorkspaceState, withRootBlock } from '@kumite/blocks'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Info, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BlocklyWorkspace,
  type BlocklyWorkspaceHandle,
} from '@/components/blockly/blockly-workspace'
import { ActionsBar } from '@/components/problem/actions-bar'
import { ExampleResults, type ExampleResultsNotice } from '@/components/problem/example-results'
import { ProblemPanels } from '@/components/problem/problem-panels'
import {
  type SubmissionResult,
  SubmissionResultPanel,
} from '@/components/problem/submission-result'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useBlocklyLocale } from '@/hooks/use-blockly-locale'
import { type ExampleRunState, useExampleRun } from '@/hooks/use-example-run'
import { useRoundStream } from '@/hooks/use-round-stream'
import { useWorkspaceAutoSave } from '@/hooks/use-workspace-autosave'
import { formatDate } from '@/i18n/format'
import { api } from '@/lib/api'
import { workspaceOptions } from '@/lib/blockly-setup'
import { fetchProblem, ProblemNotFoundError, problemQueryKey } from '@/lib/problems-query'
import { positionLabel } from '@/lib/round-position'
import { fetchRound, roundQueryKey } from '@/lib/rounds-query'
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

  // Reads the app's single `/sse` connection instead of opening a second one
  // of its own (#274). `roundChangedAt` moves on every round.opened/
  // round.closed — the same signal the callback used to carry. The ref starts
  // at the value already on the provider, so mounting mid-round does not
  // invalidate on the first render.
  const eventStream = useRoundStream()
  const lastRoundChangeRef = useRef(eventStream.roundChangedAt)
  useEffect(() => {
    if (eventStream.roundChangedAt === lastRoundChangeRef.current) return
    lastRoundChangeRef.current = eventStream.roundChangedAt
    queryClient.invalidateQueries({ queryKey: problemQueryKey(id) })
  }, [eventStream.roundChangedAt, queryClient, id])

  const problem = useQuery({
    queryKey: [...problemQueryKey(id), locale],
    queryFn: () => fetchProblem(id, locale),
    // Switching the language is a new query key, which without this drops the
    // screen into `isPending` and tears the editor subtree down mid-solution
    // (#178). Holding the previous locale's data keeps the statement on screen
    // (translated a moment later) and the editor mounted — but only while it
    // is the *same* problem: navigating p1 → p2 must never show p1's
    // statement next to p2's workspace.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === id ? previous : undefined,
  })

  // The problem's letter in the round (A, B, C) lives on `/rounds/:id`, not on
  // `/problems/:id` — the participant payload carries no `position`. Same query
  // key as `/rounds/$id`, so opening the problem from the round list reuses the
  // round already in cache instead of fetching it twice.
  //
  // Declared here, above the `isError` / `!data` early returns below: a hook
  // after them would run on some renders and not others.
  const roundId = problem.data?.roundId ?? null
  const round = useQuery({
    queryKey: [...roundQueryKey(roundId ?? 'none'), locale],
    queryFn: () => fetchRound(roundId ?? '', locale),
    enabled: roundId !== null,
    // The letter is a decoration on a screen whose real job is the editor.
    // A failing round fetch drops it and nothing else — never a retry storm
    // and never an error state over the workspace.
    retry: false,
  })
  const problemLetter = (() => {
    const entry = round.data?.problems.find((item) => item.problemId === id)
    return entry ? positionLabel(entry.position) : undefined
  })()

  const examples = problem.data?.examples ?? []
  const { state: runState, run } = useExampleRun(examples)
  const isRunning = runState.status === 'running'

  const [verdict, setVerdict] = useState<SubmissionResult | null>(null)
  const [submitBanner, setSubmitBanner] = useState<SubmitBanner | null>(null)

  // #285: a 423 that raced the pause is stale the moment the stream catches
  // up — the paused notice takes over while it lasts, and after a resume the
  // error would contradict the re-enabled Submeter.
  useEffect(() => {
    void eventStream.submissionsPaused
    setSubmitBanner((banner) =>
      banner && 'key' in banner && banner.key === 'problem.submitError.paused' ? null : banner,
    )
  }, [eventStream.submissionsPaused])

  // Bumped by every fresh run and every fresh verdict — the desktop layout
  // (#203, T8) uses it to reopen a results band the participant collapsed
  // earlier. `hasResults` itself only flips false→true once per screen, so it
  // cannot signal "there's a *new* result" on its own.
  const [resultsVersion, setResultsVersion] = useState(0)
  useEffect(() => {
    if (runState.status !== 'idle') setResultsVersion((version) => version + 1)
  }, [runState.status])
  useEffect(() => {
    if (verdict) setResultsVersion((version) => version + 1)
  }, [verdict])

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
      if (res.status === 423) {
        // Paused by the organizer (#285) between the SSE event and the click;
        // the paused banner above usually beats this to it.
        setSubmitBanner({ key: 'problem.submitError.paused' })
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

  const data = problem.data

  // Only a failure with nothing to show takes the screen: an SSE-triggered
  // refetch that fails (the effect above invalidates this query on every
  // round change) must not throw away a workspace the participant is in the
  // middle of (#178).
  if (problem.isError && !data) {
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

  // `!data` rather than `isPending`: with the error branch above only firing
  // on an empty screen, this is what still narrows `data` to a loaded problem
  // for the whole body below.
  if (!data) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 p-8">
        <p data-testid="problem-loading">{t('problem.loading')}</p>
      </main>
    )
  }

  const isClosed = data.roundStatus === 'closed'
  // Drives both the results band and how much room the statement gives up
  // for it on the stacked (mobile) layout.
  const hasResults = runState.status !== 'idle' || verdict !== null

  // Built once so the two layout branches (T7) hand the exact same element
  // to `<BlocklyWorkspace>` — identical props by construction, not by two
  // call sites kept in sync by hand.
  const blocklyWorkspace = (
    <BlocklyWorkspace
      // The editor's identity is the problem (same reason as
      // organizer.problems.$id.edit.tsx and organizer.rounds.$id.edit.tsx):
      // going from /problem/A to /problem/B has to rebuild it around B's
      // workspace instead of keeping A's blocks on the canvas (#39).
      key={id}
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
  )

  const closedNotice = isClosed && (
    <Alert
      data-testid="problem-closed-notice"
      className={cn(
        'shrink-0',
        // Three lines of static text cost as much as a readable results
        // band. On a short phone it scrolls inside itself instead.
        hasResults && 'short:max-h-16 short:overflow-auto',
      )}
    >
      {/* Direct child of the Alert, not of the description: `alertVariants`
          only opens the icon column for `has-[>svg]`. Neutral variant — § 5
          calls read-only information neutral, not an error. */}
      <Info />
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
  )

  // #285: only while the round is still open — a closed round already says
  // so, and its Submeter is gone. The timer is not touched.
  const isPaused = !isClosed && eventStream.submissionsPaused
  const pausedNotice = isPaused && (
    <Alert className="shrink-0" data-testid="problem-submissions-paused-banner">
      <Info />
      <AlertDescription>{t('problem.submissionsPaused.notice')}</AlertDescription>
    </Alert>
  )

  const submitBannerAlert = submitBanner && (
    <Alert
      variant="destructive"
      className="shrink-0"
      data-testid={
        'key' in submitBanner && submitBanner.key === 'problem.submitError.cooldown'
          ? 'problem-cooldown-banner'
          : 'problem-submit-error-banner'
      }
    >
      <TriangleAlert />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{'key' in submitBanner ? t(submitBanner.key) : submitBanner.message}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setSubmitBanner(null)}>
          {t('problem.submitError.dismiss')}
        </Button>
      </AlertDescription>
    </Alert>
  )

  const resultsContent = (
    <>
      {runState.status !== 'idle' && (
        <ExampleResults
          examples={examples}
          outcomes={outcomesOf(runState)}
          notice={noticeFor(runState)}
        />
      )}
      {verdict && <SubmissionResultPanel result={verdict} />}
    </>
  )

  const actionsBar = (
    <ActionsBar
      isRunning={isRunning}
      onRun={() => {
        // The run owns its own errors and settles into a state — nothing
        // here has to await it.
        void run(workspaceRef.current?.serialize() ?? {})
      }}
      onClear={() => {
        // The root block isn't offered by the toolbox (it's seeded, not
        // dragged in), so "clear" resets to it rather than to nothing — an
        // empty workspace would leave no way back in.
        workspaceRef.current?.deserialize(emptyWorkspaceState)
        clearSaved()
      }}
      isClosed={isClosed}
      isSubmitting={submit.isPending}
      isPaused={isPaused}
      onSubmit={() => void handleSubmit()}
    />
  )

  return (
    <main className="flex min-h-0 grow basis-0 flex-col gap-4 overflow-hidden p-4 md:flex-row">
      <ProblemPanels
        problem={data}
        positionLabel={problemLetter}
        hasResults={hasResults}
        closedNotice={closedNotice}
        submitBanner={
          <>
            {pausedNotice}
            {submitBannerAlert}
          </>
        }
        editor={blocklyWorkspace}
        results={hasResults ? resultsContent : undefined}
        actionsBar={actionsBar}
        resultsVersion={resultsVersion}
      />
    </main>
  )
}
