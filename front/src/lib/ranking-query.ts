import { api } from './api'

export async function fetchRoundRanking(roundId: string) {
  const res = await api.rounds[':id'].ranking.$get({ param: { id: roundId } })
  if (!res.ok) throw new Error('failed to load round ranking')
  return res.json()
}

export async function fetchEventRanking() {
  const res = await api.ranking.$get()
  if (!res.ok) throw new Error('failed to load event ranking')
  return res.json()
}
