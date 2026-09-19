import { CircleCheck, CircleX, Loader } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type CaseOutcome, EXAMPLE_TIMEOUT_MS, type ExampleCase } from '@/lib/run-examples'

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
        <CardTitle className="font-display">{t('problem.results.title')}</CardTitle>
        {/* The pill of the mockup, but still the element the run specs read:
            the testid, the `data-state` and the exact `n/n casos` text are
            all part of the contract #5 and #155 wrote against. */}
        <Badge
          data-testid="problem-results-summary"
          data-state={allPassed ? 'passed' : 'failed'}
          variant={allPassed ? 'success' : 'outline'}
        >
          {t('problem.results.summary', { passed, total: examples.length })}
        </Badge>
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
              <StatusIcon outcome={outcomes[index]} />
              <span className="font-medium">
                {t('problem.results.caseLabel', { index: index + 1 })}
              </span>
              <span className="font-mono text-muted-foreground text-xs">
                <span className="sr-only">{t('problem.results.inputLabel')}: </span>
                {formatValue(example.input)}
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

/**
 * The glyphs `✓ ✗ ⋯` as real icons, each with the state in words beside it:
 * identity § 3 does not let colour be the only carrier, and an `aria-hidden`
 * icon on its own leaves a screen reader with nothing at all.
 *
 * The spinner is the one place `--warning` (pure amber) is the right token —
 * it is an icon, not text, so the 1,95:1 that rules amber out for `text-`
 * does not apply.
 */
function StatusIcon({ outcome }: { outcome: CaseOutcome | null | undefined }) {
  const { t } = useTranslation()

  if (!outcome) {
    return (
      <>
        <Loader className="size-4 shrink-0 self-center text-warning" aria-hidden="true" />
        <span className="sr-only">{t('problem.results.status.running')}</span>
      </>
    )
  }

  if (outcome.status === 'passed') {
    return (
      <>
        <CircleCheck className="size-4 shrink-0 self-center text-success" aria-hidden="true" />
        <span className="sr-only">{t('problem.results.status.passed')}</span>
      </>
    )
  }

  return (
    <>
      <CircleX className="size-4 shrink-0 self-center text-destructive" aria-hidden="true" />
      <span className="sr-only">{t('problem.results.status.failed')}</span>
    </>
  )
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
    return <span className="ml-auto text-muted-foreground">{t('problem.results.pending')}</span>
  }

  if (outcome.status === 'timeout') {
    return (
      <span className="ml-auto text-destructive">
        {t('problem.results.timeout', { seconds: timeoutMs / 1000 })}
      </span>
    )
  }

  if (outcome.status === 'error') {
    return (
      <span className="ml-auto text-destructive">
        {t('problem.results.runtimeError', { message: outcome.message })}
      </span>
    )
  }

  return (
    <span className="ml-auto font-mono text-muted-foreground text-xs">
      {t('problem.results.expected')} {formatValue(expected)} · {t('problem.results.obtained')}{' '}
      {formatValue(outcome.actual)}
    </span>
  )
}
