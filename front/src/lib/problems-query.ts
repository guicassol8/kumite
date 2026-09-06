import { api } from './api'

export class ProblemNotFoundError extends Error {}

export function problemQueryKey(id: string) {
  return ['problem', id]
}

export async function fetchProblem(id: string, locale: 'pt' | 'es' | 'en') {
  const res = await api.problems[':id'].$get({ param: { id }, query: { locale } })
  if (res.status === 404) throw new ProblemNotFoundError()
  if (res.status !== 200) throw new Error('failed to load problem')
  return res.json()
}
