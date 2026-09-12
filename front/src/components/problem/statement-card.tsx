import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { fetchProblem } from '@/lib/problems-query'
import { cn } from '@/lib/utils'

type Problem = Awaited<ReturnType<typeof fetchProblem>>

export type StatementCardProps = {
  problem: Problem
  hasResults: boolean
  className?: string
}

/** The problem statement and its examples — extracted verbatim from `/problem/$id` (#203). */
export function StatementCard({ problem, hasResults, className }: StatementCardProps) {
  const { t } = useTranslation()

  return (
    <Card
      data-testid="problem-statement-panel"
      aria-label={t('problem.statementLabel')}
      className={cn(
        'overflow-auto md:max-h-none md:w-96 md:shrink-0',
        // Stacked layout only: the side column on md+ owns a whole column
        // and never competes with the band for height. On a short phone it
        // gives up a second slice, because the band has nowhere else to
        // take height from.
        hasResults ? 'max-h-36 short:max-h-20' : 'max-h-64',
        className,
      )}
    >
      <CardHeader>
        <CardTitle>{problem.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>{problem.statementMd}</p>
        <div>
          <h2 className="mb-2 font-semibold">{t('problem.examplesHeading')}</h2>
          <ul className="flex flex-col gap-2">
            {problem.examples.map((example, index) => (
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
  )
}
