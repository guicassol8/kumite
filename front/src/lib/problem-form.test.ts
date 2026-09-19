import { describe, expect, it } from 'vitest'

import { POINTS_MAX } from './field-limits'
import {
  buildPatchBody,
  emptyProblemFormValues,
  issuesToProblemFormErrors,
  localeState,
  moveTestCase,
  type ProblemFormValues,
  parseJsonField,
  problemDetailToFormValues,
  savedLocalesOf,
  validateForPublish,
  validateForSave,
} from './problem-form'

const ptTranslation = { locale: 'pt' as const, title: 'Soma', statementMd: 'Some `a` e `b`.' }

const detail = {
  id: 'p1',
  points: 20,
  difficulty: 'hard' as const,
  status: 'published' as const,
  testCases: [
    { input: [1, 2], expected: 3, hidden: false },
    { input: [4, 5], expected: 9, hidden: true },
  ],
  translations: [
    ptTranslation,
    { locale: 'es' as const, title: 'Suma', statementMd: 'Suma `a` y `b`.' },
    { locale: 'en' as const, title: 'Sum', statementMd: 'Sum `a` and `b`.' },
  ],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
}

function ptOnlyValues(): ProblemFormValues {
  const values = emptyProblemFormValues()
  values.translations.pt = { title: 'Soma', statementMd: 'Some a e b.' }
  return values
}

describe('emptyProblemFormValues', () => {
  it('starts as an easy 100-point draft with no translations and no cases', () => {
    const values = emptyProblemFormValues()

    expect(values.difficulty).toBe('easy')
    expect(values.points).toBe(100)
    expect(values.testCases).toEqual([])
    expect(values.translations).toEqual({
      pt: { title: '', statementMd: '' },
      es: { title: '', statementMd: '' },
      en: { title: '', statementMd: '' },
    })
  })

  it('returns a fresh object each call, so editing one form never leaks into the next', () => {
    const first = emptyProblemFormValues()
    first.translations.pt.title = 'mutated'

    expect(emptyProblemFormValues().translations.pt.title).toBe('')
  })
})

describe('problemDetailToFormValues', () => {
  it('maps a detail onto form values with the JSON fields as text', () => {
    const values = problemDetailToFormValues(detail)

    expect(values.difficulty).toBe('hard')
    expect(values.points).toBe(20)
    expect(values.translations.es).toEqual({ title: 'Suma', statementMd: 'Suma `a` y `b`.' })
    expect(values.testCases).toEqual([
      { input: '[1,2]', expected: '3', hidden: false },
      { input: '[4,5]', expected: '9', hidden: true },
    ])
  })

  it('leaves the locales missing from the detail empty', () => {
    const values = problemDetailToFormValues({ ...detail, translations: [ptTranslation] })

    expect(values.translations.pt.title).toBe('Soma')
    expect(values.translations.es).toEqual({ title: '', statementMd: '' })
    expect(values.translations.en).toEqual({ title: '', statementMd: '' })
  })
})

describe('savedLocalesOf', () => {
  it('lists the locales the API already stores for the problem', () => {
    expect(savedLocalesOf({ ...detail, translations: [ptTranslation] })).toEqual(['pt'])
    expect(savedLocalesOf(detail)).toEqual(['pt', 'es', 'en'])
  })
})

describe('parseJsonField', () => {
  it('accepts any JSON value, not just arrays', () => {
    expect(parseJsonField('[1,2]')).toEqual({ ok: true, value: [1, 2] })
    expect(parseJsonField('3')).toEqual({ ok: true, value: 3 })
    expect(parseJsonField('"texto"')).toEqual({ ok: true, value: 'texto' })
    expect(parseJsonField('null')).toEqual({ ok: true, value: null })
    expect(parseJsonField('{"a":1}')).toEqual({ ok: true, value: { a: 1 } })
  })

  it('trims surrounding whitespace before parsing', () => {
    expect(parseJsonField('  [1, 2]  ')).toEqual({ ok: true, value: [1, 2] })
  })

  it('reports an empty field and a malformed one with distinct reasons', () => {
    expect(parseJsonField('')).toEqual({ ok: false, reason: 'empty' })
    expect(parseJsonField('   ')).toEqual({ ok: false, reason: 'empty' })
    expect(parseJsonField('[1,')).toEqual({ ok: false, reason: 'invalid' })
    expect(parseJsonField('undefined')).toEqual({ ok: false, reason: 'invalid' })
  })
})

describe('localeState', () => {
  it('classifies an entry as empty, complete or partial', () => {
    expect(localeState({ title: '', statementMd: '' })).toBe('empty')
    expect(localeState({ title: '  ', statementMd: '\n' })).toBe('empty')
    expect(localeState({ title: 'Soma', statementMd: 'Some.' })).toBe('complete')
    expect(localeState({ title: 'Soma', statementMd: '' })).toBe('partial')
    expect(localeState({ title: '', statementMd: 'Some.' })).toBe('partial')
  })
})

