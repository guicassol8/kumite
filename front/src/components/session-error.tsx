import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { clearSession, retryHydration } from '@/lib/session'

/**
 * What the root shows instead of the route when session hydration gives up
 * (#179). The three automatic attempts already happened in silence; this is
 * the point where the user is told, and handed a way out that is not F5.
 *
 * "Sair" is the emergency exit: a token the server keeps refusing is still a
 * token, and dropping it is the one thing that gets a stuck participant back
 * to a working login screen.
 */
export function SessionErrorScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [retrying, setRetrying] = useState(false)

  async function onRetry() {
    setRetrying(true)
    try {
      await retryHydration()
    } finally {
      // On success the root swaps this screen for the route and this state is
      // gone with it; on another failure the button has to come back.
      setRetrying(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-8">
      <Card data-testid="session-error-card">
        <CardHeader>
          <CardTitle>{t('session.error.title')}</CardTitle>
          <CardDescription>{t('session.error.body')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            type="button"
            data-testid="session-error-retry"
            disabled={retrying}
            onClick={onRetry}
          >
            {retrying ? t('session.error.retrying') : t('session.error.retry')}
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="session-error-sign-out"
            onClick={() => {
              // Same pair as the header's logout: dropping the session alone
              // would hand the guarded route back to a user who no longer has
              // one, and every query on it would 401 its way to /login.
              clearSession('manual')
              navigate({ to: '/' })
            }}
          >
            {t('session.error.signOut')}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
