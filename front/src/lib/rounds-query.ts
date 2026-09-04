import { api } from './api'

export const ROUNDS_QUERY_KEY = ['rounds']

export async function fetchRounds() {
  const res = await api.rounds.$get()
  if (!res.ok) throw new Error('failed to load rounds')
  return res.json()
}
