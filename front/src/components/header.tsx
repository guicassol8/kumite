import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Bug, ChevronDown, Menu, Moon, Sun, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Lockup } from '@/components/brand/lockup'
import { BugReport } from '@/components/bug-report'
import { LanguageSelector } from '@/components/language-selector'
import { useTour } from '@/components/onboarding/tour-provider'
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
//
// `nameClassName` is how the two callers differ (#297): the round name is
// free text an organizer typed, with no ceiling but the 120-char column, and
// on the desktop bar between 768 and 1023px there is simply no room for it —
// so the bar hides it there and shows it again from `lg` up, while the mobile
// panel, which has a whole column to itself, always shows it. The dot and the
// timer — identity § 5's "ao vivo" role — stay at every width.
function RoundChip({ className, nameClassName }: { className?: string; nameClassName?: string }) {
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
    // `shrink-0`, deliberately: the chip used to be the only flexible item
    // left on the compressed bar, so flexbox paid for English by squeezing it
    // to zero width — the page then measured a perfect 768 with no live round
    // visible at all. Everything on the bar is now fixed except the user's
    // name, which § 5 already says truncates; an inventory item may never buy
    // the width by disappearing (#297).
    <div
      data-testid="header-round-chip"
      className={cn('flex shrink-0 items-center gap-2', className)}
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand-on-chrome" />
      {openRound && (
        <span
          data-testid="header-round-name"
          className={cn(
            'truncate font-display text-brand-on-chrome text-sm uppercase tracking-wide',
            nameClassName,
          )}
        >
          {openRound.name}
        </span>
      )}
      {/* `bare`: identity § 5 describes the chip as "ponto + nome da rodada +
          timer", and the live-timer role as a numeral in Barlow Condensed —
          not the sentence "Termina em 41:23", which is the home card's
          wording and costs the bar ~70px it does not have. The full sentence
          is still announced: `round-countdown-summary` (sr-only) carries it
          verbatim, so nothing is lost to a screen reader. */}
      <RoundCountdown
        bare
        closesAt={closesAt}
        serverTimeOffsetMs={serverTimeOffsetMs}
        roundName={openRound?.name}
        className="shrink-0 font-display text-brand-on-chrome tabular-nums"
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
  const { startTour } = useTour()

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

  // Same reasoning: the sheet closes first, so the tour's popover is not
  // stacked on top of (or anchored behind) a full-width panel.
  function startTourFromMobileMenu() {
    closeMobileMenu()
    startTour()
  }

  return (
    <header
      data-testid="app-header"
      className="border-chrome-border border-b bg-chrome text-chrome-foreground"
    >
      <div className="flex items-center justify-between gap-2 p-4 xl:gap-4">
        <Link
          to="/"
          data-testid="header-home-link"
          aria-label={t('header.homeLink')}
          className="shrink-0 rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
            {/* `min-w-0` is this fix's load-bearing class (#297): without it a
                flex item's `min-width` resolves to `auto`, i.e. to the
                min-content width of everything inside it — the block then
                refuses to shrink and pushes the document instead of
                compressing, which is why the symptom was the page's
                `scrollWidth` rather than a truncated label. */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 xl:gap-4">
              {/* Desktop (>=768px, size.breakpoint-cards). A single
                `LanguageSelector` and a single mobile menu trigger sit
                outside this block (below) — jsdom renders every `hidden
                md:flex` / `md:hidden` element regardless of viewport, so a
                second copy of either would collide on its testid in both
                component tests and Playwright's testid locator, which also
                ignores CSS visibility. */}
              {/* From 768px up the bar carries the whole closed inventory of
                  § 5 with up to ~500px less room than at 1280, so it stays
                  compressed — gap-2, tighter control padding, a shorter clamp
                  on the user name — all the way to `xl`, and only then goes
                  back to its roomy spacing. The round name returns earlier, at
                  `lg`, and this compression is precisely what pays for it
                  there: at 1024 the bar has 256px more than at 768 but has to
                  find room for a name of up to 240px.

                  Sized by English, not Portuguese — identity § 5, Expansão de
                  texto: "Leaderboard" is 78px where "Placar" is 44, and the
                  worst measured case was en with a round open (985px in a
                  768px viewport, #297). */}
              <div className="hidden min-w-0 items-center gap-2 md:flex xl:gap-4">
                <nav className="flex shrink-0 items-center gap-2 xl:gap-4">
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
                      {/* #211: with or without a round open — practice
                          matters most exactly when none is. */}
                      <Link to="/practice" data-testid="header-practice-link" className="text-sm">
                        {t('header.practiceLink')}
                      </Link>
                    </>
                  )}
                </nav>

                {isAuthenticated && <RoundChip nameClassName="hidden max-w-60 lg:block" />}

                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    data-testid="header-bug-report-trigger"
                    aria-label={t('header.reportBug')}
                    className="shrink-0 text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground"
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
                        className="min-w-0 gap-1 px-2 text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground xl:px-4"
                      >
                        {/* Testid kept as-is (#122): it is the identity slot, and
                          renaming it would churn every spec for no gain.
                          Accounts that predate the name column fall back to
                          the email. */}
                        {/* § 5 already prescribes a truncated name here, which
                          makes this clamp the one elastic thing left on the
                          bar: 80px while the bar is compressed, the original
                          200px once it is roomy again. */}
                        <span
                          data-testid="header-user-email"
                          className="max-w-20 truncate xl:max-w-50"
                        >
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
                      {/* #213: the tour's permanent control, and the page
                          behind it. In the menu, not on the bar — the bar's
                          width budget is spent (#297). */}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/how-it-works" data-testid="header-how-it-works-link">
                          {t('header.howItWorks')}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem data-testid="header-start-tour" onSelect={startTour}>
                        {t('header.startTour')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <>
                    <Link
                      to="/how-it-works"
                      data-testid="header-how-it-works-link"
                      className="shrink-0 text-sm"
                    >
                      {t('header.howItWorks')}
                    </Link>
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
                    // `bg-transparent` and `hover:text-chrome-foreground` are
                    // here to neutralize `bg-background` and
                    // `hover:text-accent-foreground` from the `outline`
                    // variant (#271). tailwind-merge only drops a variant
                    // class when the caller passes its counterpart, and this
                    // button passed neither — so the paper surface and the ink
                    // hover label survived onto the charcoal chrome (1.0814:1
                    // at rest, 1.3062:1 on hover, in the light theme). The dark
                    // theme read 16.9:1 and 13.9:1 even with the defect in,
                    // because there `--accent-foreground` happens to be the
                    // same paper as `--chrome-foreground`.
                    className="shrink-0 border-chrome-foreground/40 bg-transparent px-2 text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground xl:px-3"
                    onClick={logout}
                  >
                    {t('header.logout')}
                  </Button>
                )}

                <ThemeToggle testId="header-theme-toggle" className="shrink-0" />
              </div>

              {/* Always visible: the language selector is the one preference
                that must be reachable without opening any menu, in every
                width (Acceptance). */}
              <LanguageSelector />

              {/* Mobile (<768px) menu trigger + panel */}
              <div className="shrink-0 md:hidden">
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
                              to="/practice"
                              data-testid="header-practice-link"
                              className="py-2 text-sm"
                              onClick={closeMobileMenu}
                            >
                              {t('header.practiceLink')}
                            </Link>
                            <Link
                              to="/change-password"
                              data-testid="header-change-password-link"
                              className="py-2 text-sm"
                              onClick={closeMobileMenu}
                            >
                              {t('header.changePassword')}
                            </Link>
                            <Link
                              to="/how-it-works"
                              data-testid="header-how-it-works-link"
                              className="py-2 text-sm"
                              onClick={closeMobileMenu}
                            >
                              {t('header.howItWorks')}
                            </Link>
                            <button
                              type="button"
                              data-testid="header-start-tour"
                              className="py-2 text-left text-sm"
                              onClick={startTourFromMobileMenu}
                            >
                              {t('header.startTour')}
                            </button>
                          </>
                        ) : (
                          <>
                            <Link
                              to="/how-it-works"
                              data-testid="header-how-it-works-link"
                              className="py-2 text-sm"
                              onClick={closeMobileMenu}
                            >
                              {t('header.howItWorks')}
                            </Link>
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
                          // Same neutralization as the desktop button above
                          // (#271): this is the same Sair, inside a
                          // `bg-chrome` sheet, with the same defect.
                          className="border-chrome-foreground/40 bg-transparent text-chrome-foreground hover:bg-chrome-foreground/10 hover:text-chrome-foreground"
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
