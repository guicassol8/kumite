import type { UiLocale } from './resolve-problem-title'

export const FORM_LOCALES = ['pt', 'es', 'en'] as const

export type Difficulty = 'easy' | 'medium' | 'hard'
export type ProblemStatus = 'draft' | 'published' | 'archived'

export type TranslationEntry = { title: string; statementMd: string }

/** Mirrors the back's `JsonValueSchema` — a test case's `input`/`expected`. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/**
 * `input`/`expected` are kept as *text*, not parsed values: the organizer has
 * to be able to type a half-finished `[1,` without the form throwing the
 * keystrokes away. Parsing happens on blur and again in `buildPatchBody`.
 */
export type TestCaseRow = { input: string; expected: string; hidden: boolean }

export type ProblemFormValues = {
  difficulty: Difficulty
  points: number
  translations: Record<UiLocale, TranslationEntry>
  testCases: TestCaseRow[]
}

/** The subset of the API's `ProblemDetail` this module needs. */
export type ProblemFormSource = {
  difficulty: Difficulty
  points: number
  testCases: { input: JsonValue; expected: JsonValue; hidden: boolean }[]
  translations: { locale: UiLocale; title: string; statementMd: string }[]
}

export type PatchBody = {
  difficulty: Difficulty
  points: number
  testCases: { input: JsonValue; expected: JsonValue; hidden: boolean }[]
  translations: { locale: UiLocale; title: string; statementMd: string }[]
}

export type JsonFieldName = 'input' | 'expected'

export type ProblemFormError =
  | { kind: 'pointsInvalid' }
  | { kind: 'translationIncomplete'; locale: UiLocale; field: keyof TranslationEntry }
  | { kind: 'translationCannotBeCleared'; locale: UiLocale; field: keyof TranslationEntry }
  | { kind: 'json'; reason: 'empty' | 'invalid'; index: number; field: JsonFieldName }
  | { kind: 'publishMissingLocale'; locale: UiLocale; field: keyof TranslationEntry }
  | { kind: 'publishMissingVisibleCase' }
  | { kind: 'publishMissingHiddenCase' }

export const DEFAULT_POINTS = 100

export function emptyProblemFormValues(): ProblemFormValues {
  return {
    difficulty: 'easy',
    points: DEFAULT_POINTS,
    translations: {
      pt: { title: '', statementMd: '' },
      es: { title: '', statementMd: '' },
      en: { title: '', statementMd: '' },
    },
    testCases: [],
  }
}

export function emptyTestCaseRow(): TestCaseRow {
  return { input: '', expected: '', hidden: false }
}

export function problemDetailToFormValues(detail: ProblemFormSource): ProblemFormValues {
  const values = emptyProblemFormValues()
  values.difficulty = detail.difficulty
  values.points = detail.points
  for (const translation of detail.translations) {
    values.translations[translation.locale] = {
      title: translation.title,
      statementMd: translation.statementMd,
    }
  }
  values.testCases = detail.testCases.map((testCase) => ({
    input: JSON.stringify(testCase.input),
    expected: JSON.stringify(testCase.expected),
    hidden: testCase.hidden,
  }))
  return values
}

/**
 * Which locales the API already stores. Clearing one of these is refused by
 * `validateForSave`: the PATCH upserts translations and has no delete, so an
 * emptied tab would silently keep the old text in the database.
 */
export function savedLocalesOf(detail: ProblemFormSource): UiLocale[] {
  return FORM_LOCALES.filter((locale) => detail.translations.some((t) => t.locale === locale))
}

export type ParsedJsonField =
  | { ok: true; value: JsonValue }
  | { ok: false; reason: 'empty' | 'invalid' }

export function parseJsonField(text: string): ParsedJsonField {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: false, reason: 'empty' }
  try {
    return { ok: true, value: JSON.parse(trimmed) as JsonValue }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

export function localeState(entry: TranslationEntry): 'empty' | 'complete' | 'partial' {
  const hasTitle = entry.title.trim() !== ''
  const hasStatement = entry.statementMd.trim() !== ''
  if (hasTitle && hasStatement) return 'complete'
  if (!hasTitle && !hasStatement) return 'empty'
  return 'partial'
}

export function validateForSave(
  values: ProblemFormValues,
  savedLocales: UiLocale[],
): ProblemFormError[] {
  const errors: ProblemFormError[] = []

  // An emptied number input hands back NaN; the API takes a positive integer
  // (`z.number().int().positive()`), so it is caught here rather than as a
  // form-level "could not save" with nothing pointing at the field.
  if (!Number.isInteger(values.points) || values.points <= 0) {
    errors.push({ kind: 'pointsInvalid' })
  }

  for (const locale of FORM_LOCALES) {
    const entry = values.translations[locale]
    const state = localeState(entry)
    if (state === 'partial') {
      errors.push({
        kind: 'translationIncomplete',
        locale,
        field: entry.title.trim() === '' ? 'title' : 'statementMd',
      })
    } else if (state === 'empty' && savedLocales.includes(locale)) {
      errors.push({ kind: 'translationCannotBeCleared', locale, field: 'title' })
    }
  }

  values.testCases.forEach((testCase, index) => {
    for (const field of ['input', 'expected'] as const) {
      const parsed = parseJsonField(testCase[field])
      if (!parsed.ok) errors.push({ kind: 'json', reason: parsed.reason, index, field })
    }
  })

  return errors
}

export function validateForPublish(
  values: ProblemFormValues,
  savedLocales: UiLocale[],
): ProblemFormError[] {
  const errors = validateForSave(values, savedLocales)

  for (const locale of FORM_LOCALES) {
    // A partial locale is already reported by validateForSave — flagging it
    // twice would put two messages on the same field.
    if (localeState(values.translations[locale]) === 'empty') {
      errors.push({ kind: 'publishMissingLocale', locale, field: 'title' })
    }
  }

  if (!values.testCases.some((testCase) => !testCase.hidden)) {
    errors.push({ kind: 'publishMissingVisibleCase' })
  }
  if (!values.testCases.some((testCase) => testCase.hidden)) {
    errors.push({ kind: 'publishMissingHiddenCase' })
  }

  return errors
}

/**
 * Only ever called on values `validateForSave` already accepted, so every
 * JSON field parses and every kept locale is complete.
 */
export function buildPatchBody(values: ProblemFormValues): PatchBody {
  const translations = FORM_LOCALES.filter(
    (locale) => localeState(values.translations[locale]) === 'complete',
  ).map((locale) => ({
    locale,
    title: values.translations[locale].title,
    statementMd: values.translations[locale].statementMd,
  }))

  const testCases = values.testCases.map((testCase) => ({
    input: JSON.parse(testCase.input.trim()) as JsonValue,
    expected: JSON.parse(testCase.expected.trim()) as JsonValue,
    hidden: testCase.hidden,
  }))

  return { difficulty: values.difficulty, points: values.points, testCases, translations }
}

export function moveTestCase(
  cases: TestCaseRow[],
  index: number,
  direction: 'up' | 'down',
): TestCaseRow[] {
  const target = direction === 'up' ? index - 1 : index + 1
  const moved = cases[index]
  const displaced = cases[target]
  if (!moved || !displaced) return cases
  const next = [...cases]
  next[index] = displaced
  next[target] = moved
  return next
}
