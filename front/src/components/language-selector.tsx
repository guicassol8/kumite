import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

const LANGUAGES = ['pt', 'es', 'en'] as const

export function LanguageSelector() {
  const { t, i18n } = useTranslation()
  const active = i18n.resolvedLanguage ?? i18n.language

  return (
    <div
      role="group"
      aria-label={t('language.selectorLabel')}
      data-testid="language-selector"
      className="flex gap-1"
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
          onClick={() => i18n.changeLanguage(lang)}
        >
          {lang.toUpperCase()}
        </Button>
      ))}
    </div>
  )
}
