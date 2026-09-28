import type { ApiFieldIssue } from './api-issues'
import { POINTS_MAX } from './field-limits'
import type { UiLocale } from './resolve-problem-title'

export const FORM_LOCALES = ['pt', 'es', 'en'] as const

export type Difficulty = 'easy' | 'medium' | 'hard'
export type ProblemStatus = 'draft' | 'published' | 'archived'
/**
 * `round` problems are played inside a round; `practice` ones sit in the open
 * practice list, judged only against their visible cases (#209).
 */
export type ProblemVisibility = 'round' | 'practice'

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
  visibility: ProblemVisibility
  translations: Record<UiLocale, TranslationEntry>
  testCases: TestCaseRow[]
}

/** The subset of the API's `ProblemDetail` this module needs. */
export type ProblemFormSource = {
  difficulty: Difficulty
  points: number
  visibility: ProblemVisibility
  testCases: { input: JsonValue; expected: JsonValue; hidden: boolean }[]
  translations: { locale: UiLocale; title: string; statementMd: string }[]
}

export type PatchBody = {
  difficulty: Difficulty
  points: number
  visibility: ProblemVisibility
  testCases: { input: JsonValue; expected: JsonValue; hidden: boolean }[]
  translations: { locale: UiLocale; title: string; statementMd: string }[]
}

export type JsonFieldName = 'input' | 'expected'

/**
 * Where a message goes when the API rejected a field the form has no rule of
 * its own for. Mirrors the shape of the paths kata emits.
 */
export type ProblemFormFieldTarget =
  | { field: 'points' }
  | { field: 'difficulty' }
  | { field: 'translation'; locale: UiLocale; key: keyof TranslationEntry }
  | { field: 'testCase'; index: number; key: JsonFieldName | 'hidden' }

export type ProblemFormError =
  | { kind: 'pointsInvalid' }
  | { kind: 'pointsTooLarge'; max: number }
  | { kind: 'translationIncomplete'; locale: UiLocale; field: keyof TranslationEntry }
  | { kind: 'translationCannotBeCleared'; locale: UiLocale; field: keyof TranslationEntry }
  | { kind: 'json'; reason: 'empty' | 'invalid'; index: number; field: JsonFieldName }
  | { kind: 'publishMissingLocale'; locale: UiLocale; field: keyof TranslationEntry }
  | { kind: 'publishMissingVisibleCase' }
  | { kind: 'publishMissingHiddenCase' }
  | { kind: 'visibilityLockedByRound' }
  | { kind: 'roundNeedsTestCases' }
  | { kind: 'serverRejected'; target: ProblemFormFieldTarget }

/**
 * What a save/publish handler hands back to the form. `fieldErrors` empty on a
 * failure is the honest answer for a 500, a dropped connection or a 422 whose
 * paths this form has no field for: the screen keeps its form-level message.
 */
export type SubmitOutcome = { ok: true } | { ok: false; fieldErrors: ProblemFormError[] }

export const DEFAULT_POINTS = 100

export function emptyProblemFormValues(): ProblemFormValues {
  return {
    difficulty: 'easy',
    points: DEFAULT_POINTS,
    visibility: 'round',
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
  values.visibility = detail.visibility
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
  } else if (values.points > POINTS_MAX) {
    // The ceiling is checked before the request, not only after the 422: the
    // organizer should be told the limit without spending a round-trip on it.
    errors.push({ kind: 'pointsTooLarge', max: POINTS_MAX })
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
  // Mirrors the back's `evaluateTestCaseCoverage`: a practice problem is judged
  // on its visible cases only, so a hidden one is not required to publish it.
  if (values.visibility === 'round' && !values.testCases.some((testCase) => testCase.hidden)) {
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

  // `visibility` goes out on every save: resending the stored value is a no-op
  // on the back, whose locks only run when the value actually changes.
  return {
    difficulty: values.difficulty,
    points: values.points,
    visibility: values.visibility,
    testCases,
    translations,
  }
}

/**
 * The two `PATCH` refusals a visibility change can earn, read from the
 * envelope's `code` — never from its English `message`, which is also the only
 * place the back says *which* case is missing. Anything else maps to nothing,
 * leaving the caller its own message.
 */
export function patchRefusalToProblemFormErrors(code: string | null): ProblemFormError[] {
  if (code === 'problem_in_round') return [{ kind: 'visibilityLockedByRound' }]
  if (code === 'missing_test_cases') return [{ kind: 'roundNeedsTestCases' }]
  return []
}

/** `translations[2].title` -> `{ list: 'translations', index: 2, key: 'title' }`. */
function parseIndexedPath(path: string): { list: string; index: number; key: string } | null {
  const match = /^([A-Za-z]+)\[(\d+)\]\.([A-Za-z]+)$/.exec(path)
  if (!match?.[1] || !match[2] || !match[3]) return null
  return { list: match[1], index: Number(match[2]), key: match[3] }
}

/**
 * Turns kata's per-field 422 issues into form errors, so a rejection lands under
 * the field that caused it instead of in a form-level "could not save".
 *
 * `sentTranslations` is the array that actually went out — `buildPatchBody`
 * drops incomplete locales, so `translations[0]` is not necessarily `pt` and the
 * index has to be resolved against what was sent, not against the form's own
 * locale order. Test-case indices need no such care: `buildPatchBody` maps them
 * one to one.
 *
 * A path this form has no field for (`translations` on its own, from the
 * duplicate-locale refinement, or anything a future API adds) is skipped, and
 * the caller falls back to its generic message — never a message with nowhere
 * to appear.
 */
export function issuesToProblemFormErrors(
  issues: ApiFieldIssue[],
  sentTranslations: { locale: UiLocale }[],
): ProblemFormError[] {
  const errors: ProblemFormError[] = []

  for (const issue of issues) {
    if (issue.path === 'points') {
      errors.push(
        issue.code === 'too_big'
          ? { kind: 'pointsTooLarge', max: POINTS_MAX }
          : { kind: 'pointsInvalid' },
      )
      continue
    }

    if (issue.path === 'difficulty') {
      errors.push({ kind: 'serverRejected', target: { field: 'difficulty' } })
      continue
    }

    const indexed = parseIndexedPath(issue.path)
    if (!indexed) continue

    if (indexed.list === 'translations') {
      const locale = sentTranslations[indexed.index]?.locale
      if (!locale) continue
      if (indexed.key !== 'title' && indexed.key !== 'statementMd') continue
      errors.push({
        kind: 'serverRejected',
        target: { field: 'translation', locale, key: indexed.key },
      })
      continue
    }

    if (indexed.list === 'testCases') {
      if (indexed.key === 'input' || indexed.key === 'expected') {
        // The row's own field already has a message for "this is not JSON";
        // reuse it rather than inventing a second wording for the same fault.
        errors.push({ kind: 'json', reason: 'invalid', index: indexed.index, field: indexed.key })
        continue
      }
      if (indexed.key === 'hidden') {
        errors.push({
          kind: 'serverRejected',
          target: { field: 'testCase', index: indexed.index, key: 'hidden' },
        })
      }
    }
  }

  return errors
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
