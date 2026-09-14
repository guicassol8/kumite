import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Bug, ChevronDown, Menu, Moon, Sun, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Lockup } from '@/components/brand/lockup'
import { BugReport } from '@/components/bug-report'
import { LanguageSelector } from '@/components/language-selector'
import { RoundCountdown } from '@/components/round-countdown'
import { Button } from '@/components/ui/button'
import { DialogTrigger } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { usePresentationMode } from '@/hooks/use-presentation-mode'
import { useRoundStream } from '@/hooks/use-round-stream'
import { useSession } from '@/hooks/use-session'
import { useTheme } from '@/hooks/use-theme'
import { fetchRounds, ROUNDS_QUERY_KEY } from '@/lib/rounds-query'
import { clearSession } from '@/lib/session'
import { cn } from '@/lib/utils'

// The live round chip: name + countdown in `brand-on-chrome`, per the
// identity's rule for anything "ao vivo" drawn on the carvão chrome (#217).
// Shared verbatim between the desktop bar and the mobile panel — same
// testid, so a test that opens the mobile panel while a round is live scopes
// its query (`within(...)`) the same way `index.test.tsx` already does for
// `round-countdown`.
function RoundChip({ className }: { className?: string }) {
  const { status } = useSession()
  const { currentRoundId, closesAt, serverTime } = useRoundStream()
  const rounds = useQuery({
    queryKey: ROUNDS_QUERY_KEY,
    queryFn: fetchRounds,
    enabled: status === 'authenticated',
  })

  if (!currentRoundId || !closesAt) return null

  const openRound = rounds.data?.find((round) => round.id === currentRoundId)
  const serverTimeOffsetMs = serverTime ? serverTime.getTime() - Date.now() : 0

  return (
    <div data-testid="header-round-chip" className={cn('flex items-center gap-2', className)}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand-on-chrome" />
      {openRound && (
        <span className="font-display text-brand-on-chrome text-sm uppercase tracking-wide">
          {openRound.name}
        </span>
      )}
      <RoundCountdown
        closesAt={closesAt}
        serverTimeOffsetMs={serverTimeOffsetMs}
        roundName={openRound?.name}
        className="font-display text-brand-on-chrome tabular-nums"
      />
    </div>
  )
}

// During the #214 epic this is the only path to dark mode (#216 fixes the
// `system` default to light) — icon-only, following the same 2px/grid-24
// treatment as the bug-report icon.
function ThemeToggle({ className, testId }: { className?: string; testId: string }) {
  const { t } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-testid={testId}
      aria-label={t(isDark ? 'header.theme.toggleToLight' : 'header.theme.toggleToDark')}
      className={cn(
        'text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground',
        className,
      )}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? (
        <Sun className="size-5" aria-hidden="true" />
      ) : (
        <Moon className="size-5" aria-hidden="true" />
      )}
    </Button>
  )
}

