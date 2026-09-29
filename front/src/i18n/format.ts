const BCP47_TAG: Record<string, string> = {
  pt: 'pt-BR',
  es: 'es-MX',
  en: 'en-US',
}

function toBcp47(lang: string): string {
  return BCP47_TAG[lang] ?? lang
}

export function formatNumber(value: number, lang: string): string {
  return new Intl.NumberFormat(toBcp47(lang)).format(value)
}

export function formatDate(value: Date, lang: string): string {
  return new Intl.DateTimeFormat(toBcp47(lang)).format(value)
}

/** "A, B e C" in the viewer's language — a conjunction list (#383). */
export function formatList(values: string[], lang: string): string {
  return new Intl.ListFormat(toBcp47(lang), { type: 'conjunction' }).format(values)
}

export function formatTime(value: Date, lang: string): string {
  return new Intl.DateTimeFormat(toBcp47(lang), { hour: '2-digit', minute: '2-digit' }).format(
    value,
  )
}
