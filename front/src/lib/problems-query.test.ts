import { describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({
  api: {
    problems: {
      ':id': { $get: vi.fn() },
    },
    practice: {
      problems: { $get: vi.fn() },
    },
  },
}))

import { api } from './api'
import {
  fetchPracticeProblems,
  fetchProblem,
  ProblemNotFoundError,
  practiceProblemsQueryKey,
  problemQueryKey,
} from './problems-query'

const mockedGet = vi.mocked(api.problems[':id'].$get)
const mockedPracticeGet = vi.mocked(api.practice.problems.$get)

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { status, json: async () => body }
}

describe('problemQueryKey', () => {
  it('is scoped by id', () => {
    expect(problemQueryKey('p1')).toEqual(['problem', 'p1'])
  })
})

describe('fetchProblem', () => {
  it('returns the parsed body on 200', async () => {
    const body = { id: 'p1', title: 'Soma' }
    mockedGet.mockResolvedValue(jsonResponse(200, body))

    await expect(fetchProblem('p1', 'pt')).resolves.toEqual(body)
    expect(mockedGet).toHaveBeenCalledWith({ param: { id: 'p1' }, query: { locale: 'pt' } })
  })

  it('throws ProblemNotFoundError on 404', async () => {
    mockedGet.mockResolvedValue(jsonResponse(404, { error: 'not_found', message: 'nope' }))

    await expect(fetchProblem('p1', 'pt')).rejects.toBeInstanceOf(ProblemNotFoundError)
  })

  it('throws ProblemNotFoundError on 422 (#94)', async () => {
    // A malformed id in the URL is now rejected at the edge instead of 500ing;
    // to the reader that link names no problem, same as a 404.
    mockedGet.mockResolvedValue(jsonResponse(422, { error: 'validation_failed', issues: {} }))

    await expect(fetchProblem('nao-e-uuid', 'pt')).rejects.toBeInstanceOf(ProblemNotFoundError)
  })

  it('throws a generic error on any other status', async () => {
    mockedGet.mockResolvedValue(jsonResponse(500, { error: 'internal', message: 'boom' }))

    await expect(fetchProblem('p1', 'pt')).rejects.toThrow()
  })
})

describe('practiceProblemsQueryKey', () => {
  it('is scoped by locale', () => {
    expect(practiceProblemsQueryKey('es')).toEqual(['practice-problems', 'es'])
  })
})

describe('fetchPracticeProblems (#211)', () => {
  it('returns the list on 200, asking for the given locale', async () => {
    const body = [{ id: 'p1', title: 'Soma', difficulty: 'easy', locale: 'en' }]
    mockedPracticeGet.mockResolvedValue(jsonResponse(200, body))

    await expect(fetchPracticeProblems('en')).resolves.toEqual(body)
    expect(mockedPracticeGet).toHaveBeenCalledWith({ query: { locale: 'en' } })
  })

  it('rejects on any other status', async () => {
    mockedPracticeGet.mockResolvedValue(jsonResponse(500, { error: 'internal', message: 'x' }))

    await expect(fetchPracticeProblems('pt')).rejects.toThrow()
  })
})
