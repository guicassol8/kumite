import { describe, expect, it } from 'vitest'

import { readFieldIssues } from './api-issues'

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
