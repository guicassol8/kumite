import type { ErrorComponentProps } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * What TanStack Router shows for an uncaught render error
 * (`defaultErrorComponent`, #230). The error never reaches the screen in any
 * environment — Acceptance is explicit about not exposing the stack to a
 * participant — so console.error is the only place it goes. Do not "improve"
 * this by surfacing error.message: that is the one thing this component
 * exists to withhold.
 */
export function RouteErrorScreen({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-8">
      <Card data-testid="route-error-card">
        <CardHeader>
          <CardTitle>{t('shell.error.title')}</CardTitle>
          <CardDescription>{t('shell.error.body')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button type="button" data-testid="route-error-retry" onClick={() => reset()}>
            {t('shell.error.retry')}
          </Button>
          <Button asChild variant="outline">
            <Link to="/" data-testid="route-error-home-link">
              {t('shell.error.home')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
