import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type CaseOutcome, EXAMPLE_TIMEOUT_MS, type ExampleCase } from '@/lib/run-examples'
import { cn } from '@/lib/utils'

/** Replaces the case list: nothing was built, or codegen refused the workspace. */
export type ExampleResultsNotice = 'empty' | { message: string }

export type ExampleResultsProps = {
  examples: readonly ExampleCase[]
  /** One entry per example, in order; `null` while the case is still running. */
  outcomes: readonly (CaseOutcome | null)[]
  notice?: ExampleResultsNotice
  timeoutMs?: number
}

/** `undefined` has no JSON form, and it is a real thing a solution can return. */
function formatValue(value: unknown): string {
  return JSON.stringify(value) ?? String(value)
}

/**
 * The run panel: pure presentation over the outcomes the runner hands back.
 *
 * It knows nothing about workers or codegen — it renders whatever slice of the
 * run has settled, which is what lets the cases fill in one by one instead of
 * appearing all at once at the end.
 */
export function ExampleResults({ examples, outcomes, notice, timeoutMs }: ExampleResultsProps) {
  const { t } = useTranslation()

  if (notice) {
    return (
      <Card data-testid="problem-results-panel" className="shrink-0 gap-0 py-4">
        <CardContent className="text-sm">
          {notice === 'empty' ? (
            <p data-testid="problem-results-empty">{t('problem.results.empty')}</p>
          ) : (
            <p data-testid="problem-results-invalid" className="text-destructive">
              {notice.message}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  const passed = outcomes.filter((outcome) => outcome?.status === 'passed').length
  const allPassed = examples.length > 0 && passed === examples.length

  return (
    <Card data-testid="problem-results-panel" className="shrink-0 gap-3 py-4">
      <CardHeader className="flex-row items-center gap-2">
        <CardTitle>{t('problem.results.title')}</CardTitle>
        <span
          data-testid="problem-results-summary"
          data-state={allPassed ? 'passed' : 'failed'}
          className={cn(
            'text-sm',
            allPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
          )}
        >
          {t('problem.results.summary', { passed, total: examples.length })}
        </span>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1 text-sm">
          {examples.map((example, index) => (
            <li
              // Examples are a fixed, ordered list for the problem — the index
              // is their identity.
              key={index}
              data-testid={`problem-result-${index}`}
              data-status={outcomes[index]?.status ?? 'pending'}
              className="flex flex-wrap items-baseline gap-x-2 rounded-md border p-2"
            >
              <span aria-hidden="true">{icon(outcomes[index])}</span>
              <span className="font-medium">
                {t('problem.results.caseLabel', { index: index + 1 })}
              </span>
              <CaseDetail
                outcome={outcomes[index]}
                expected={example.expected}
                timeoutMs={timeoutMs ?? EXAMPLE_TIMEOUT_MS}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function icon(outcome: CaseOutcome | null | undefined): string {
  if (!outcome) return '⋯'
  return outcome.status === 'passed' ? '✓' : '✗'
}

function CaseDetail({
  outcome,
  expected,
  timeoutMs,
}: {
  outcome: CaseOutcome | null | undefined
  expected: unknown
  timeoutMs: number
}) {
  const { t } = useTranslation()

  if (!outcome) {
    return <span className="text-muted-foreground">{t('problem.results.pending')}</span>
  }

  if (outcome.status === 'timeout') {
    return (
      <span className="text-destructive">
        {t('problem.results.timeout', { seconds: timeoutMs / 1000 })}
      </span>
    )
  }

  if (outcome.status === 'error') {
    return (
      <span className="text-destructive">
        {t('problem.results.runtimeError', { message: outcome.message })}
      </span>
    )
  }

  return (
    <span className="text-muted-foreground">
      {t('problem.results.expected')} {formatValue(expected)} · {t('problem.results.obtained')}{' '}
      {formatValue(outcome.actual)}
    </span>
  )
}