describe('validateForSave', () => {
  it('accepts a pt-only draft untouched (acceptance #3)', () => {
    expect(validateForSave(ptOnlyValues(), [])).toEqual([])
  })

  it('rejects a locale with a title but no statement, pointing at that tab and field', () => {
    const values = ptOnlyValues()
    values.translations.es = { title: 'Suma', statementMd: '' }

    expect(validateForSave(values, [])).toEqual([
      { kind: 'translationIncomplete', locale: 'es', field: 'statementMd' },
    ])
  })

  it('rejects clearing a translation the API already stores', () => {
    const values = ptOnlyValues()

    expect(validateForSave(values, ['pt', 'es'])).toEqual([
      { kind: 'translationCannotBeCleared', locale: 'es', field: 'title' },
    ])
  })

  it('rejects a points value the API would refuse', () => {
    for (const points of [Number.NaN, 0, -5, 1.5]) {
      const values = { ...ptOnlyValues(), points }
      expect(validateForSave(values, [])).toEqual([{ kind: 'pointsInvalid' }])
    }
  })

  it('accepts any positive integer as the points value', () => {
    for (const points of [1, 20, 1000, POINTS_MAX]) {
      expect(validateForSave({ ...ptOnlyValues(), points }, [])).toEqual([])
    }
  })

  it('rejects a points value over the ceiling before any request goes out', () => {
    for (const points of [POINTS_MAX + 1, 9_999_999_999]) {
      expect(validateForSave({ ...ptOnlyValues(), points }, [])).toEqual([
        { kind: 'pointsTooLarge', max: POINTS_MAX },
      ])
    }
  })

  it('rejects an empty and a malformed JSON field on the offending row only', () => {
    const values = ptOnlyValues()
    values.testCases = [
      { input: '[1,2]', expected: '3', hidden: false },
      { input: '[4,', expected: '', hidden: true },
    ]

    expect(validateForSave(values, [])).toEqual([
      { kind: 'json', reason: 'invalid', index: 1, field: 'input' },
      { kind: 'json', reason: 'empty', index: 1, field: 'expected' },
    ])
  })
})

describe('validateForPublish', () => {
  it('flags the locales still missing on a pt-only draft (acceptance #2)', () => {
    const values = ptOnlyValues()
    values.testCases = [
      { input: '[1,2]', expected: '3', hidden: false },
      { input: '[4,5]', expected: '9', hidden: true },
    ]

    expect(validateForPublish(values, [])).toEqual([
      { kind: 'publishMissingLocale', locale: 'es', field: 'title' },
      { kind: 'publishMissingLocale', locale: 'en', field: 'title' },
    ])
  })

  it('flags a case set without a hidden case', () => {
    const values = problemDetailToFormValues(detail)
    values.testCases = [{ input: '[1,2]', expected: '3', hidden: false }]

    expect(validateForPublish(values, [])).toEqual([{ kind: 'publishMissingHiddenCase' }])
  })

  it('flags a case set without a visible case, and an empty one on both counts', () => {
    const values = problemDetailToFormValues(detail)
    values.testCases = [{ input: '[1,2]', expected: '3', hidden: true }]
    expect(validateForPublish(values, [])).toEqual([{ kind: 'publishMissingVisibleCase' }])

    values.testCases = []
    expect(validateForPublish(values, [])).toEqual([
      { kind: 'publishMissingVisibleCase' },
      { kind: 'publishMissingHiddenCase' },
    ])
  })

  it('accepts a fully translated problem with a visible and a hidden case', () => {
    expect(validateForPublish(problemDetailToFormValues(detail), ['pt', 'es', 'en'])).toEqual([])
  })

  it('still reports the save-level errors', () => {
    const values = problemDetailToFormValues(detail)
    values.testCases[0] = { input: '[1,', expected: '3', hidden: false }

    expect(validateForPublish(values, [])).toEqual([
      { kind: 'json', reason: 'invalid', index: 0, field: 'input' },
    ])
  })
})

describe('buildPatchBody', () => {
  it('omits the empty locales and keeps the complete ones', () => {
    const body = buildPatchBody(ptOnlyValues())

    expect(body.translations).toEqual([{ locale: 'pt', title: 'Soma', statementMd: 'Some a e b.' }])
  })

  it('parses the test-case JSON text back into values', () => {
    const values = ptOnlyValues()
    values.testCases = [{ input: '  [1, 2] ', expected: '3', hidden: true }]

    expect(buildPatchBody(values).testCases).toEqual([{ input: [1, 2], expected: 3, hidden: true }])
  })

  it('round-trips a detail back into an equivalent patch body', () => {
    const body = buildPatchBody(problemDetailToFormValues(detail))

    expect(body).toEqual({
      difficulty: detail.difficulty,
      points: detail.points,
      testCases: detail.testCases,
      translations: detail.translations,
    })
  })
})

