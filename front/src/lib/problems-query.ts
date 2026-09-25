import { api } from './api'

export class ProblemNotFoundError extends Error {}

export function problemQueryKey(id: string) {
  return ['problem', id]
}

export async function fetchProblem(id: string, locale: 'pt' | 'es' | 'en') {
  const res = await api.problems[':id'].$get({ param: { id }, query: { locale } })
  // 422 alongside 404 (#94): the id here comes from the URL, so a malformed
  // one is a link that names no problem — the same thing to the reader as an
  // id that no longer exists, not a "something went wrong".
  //
  // The cast is the point: 422 is kata's input-validation envelope, which no
  // route declares in `output` (same rule that keeps 401/403/413 out of it),
  // so the RPC client's status union genuinely doesn't know about it.
  if (res.status === 404 || (res.status as number) === 422) throw new ProblemNotFoundError()
  if (res.status !== 200) throw new Error('failed to load problem')
  return res.json()
}

/** The practice catalog (#211) — per locale, since titles come translated. */
export function practiceProblemsQueryKey(locale: 'pt' | 'es' | 'en') {
  return ['practice-problems', locale]
}

export async function fetchPracticeProblems(locale: 'pt' | 'es' | 'en') {
  const res = await api.practice.problems.$get({ query: { locale } })
  if (res.status !== 200) throw new Error('failed to load practice problems')
  return res.json()
}
