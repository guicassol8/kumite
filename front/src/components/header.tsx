import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Lockup } from '@/components/brand/lockup'
import { LanguageSelector } from '@/components/language-selector'
import { Button } from '@/components/ui/button'
import { useSession } from '@/hooks/use-session'
import { clearSession } from '@/lib/session'

export function Header() {
  const { t } = useTranslation()
  const { status, user } = useSession()
  const navigate = useNavigate()

  return (
    <header data-testid="app-header" className="flex items-center justify-between border-b p-4">
      <Link
        to="/"
        data-testid="header-home-link"
        aria-label={t('header.homeLink')}
        className="rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {/* Simbolo de 24px, o que da um lockup de ~80px: a excecao ao minimo
            de 96px que a Regra 3 de docs/design/logo/README.md documenta para
            o header. O SVG e aria-hidden, entao quem nomeia o link continua
            sendo o aria-label traduzido acima. */}
        <Lockup className="h-6 w-auto" />
      </Link>
      <div className="flex items-center gap-4">
        {/* Hydration failed, so we do not know who this is (#179). Offering
            "Entrar/Cadastrar" would claim they are signed out — they may not
            be — and the links go to screens the error card is covering
            anyway. The language selector stays: it is what lets someone read
            the error message at all. */}
        {status === 'error' ? null : status === 'authenticated' && user ? (
          <>
            {user.role === 'organizer' && (
              <Link
                to="/organizer/problems"
                data-testid="header-organizer-link"
                className="text-sm"
              >
                {t('header.organizerLink')}
              </Link>
            )}
            <Link to="/teams" data-testid="header-teams-link" className="text-sm">
              {t('header.teamsLink')}
            </Link>
            <Link to="/leaderboard" data-testid="header-leaderboard-link" className="text-sm">
              {t('header.leaderboardLink')}
            </Link>
            <Link
              to="/change-password"
              data-testid="header-change-password-link"
              className="text-sm"
            >
              {t('header.changePassword')}
            </Link>
            {/* Testid kept as-is (#122): it is the identity slot, and renaming
                it would churn every spec for no gain. Accounts that predate
                the name column fall back to the email. */}
            <span data-testid="header-user-email" className="text-muted-foreground text-sm">
              {user.name ?? user.email}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="header-logout-button"
              onClick={() => {
                clearSession('manual')
                navigate({ to: '/' })
              }}
            >
              {t('header.logout')}
            </Button>
          </>
        ) : (
          <>
            <Link to="/login" data-testid="header-login-link" className="text-sm">
              {t('header.login')}
            </Link>
            <Link to="/signup" data-testid="header-signup-link" className="text-sm">
              {t('header.signup')}
            </Link>
          </>
        )}
        <LanguageSelector />
      </div>
    </header>
  )
}