export function Header() {
  const { t } = useTranslation()
  const { status, user } = useSession()
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [bugReportOpen, setBugReportOpen] = useState(false)
  const isAuthenticated = status === 'authenticated' && user != null
  const isPresentation = usePresentationMode()

  if (isPresentation) return null

  function logout() {
    clearSession('manual')
    navigate({ to: '/' })
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  // Closes the sheet first: two overlays open at once would be a confusing
  // stack, and — see BugReport's own doc comment — a `<DialogTrigger>`
  // nested inside the still-open Sheet would bind to the Sheet's own
  // context instead of the bug-report dialog's.
  function openBugReportFromMobileMenu() {
    closeMobileMenu()
    setBugReportOpen(true)
  }

  return (
    <header
      data-testid="app-header"
      className="border-chrome-border border-b bg-chrome text-chrome-foreground"
    >
      <div className="flex items-center justify-between gap-4 p-4">
        <Link
          to="/"
          data-testid="header-home-link"
          aria-label={t('header.homeLink')}
          className="rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {/* Simbolo de 24px, o que da um lockup de ~80px: a excecao ao minimo
              de 96px que a Regra 3 de docs/design/logo/README.md documenta para
              o header. O SVG e aria-hidden, entao quem nomeia o link continua
              sendo o aria-label traduzido acima. currentColor puxa a cor do
              chrome (text-chrome-foreground), entao o bloco direito vira
              papel sozinho, sem variante nem prop (#217). */}
          <Lockup className="h-6 w-auto" />
        </Link>

        {/* Hydration failed, so we do not know who this is (#179). Offering
            "Entrar/Cadastrar" would claim they are signed out — they may not
            be — and the links go to screens the error card is covering
            anyway. The language selector stays: it is what lets someone read
            the error message at all. */}
        {status === 'error' ? (
          <LanguageSelector />
        ) : (
          // One Dialog.Root for both triggers below (desktop icon, mobile
          // row) — Radix supports more than one trigger per root and they
          // need not be adjacent, and this is what keeps the draft and the
          // dialog's open state shared regardless of which one opened it.
          <BugReport open={bugReportOpen} onOpenChange={setBugReportOpen}>
            <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
              {/* Desktop (>=768px, size.breakpoint-cards). A single
                `LanguageSelector` and a single mobile menu trigger sit
                outside this block (below) — jsdom renders every `hidden
                md:flex` / `md:hidden` element regardless of viewport, so a
                second copy of either would collide on its testid in both
                component tests and Playwright's testid locator, which also
                ignores CSS visibility. */}
              <div className="hidden items-center gap-4 md:flex">
                <nav className="flex items-center gap-4">
                  {isAuthenticated && user.role === 'organizer' && (
                    <Link
                      to="/organizer/problems"
                      data-testid="header-organizer-link"
                      className="text-sm"
                    >
                      {t('header.organizerLink')}
                    </Link>
                  )}
                  {isAuthenticated && (
                    <>
                      <Link to="/teams" data-testid="header-teams-link" className="text-sm">
                        {t('header.teamsLink')}
                      </Link>
                      <Link
                        to="/leaderboard"
                        data-testid="header-leaderboard-link"
                        className="text-sm"
                      >
                        {t('header.leaderboardLink')}
                      </Link>
                    </>
                  )}
                </nav>

                {isAuthenticated && <RoundChip />}

                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    data-testid="header-bug-report-trigger"
                    aria-label={t('header.reportBug')}
                    className="text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground"
                  >
                    <Bug className="size-5" aria-hidden="true" />
                  </Button>
                </DialogTrigger>

                {isAuthenticated ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        data-testid="header-user-menu-trigger"
                        className="gap-1 text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground"
                      >
                        {/* Testid kept as-is (#122): it is the identity slot, and
                          renaming it would churn every spec for no gain.
                          Accounts that predate the name column fall back to
                          the email. */}
                        <span data-testid="header-user-email" className="max-w-[200px] truncate">
                          {user.name ?? user.email}
                        </span>
                        <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
                        <span className="font-medium text-sm">{user.name ?? user.email}</span>
                        {user.name && (
                          <span className="text-muted-foreground text-xs">{user.email}</span>
                        )}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/change-password" data-testid="header-change-password-link">
                          {t('header.changePassword')}
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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

                {isAuthenticated && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="header-logout-button"
                    className="border-chrome-foreground/40 text-chrome-foreground hover:bg-chrome-foreground/10"
                    onClick={logout}
                  >
                    {t('header.logout')}
                  </Button>
                )}

                <ThemeToggle testId="header-theme-toggle" />
              </div>

              {/* Always visible: the language selector is the one preference
                that must be reachable without opening any menu, in every
                width (Acceptance). */}
              <LanguageSelector />

              {/* Mobile (<768px) menu trigger + panel */}
              <div className="md:hidden">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      data-testid="header-mobile-menu-trigger"
                      aria-label={t(mobileMenuOpen ? 'header.menu.close' : 'header.menu.open')}
                      className="text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground"
                    >
                      {mobileMenuOpen ? (
                        <X className="size-5" aria-hidden="true" />
                      ) : (
                        <Menu className="size-5" aria-hidden="true" />
                      )}
                    </Button>
                  </SheetTrigger>

                  <SheetContent
                    side="right"
                    showCloseButton={false}
                    className="w-full gap-0 border-chrome-border bg-chrome p-0 text-chrome-foreground sm:max-w-full"
                  >
                    <SheetTitle className="sr-only">{t('header.menu.title')}</SheetTitle>
                    <SheetDescription className="sr-only">
                      {t('header.menu.title')}
                    </SheetDescription>

                    <div className="flex flex-col gap-4 overflow-y-auto p-4">
                      {isAuthenticated && (
                        <div
                          data-testid="header-mobile-user-block"
                          className="flex flex-col gap-0.5 border-chrome-border border-b pb-4"
                        >
                          <span className="font-medium text-sm">{user.name ?? user.email}</span>
                          {user.name && (
                            <span className="text-chrome-muted text-xs">{user.email}</span>
                          )}
                        </div>
                      )}

                      {isAuthenticated && (
                        <RoundChip className="border-chrome-border border-b pb-4" />
                      )}

                      <nav className="flex flex-col gap-1">
                        {isAuthenticated ? (
                          <>
                            <Link
                              to="/"
                              data-testid="header-mobile-home-link"
                              className="py-2 text-sm"
                              onClick={closeMobileMenu}
                            >
                              {t('header.nav.home')}
                            </Link>
                            {user.role === 'organizer' && (
                              <Link
                                to="/organizer/problems"
                                data-testid="header-organizer-link"
                                className="py-2 text-sm"
                                onClick={closeMobileMenu}
                              >
                                {t('header.organizerLink')}
                              </Link>
                            )}
                            <Link
                              to="/teams"
                              data-testid="header-teams-link"
                              className="py-2 text-sm"
                              onClick={closeMobileMenu}
                            >
                              {t('header.teamsLink')}
                            </Link>
                            <Link
                              to="/leaderboard"
                              data-testid="header-leaderboard-link"
                              className="py-2 text-sm"
                              onClick={closeMobileMenu}
                            >
                              {t('header.leaderboardLink')}
                            </Link>
                            <Link
                              to="/change-password"
                              data-testid="header-change-password-link"
                              className="py-2 text-sm"
                              onClick={closeMobileMenu}
                            >
                              {t('header.changePassword')}
                            </Link>
                          </>
                        ) : (
                          <>
                            <Link
                              to="/login"
                              data-testid="header-login-link"
                              className="py-2 text-sm"
                              onClick={closeMobileMenu}
                            >
                              {t('header.login')}
                            </Link>
                            <Link
                              to="/signup"
                              data-testid="header-signup-link"
                              className="py-2 text-sm"
                              onClick={closeMobileMenu}
                            >
                              {t('header.signup')}
                            </Link>
                          </>
                        )}
                      </nav>

                      <div className="flex items-center justify-between border-chrome-border border-t pt-4">
                        <span className="text-sm">{t('header.theme.label')}</span>
                        <Switch
                          data-testid="header-mobile-theme-toggle"
                          checked={resolvedTheme === 'dark'}
                          onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                          aria-label={t('header.theme.label')}
                        />
                      </div>

                      <button
                        type="button"
                        data-testid="header-mobile-bug-report-trigger"
                        className="flex items-center gap-2 py-2 text-left text-sm"
                        onClick={openBugReportFromMobileMenu}
                      >
                        <Bug className="size-4" aria-hidden="true" />
                        {t('header.reportBug')}
                      </button>

                      {isAuthenticated && (
                        <Button
                          type="button"
                          variant="outline"
                          data-testid="header-mobile-logout-button"
                          className="border-chrome-foreground/40 text-chrome-foreground hover:bg-chrome-foreground/10"
                          onClick={() => {
                            closeMobileMenu()
                            logout()
                          }}
                        >
                          {t('header.logout')}
                        </Button>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </BugReport>
        )}
      </div>
    </header>
  )
}
