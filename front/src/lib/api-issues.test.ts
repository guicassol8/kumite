import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { errorCodeFrom, fieldIssuesFrom, readFieldIssues } from './api-issues'

function jsonResponse(body: unknown) {
  return { json: async () => body }
}

describe('readFieldIssues', () => {
  it('reads the body section of kata’s 422 envelope', async () => {
    const issues = await readFieldIssues(
      jsonResponse({
        error: 'validation_failed',
        message: 'Invalid input',
        issues: {
          body: [
            { path: 'points', message: 'Too big', code: 'too_big' },
            { path: 'translations[0].title', message: 'Required', code: 'too_small' },
          ],
        },
      }),
    )

    expect(issues).toEqual([
      { path: 'points', message: 'Too big', code: 'too_big' },
      { path: 'translations[0].title', message: 'Required', code: 'too_small' },
    ])
  })

  it('ignores the params section, which the screens read as not-found', async () => {
    // A malformed id in the URL is a 422 too, and `lib/problems-query.ts` turns
    // it into "problem not found". Surfacing it as a field error would put a
    // message on a field the organizer never touched.
    const issues = await readFieldIssues(
      jsonResponse({
        error: 'validation_failed',
        issues: { params: [{ path: 'id', message: 'Invalid uuid', code: 'invalid_string' }] },
      }),
    )

    expect(issues).toEqual([])
  })

  it('drops a root issue, which belongs to no field', async () => {
    // kata answers a malformed request body with 400 and a single issue whose
    // path is the empty string.
    const issues = await readFieldIssues(
      jsonResponse({
        error: 'invalid_json',
        issues: { body: [{ path: '', message: 'Invalid JSON', code: 'custom' }] },
      }),
    )

    expect(issues).toEqual([])
  })

  it('returns nothing for a 500-shaped body with no issues at all', async () => {
    expect(await readFieldIssues(jsonResponse({ error: 'internal_error' }))).toEqual([])
  })

  it('returns nothing for an empty body', async () => {
    expect(await readFieldIssues(jsonResponse({}))).toEqual([])
  })

  it('survives a response whose json() rejects', async () => {
    const res = {
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON')
      },
    }

    expect(await readFieldIssues(res)).toEqual([])
  })

  it('skips malformed entries instead of trusting the shape', async () => {
    const issues = await readFieldIssues(
      jsonResponse({
        issues: {
          body: [null, 'nope', { path: 'points' }, { path: 'points', message: 'Too big' }],
        },
      }),
    )

    expect(issues).toEqual([{ path: 'points', message: 'Too big' }])
  })

  it('returns nothing when issues.body is not an array', async () => {
    expect(await readFieldIssues(jsonResponse({ issues: { body: { path: 'points' } } }))).toEqual(
      [],
    )
  })
})

// `readFieldIssues` consumes the response body, so a caller that needs both the
// error code and the field issues — the organizer's problem form, which has to
// tell a 409 `problem_in_open_round` from a generic failure (#193) — cannot
// call it and then read the code. These two take the already-parsed envelope.
describe('fieldIssuesFrom / errorCodeFrom', () => {
  it('reads the code and the issues from the same parsed envelope', () => {
    const body = {
      error: 'validation_failed',
      message: 'Invalid input',
      issues: { body: [{ path: 'points', message: 'Too big', code: 'too_big' }] },
    }

    expect(errorCodeFrom(body)).toBe('validation_failed')
    expect(fieldIssuesFrom(body)).toEqual([{ path: 'points', message: 'Too big', code: 'too_big' }])
  })

  it('reads the code of a 409 that carries no issues at all', () => {
    const body = {
      error: 'problem_in_open_round',
      message: 'Cannot change testCases while the problem is in an open round',
    }

    expect(errorCodeFrom(body)).toBe('problem_in_open_round')
    expect(fieldIssuesFrom(body)).toEqual([])
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'not an envelope'],
    ['an array', []],
    ['an empty object', {}],
    ['a non-string error', { error: 42 }],
  ])('returns null for the code of %s', (_label, body) => {
    expect(errorCodeFrom(body)).toBeNull()
    expect(fieldIssuesFrom(body)).toEqual([])
  })
})

// Acceptance 3 of #312: the envelope kept being parsed by hand in a screen
// that predated this module. The sweep keeps a new copy from creeping back:
// an `issues?.body` / `.issues.body` anywhere else in `src/` is a screen
// reaching into kata's envelope on its own instead of through these helpers.
describe('no hand-rolled envelope parsing', () => {
  const SRC = path.resolve(import.meta.dirname, '..')
  const THIS_MODULE = path.join(SRC, 'lib', 'api-issues.ts')
  const HAND_ROLLED = /issues\?\.body|\.issues\.body/

  it('reads issues.body only through lib/api-issues.ts', () => {
    const offenders = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) => path.join(SRC, file) !== THIS_MODULE)
      .filter((file) => HAND_ROLLED.test(readFileSync(path.join(SRC, file), 'utf8')))

    expect(offenders).toEqual([])
  })
})
