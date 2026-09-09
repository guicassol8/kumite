import { api } from './api'

export const ROUNDS_QUERY_KEY = ['rounds']

export async function fetchRounds() {
  const res = await api.rounds.$get()
  if (!res.ok) throw new Error('failed to load rounds')
  return res.json()
}

export class RoundNotFoundError extends Error {}

export function roundQueryKey(id: string) {
  return ['round', id]
}

export async function fetchRound(id: string, locale: 'pt' | 'es' | 'en') {
  const res = await api.rounds[':id'].$get({ param: { id }, query: { locale } })
  // 422 alongside 404, cast included (#94) — see fetchProblem in problems-query.ts.
  if (res.status === 404 || (res.status as number) === 422) throw new RoundNotFoundError()
  if (res.status !== 200) throw new Error('failed to load round')
  return res.json()
}
