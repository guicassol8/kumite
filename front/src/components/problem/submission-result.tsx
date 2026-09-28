import type { InferResponseType } from 'hono'
import { CircleCheck, CircleX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/lib/api'

export type SubmissionResult = InferResponseType<typeof api.submissions.$post, 201>
type SubmissionResultCase = SubmissionResult['cases'][number]

export type SubmissionResultPanelProps = {
  result: SubmissionResult
}

function formatValue(value: unknown): string {
  return JSON.stringify(value) ?? String(value)
}

/**
 * There is no verdict field on the wire — `SubmissionResultSchema` carries
 * `score`, `maxScore`, `cases` and the attempt numbers. "Approved" is a full
 * score, the same notion of a clean sweep the scoreboard uses: the score is
 * rated over the HIDDEN cases only, so counting the verdict's visible cases
 * instead would call a submission approved while a hidden case failed next to
 * the score saying otherwise. `maxScore > 0` keeps a problem worth no points
 * from reading as approved on 0/0.
 */
function isApproved(result: SubmissionResult): boolean {
  return result.score === result.maxScore && result.maxScore > 0
}

export function SubmissionResultPanel({ result }: SubmissionResultPanelProps) {
  const { t } = useTranslation()
  const approved = isApproved(result)

  return (
    // Identity § 5: an alert is a card with a semantic border, an icon and
    // text — green for success, crimson OUTLINE for failure, never a filled
    // red plate. The icon has to be an immediate child: `alertVariants` opens
    // the icon column with `has-[>svg]`, and one nested inside the description
    // leaves the title hanging over an empty gutter.
    <Alert
      data-testid="problem-verdict-panel"
      data-state={approved ? 'passed' : 'failed'}
      variant={approved ? 'success' : 'destructive'}
      className="shrink-0"
    >
      {approved ? <CircleCheck /> : <CircleX />}
      <AlertTitle>
        {t(approved ? 'problem.verdict.approved' : 'problem.verdict.rejected')}
      </AlertTitle>
      <AlertDescription className="w-full">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span data-testid="problem-verdict-summary" className="font-medium tabular-nums">
            {t('problem.verdict.summary', { score: result.score, maxScore: result.maxScore })}
          </span>
          {/* The round's count (#280), not the global attemptNumber: a problem
              reused across rounds must read the same number here as in that
              round's ranking and on the problem page. */}
          <span data-testid="problem-verdict-attempt" className="text-sm tabular-nums">
            {t('problem.verdict.attempt', { attempt: result.attemptInRound })}
          </span>
        </div>
        <ul className="flex w-full flex-col gap-1 text-sm">
          {result.cases.map((resultCase) => (
            <li
              key={resultCase.index}
              data-testid={`problem-verdict-case-${resultCase.index}`}
              data-status={resultCase.outcome}
              className="flex w-full flex-wrap items-baseline gap-x-2 rounded-md border p-2"
            >
              <CaseIcon outcome={resultCase.outcome} />
              <span className="font-medium">
                {t('problem.verdict.caseLabel', { index: resultCase.index + 1 })}
              </span>
              {!resultCase.hidden && <VisibleCaseDetail resultCase={resultCase} />}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Same treatment as the run band: an icon that is `aria-hidden` plus the
 * outcome in words, because identity § 3 does not let colour carry a state on
 * its own. Its own colour rather than the alert's — a rejected verdict still
 * has cases that passed, and they should not all read crimson.
 */
function CaseIcon({ outcome }: { outcome: SubmissionResultCase['outcome'] }) {
  const { t } = useTranslation()
  const passed = outcome === 'passed'

  return (
    <>
      {passed ? (
        <CircleCheck className="size-4 shrink-0 self-center text-success" aria-hidden="true" />
      ) : (
        <CircleX className="size-4 shrink-0 self-center text-destructive" aria-hidden="true" />
      )}
      <span className="sr-only">{t(`problem.verdict.status.${passed ? 'passed' : 'failed'}`)}</span>
    </>
  )
}

function VisibleCaseDetail({
  resultCase,
}: {
  resultCase: Extract<SubmissionResultCase, { hidden: false }>
}) {
  const { t } = useTranslation()

  if (resultCase.outcome === 'timeout') {
    return <span className="ml-auto">{t('problem.verdict.timeout')}</span>
  }

  if (resultCase.outcome === 'runtime_error') {
    return (
      <span className="ml-auto">
        {t('problem.verdict.runtimeError', { detail: resultCase.detail })}
      </span>
    )
  }

  if (resultCase.outcome === 'failed') {
    return (
      <span className="ml-auto font-mono text-xs">
        {t('problem.verdict.expected')} {formatValue(resultCase.expected)} ·{' '}
        {t('problem.verdict.obtained')} {formatValue(resultCase.actual)}
      </span>
    )
  }

  return null
}
