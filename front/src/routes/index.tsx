import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ notice: z.enum(['forbidden-organizer']).optional() }).parse(search),
  component: Home,
})

// Terraform proof page: exercises the typed RPC client end to end. `res.json()`
// below is typed straight from the back's HealthSchema — no codegen involved.
function Home() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const { notice } = Route.useSearch()
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.health.$get()
      if (!res.ok) throw new Error('health check failed')
      return res.json()
    },
  })

  return (
    <main className="mx-auto flex flex-1 max-w-xl flex-col items-center justify-center gap-6 p-8">
      {notice === 'forbidden-organizer' && (
        <Alert variant="destructive" data-testid="home-notice-banner" className="w-full">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{t('home.notices.forbiddenOrganizer')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="home-notice-dismiss"
              onClick={() => navigate({ to: '/', search: {}, replace: true })}
            >
              {t('home.notices.dismiss')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <h1 className="font-bold text-4xl tracking-tight">kumite</h1>
      <p className="text-muted-foreground">{t('home.tagline')}</p>
      <Card className="w-full" data-testid="api-status">
        <CardHeader>
          <CardTitle>{t('home.apiStatus')}</CardTitle>
        </CardHeader>
        <CardContent>
          {health.isPending && <span data-testid="api-status-loading">{t('home.checking')}</span>}
          {health.isError && <span data-testid="api-status-error">{t('home.apiDown')}</span>}
          {health.data && (
            <span data-testid="api-status-ok">
              {t('home.apiOk', { status: health.data.status })}
            </span>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
