import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Mark } from '@/components/brand/mark'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// The address itself is never translated — only the label around it.
const CONTACT_EMAIL = 'ligadealgoritmos@gmail.com'

// Same wording in pt/es/en, so it is a literal like CONTACT_EMAIL, not a
// translation key.
const EVENT_LABEL = 'PUCRS × Mérida 2026'

type ApiStatus = 'connected' | 'error' | 'connecting'

// Dot + short label (identity §5): color alone is never the only cue.
const STATUS_DOT_CLASS: Record<ApiStatus, string> = {
  connected: 'bg-success',
  error: 'bg-destructive',
  connecting: 'bg-chrome-muted',
}

function ApiStatusIndicator() {
  const { t } = useTranslation()
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.health.$get()
      if (!res.ok) throw new Error('health check failed')
      return res.json()
    },
  })

  const status: ApiStatus = health.isPending ? 'connecting' : health.isError ? 'error' : 'connected'
  const testId =
    status === 'connecting'
      ? 'api-status-loading'
      : status === 'error'
        ? 'api-status-error'
        : 'api-status-ok'

  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn('size-2 shrink-0 rounded-full', STATUS_DOT_CLASS[status])}
      />
      <span data-testid={testId} className="text-sm">
        {t(`footer.status.${status}`)}
      </span>
    </div>
  )
}

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer
      data-testid="app-footer"
      className="border-chrome-border border-t bg-chrome p-4 text-chrome-foreground"
    >
      <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:justify-between md:text-left">
        <p className="text-sm">
          {t('footer.contactLabel')}{' '}
          <a
            data-testid="footer-contact-email"
            href={`mailto:${CONTACT_EMAIL}`}
            className="underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>

        <ApiStatusIndicator />

        <div className="flex items-center gap-2">
          <Mark className="h-4 w-auto" />
          <span className="font-display text-sm uppercase tracking-wide">{EVENT_LABEL}</span>
        </div>
      </div>
    </footer>
  )
}