describe('moveTestCase', () => {
  const cases = [
    { input: '1', expected: '1', hidden: false },
    { input: '2', expected: '2', hidden: false },
    { input: '3', expected: '3', hidden: true },
  ]

  it('swaps a row with its neighbour', () => {
    expect(moveTestCase(cases, 1, 'up').map((c) => c.input)).toEqual(['2', '1', '3'])
    expect(moveTestCase(cases, 1, 'down').map((c) => c.input)).toEqual(['1', '3', '2'])
  })

  it('is a no-op at the boundaries', () => {
    expect(moveTestCase(cases, 0, 'up')).toEqual(cases)
    expect(moveTestCase(cases, 2, 'down')).toEqual(cases)
  })

  it('never mutates the array it was given', () => {
    moveTestCase(cases, 1, 'up')

    expect(cases.map((c) => c.input)).toEqual(['1', '2', '3'])
  })
})

describe('issuesToProblemFormErrors', () => {
  const sent = [{ locale: 'pt' as const }, { locale: 'en' as const }]

  it('maps a too_big points issue to the ceiling error, carrying the limit', () => {
    expect(
      issuesToProblemFormErrors(
        [
          {
            path: 'points',
            message: 'Number must be less than or equal to 10000',
            code: 'too_big',
          },
        ],
        sent,
      ),
    ).toEqual([{ kind: 'pointsTooLarge', max: POINTS_MAX }])
  })

  it('maps any other points issue to the generic points error', () => {
    expect(
      issuesToProblemFormErrors(
        [{ path: 'points', message: 'Expected number, received string', code: 'invalid_type' }],
        sent,
      ),
    ).toEqual([{ kind: 'pointsInvalid' }])
  })

  it('resolves a translation index against the array that was sent, not the tab order', () => {
    // buildPatchBody drops incomplete locales, so `translations[1]` here is
    // `en`, not `es`. Resolving against FORM_LOCALES would light up the wrong
    // tab — which is the whole reason the sent array is threaded through.
    expect(
      issuesToProblemFormErrors([{ path: 'translations[1].title', message: 'Required' }], sent),
    ).toEqual([
      { kind: 'serverRejected', target: { field: 'translation', locale: 'en', key: 'title' } },
    ])
  })

  it('maps a statement issue to the same locale', () => {
    expect(
      issuesToProblemFormErrors(
        [{ path: 'translations[0].statementMd', message: 'Required' }],
        sent,
      ),
    ).toEqual([
      {
        kind: 'serverRejected',
        target: { field: 'translation', locale: 'pt', key: 'statementMd' },
      },
    ])
  })

  it('reuses the row-level JSON error for a rejected input or expected', () => {
    expect(
      issuesToProblemFormErrors(
        [
          { path: 'testCases[0].input', message: 'Invalid' },
          { path: 'testCases[2].expected', message: 'Invalid' },
        ],
        sent,
      ),
    ).toEqual([
      { kind: 'json', reason: 'invalid', index: 0, field: 'input' },
      { kind: 'json', reason: 'invalid', index: 2, field: 'expected' },
    ])
  })

  it('maps difficulty and a row’s hidden flag to their own fields', () => {
    expect(
      issuesToProblemFormErrors(
        [
          { path: 'difficulty', message: 'Invalid enum value' },
          { path: 'testCases[1].hidden', message: 'Expected boolean, received string' },
        ],
        sent,
      ),
    ).toEqual([
      { kind: 'serverRejected', target: { field: 'difficulty' } },
      { kind: 'serverRejected', target: { field: 'testCase', index: 1, key: 'hidden' } },
    ])
  })

  it('skips paths with no field on this form, leaving the caller its generic message', () => {
    // `translations` bare is the duplicate-locale refinement; `id` and
    // `whatever[0].x` stand for anything a future API adds; `translations[9]`
    // is out of range of what was sent. None of them has a field here, and a
    // message with nowhere to render is worse than the form-level fallback.
    expect(
      issuesToProblemFormErrors(
        [
          { path: 'translations', message: 'Duplicate locale(s) in translations: pt' },
          { path: 'testCases', message: 'Required' },
          { path: 'id', message: 'Invalid uuid' },
          { path: 'whatever[0].x', message: 'Nope' },
          { path: 'translations[9].title', message: 'Required' },
          { path: 'translations[0].locale', message: 'Invalid enum value' },
        ],
        sent,
      ),
    ).toEqual([])
  })

  it('maps nothing when there are no issues', () => {
    expect(issuesToProblemFormErrors([], sent)).toEqual([])
  })
})
