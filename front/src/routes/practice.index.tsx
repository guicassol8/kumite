import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DIFFICULTY_BADGE_STYLE } from '@/lib/difficulty-badge'
import { fetchPracticeProblems, practiceProblemsQueryKey } from '@/lib/problems-query'
import { requireAuth } from '@/lib/route-guards'

// The practice catalog (#211): any authenticated participant, team or not,
// with or without a round — practice lives outside the competition.
export const Route = createFileRoute('/practice/')({
  beforeLoad: requireAuth,
  component: PracticeListScreen,
})

function toApiLocale(language: string): 'pt' | 'es' | 'en' {
  return language === 'es' || language === 'en' ? language : 'pt'
}

function PracticeListScreen() {
  const { t, i18n } = useTranslation()
  const locale = toApiLocale(i18n.resolvedLanguage ?? i18n.language)

  const problems = useQuery({
    queryKey: practiceProblemsQueryKey(locale),
    queryFn: () => fetchPracticeProblems(locale),
  })

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col items-start gap-4 p-4 md:p-8">
      <div className="flex w-full flex-col gap-1">
        <h1 className="font-bold font-display text-4xl">{t('practice.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('practice.intro')}</p>
      </div>

      {problems.isError ? (
        <Alert variant="destructive" data-testid="practice-load-error">
          <TriangleAlert />
          <AlertDescription className="flex flex-col items-start gap-2">
            <p>{t('practice.loadError')}</p>
            <Button
              type="button"
              variant="outline"
              data-testid="practice-load-retry"
              onClick={() => problems.refetch()}
            >
              {t('practice.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : problems.isPending ? (
        <div data-testid="practice-loading" className="flex w-full flex-col gap-3">
          <p className="text-muted-foreground text-sm">{t('practice.loading')}</p>
          <div className="h-14 w-full animate-pulse rounded-md bg-background-2" />
          <div className="h-14 w-full animate-pulse rounded-md bg-background-2" />
        </div>
      ) : problems.data.length === 0 ? (
        <div
          data-testid="practice-empty"
          className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border p-10 text-center"
        >
          <p className="text-muted-foreground text-sm">{t('practice.empty')}</p>
        </div>
      ) : (
        // The back already orders it (difficulty → creation → id, #209).
        <ul data-testid="practice-list" className="flex w-full flex-col gap-3 md:gap-0">
          {problems.data.map((problem) => {
            const difficulty = DIFFICULTY_BADGE_STYLE[problem.difficulty]
            return (
              <li
                key={problem.id}
                data-testid={`practice-problem-${problem.id}`}
                className="relative flex items-center justify-between gap-4 rounded-xl border p-4 md:rounded-none md:border-x-0 md:border-t-0 md:p-3"
              >
                <Link
                  to="/practice/$id"
                  params={{ id: problem.id }}
                  data-testid={`practice-problem-link-${problem.id}`}
                  aria-label={t('practice.openProblem', { title: problem.title })}
                  // The whole row is the target, as on /rounds/$id.
                  className="min-w-0 truncate font-medium after:absolute after:inset-0"
                >
                  {problem.title}
                </Link>
                <Badge variant={difficulty.variant} className={difficulty.className}>
                  {t(`problem.difficulty.${problem.difficulty}`)}
                </Badge>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
