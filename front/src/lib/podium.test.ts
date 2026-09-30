import { describe, expect, it } from 'vitest'

import { selectPodium } from './podium'

type Team = { teamId: string; rank: number; totalScore: number }

// The back ranks by total first (rankTeams), so a zero always sits below
// every scoring team — the fixture follows the same rule.
function ranking(scores: number[]): Team[] {
  return scores.map((totalScore, index) => ({
    teamId: `t${index + 1}`,
    rank: index + 1,
    totalScore,
  }))
}

const ids = (teams: Team[]) => teams.map((team) => team.teamId)

describe('selectPodium', () => {
  it('returns nothing for an empty ranking', () => {
    expect(selectPodium([])).toEqual({ podium: [], rest: [] })
  })

  it('fills only the places that exist with one or two scoring teams', () => {
    expect(ids(selectPodium(ranking([30])).podium)).toEqual(['t1'])
    expect(ids(selectPodium(ranking([30, 20])).podium)).toEqual(['t1', 't2'])
    expect(selectPodium(ranking([30, 20])).rest).toEqual([])
  })

  it('puts exactly three teams on the podium and none in the list with three', () => {
    const { podium, rest } = selectPodium(ranking([30, 20, 10]))

    expect(ids(podium)).toEqual(['t1', 't2', 't3'])
    expect(rest).toEqual([])
  })

  it('lists 4th to 10th below the podium with ten teams', () => {
    const { podium, rest } = selectPodium(ranking([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]))

    expect(ids(podium)).toEqual(['t1', 't2', 't3'])
    expect(ids(rest)).toEqual(['t4', 't5', 't6', 't7', 't8', 't9', 't10'])
  })

  it('stops the list at the 10th place with more teams than that', () => {
    const { rest } = selectPodium(ranking([120, 110, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10]))

    expect(ids(rest)).toEqual(['t4', 't5', 't6', 't7', 't8', 't9', 't10'])
    expect(rest.at(-1)?.rank).toBe(10)
  })

  it('orders by rank whatever order the payload arrives in', () => {
    const shuffled = ranking([50, 40, 30, 20, 10]).reverse()
    const { podium, rest } = selectPodium(shuffled)

    expect(podium.map((team) => team.rank)).toEqual([1, 2, 3])
    expect(rest.map((team) => team.rank)).toEqual([4, 5])
  })

  it('never lets a team with zero points onto the podium or into the list (P1-A)', () => {
    const { podium, rest } = selectPodium(ranking([30, 20, 0, 0, 0, 0, 0]))

    expect(ids(podium)).toEqual(['t1', 't2'])
    expect(rest).toEqual([])
    expect([...podium, ...rest].every((team) => team.totalScore > 0)).toBe(true)
  })

  it('keeps the places contiguous from 1 once the zeros are gone', () => {
    const { podium, rest } = selectPodium(ranking([90, 80, 70, 60, 50, 0, 0]))

    expect([...podium, ...rest].map((team) => team.rank)).toEqual([1, 2, 3, 4, 5])
  })

  it('does not mutate the ranking it was given', () => {
    const shuffled = ranking([50, 40, 30]).reverse()
    const before = ids(shuffled)

    selectPodium(shuffled)

    expect(ids(shuffled)).toEqual(before)
  })
})
