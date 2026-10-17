import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

const LANGUAGES = ['pt', 'es', 'en'] as const

// Identity § 5 calls this "controle segmentado de idioma (PT · ES · EN)", and
// a segmented control is what it now is: one hairline group with the three
// options joined inside it, instead of three loose 41px buttons separated by
// a 4px gap. That is also ~30px of the width the header did not have at 768px
// (#297) — the group is the widest fixed-cost item on the bar, and it is the
// one thing that may never move into a menu (§ 5: language stays reachable at
// every width, signed out included).
export function LanguageSelector() {
  const { t, i18n } = useTranslation()
  const active = i18n.resolvedLanguage ?? i18n.language

  return (
    <div
      role="group"
      aria-label={t('language.selectorLabel')}
      data-testid="language-selector"
      className="flex shrink-0 items-center overflow-hidden rounded-md border border-chrome-foreground/25"
    >
      {LANGUAGES.map((lang) => (
        <Button
          key={lang}
          type="button"
          size="sm"
          variant={active === lang ? 'secondary' : 'ghost'}
          aria-current={active === lang}
          aria-label={t(`language.${lang}`)}
          title={t(`language.${lang}`)}
          data-testid={`language-option-${lang}`}
          // The corners belong to the group, not to each option, and the
          // segments are divided by a hairline rather than by a gap.
          className="rounded-none border-chrome-foreground/25 border-l px-1.5 first:border-l-0 xl:px-2"
          onClick={() => i18n.changeLanguage(lang)}
        >
          {lang.toUpperCase()}
        </Button>
      ))}
    </div>
  )
}
