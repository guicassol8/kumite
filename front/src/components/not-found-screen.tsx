import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * What TanStack Router shows for a URL that matches no route
 * (`defaultNotFoundComponent`, #230). Same card shell as `SessionErrorScreen`
 * — header and footer stay in place because this only fills the `Outlet`.
 */
export function NotFoundScreen() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-8">
      <Card data-testid="not-found-card">
        <CardHeader>
          <CardTitle>{t('shell.notFound.title')}</CardTitle>
          <CardDescription>{t('shell.notFound.body')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/" data-testid="not-found-home-link">
              {t('shell.notFound.home')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
