export type UiLocale = 'pt' | 'es' | 'en'

type ProblemTitleTranslation = { locale: UiLocale; title: string }

export function resolveProblemTitle(
  translations: ProblemTitleTranslation[],
  uiLocale: UiLocale,
): string | undefined {
  return (
    translations.find((t) => t.locale === uiLocale)?.title ??
    translations.find((t) => t.locale === 'pt')?.title
  )
}
