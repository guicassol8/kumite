import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

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
      <span className="font-bold text-xl tracking-tight">kumite</span>
      <div className="flex items-center gap-4">
        {status === 'authenticated' && user ? (
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
            <span data-testid="header-user-email" className="text-muted-foreground text-sm">
              {user.email}
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
