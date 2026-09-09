import type { InferResponseType } from 'hono'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

export type SubmissionResult = InferResponseType<typeof api.submissions.$post, 201>
type SubmissionResultCase = SubmissionResult['cases'][number]

export type SubmissionResultPanelProps = {
  result: SubmissionResult
}

function formatValue(value: unknown): string {
  return JSON.stringify(value) ?? String(value)
}

function icon(outcome: SubmissionResultCase['outcome']): string {
  return outcome === 'passed' ? '✓' : '✗'
}

export function SubmissionResultPanel({ result }: SubmissionResultPanelProps) {
  const { t } = useTranslation()

  return (
    <Card data-testid="problem-verdict-panel" className="shrink-0 gap-3 py-4">
      <CardHeader className="flex-row items-center gap-2">
        <CardTitle>{t('problem.verdict.title')}</CardTitle>
        <span data-testid="problem-verdict-summary" className="text-muted-foreground text-sm">
          {t('problem.verdict.summary', { score: result.score, maxScore: result.maxScore })}
        </span>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1 text-sm">
          {result.cases.map((resultCase) => (
            <li
              key={resultCase.index}
              data-testid={`problem-verdict-case-${resultCase.index}`}
              className="flex flex-wrap items-baseline gap-x-2 rounded-md border p-2"
            >
              <span aria-hidden="true">{icon(resultCase.outcome)}</span>
              <span className="font-medium">
                {t('problem.verdict.caseLabel', { index: resultCase.index + 1 })}
              </span>
              {!resultCase.hidden && <VisibleCaseDetail resultCase={resultCase} />}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function VisibleCaseDetail({
  resultCase,
}: {
  resultCase: Extract<SubmissionResultCase, { hidden: false }>
}) {
  const { t } = useTranslation()

  if (resultCase.outcome === 'timeout') {
    return <span className="text-destructive">{t('problem.verdict.timeout')}</span>
  }

  if (resultCase.outcome === 'runtime_error') {
    return (
      <span className="text-destructive">
        {t('problem.verdict.runtimeError', { detail: resultCase.detail })}
      </span>
    )
  }

  if (resultCase.outcome === 'failed') {
    return (
      <span className="text-muted-foreground">
        {t('problem.verdict.expected')} {formatValue(resultCase.expected)} ·{' '}
        {t('problem.verdict.obtained')} {formatValue(resultCase.actual)}
      </span>
    )
  }

  return null
}
