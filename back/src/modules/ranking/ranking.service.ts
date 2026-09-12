import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm'

import type { Db } from '../../db/client'
import { roundProblemsTable, roundsTable, submissionsTable, teamsTable } from '../../db/schema'
import { reapExpiredRound } from '../rounds/rounds.service'

import type { EventRanking, RoundRanking } from './ranking.schema'

// --- Pure scoring/ranking core (#43) ---
//
// No I/O here: everything below takes plain arrays/maps in and returns plain
// data out, so it's exercised directly against fixtures in ranking.test.ts,
// no database required. The DB-backed assembly (per-round queries, event
// aggregation) lives further down this file.

/** One submission, reduced to what scoring needs: who, for what key
 * (a problemId in a round, or a roundId in the event), how much, and when. */
export type ScoringRow = { teamId: string; key: string; score: number; createdAt: Date }

export type BestEntry = { score: number; attempts: number; achievedAt: Date | null }

/**
 * For every (team, key) pair in `teamIds` x `keys`, the best-scoring row
 * (ties go to the earliest `createdAt`) plus how many rows it had — 0/null
 * when the pair has no rows at all. Both lists are the source of truth for
 * which pairs exist, not the rows themselves: a team or key with zero
 * submissions still gets an entry.
 */
export function reduceBestPerProblem(
  rows: ScoringRow[],
  teamIds: string[],
  keys: string[],
): Map<string, Map<string, BestEntry>> {
  const grouped = new Map<string, ScoringRow[]>()
  for (const row of rows) {
    // NUL as the composite-key separator: it can't occur in a uuid or a
    // problem id, so the two halves can never be confused. Written as the
    // escape `\0`, never as a literal 0x00 byte — a raw one makes git treat
    // this whole file as binary and its diff stops rendering in code review.
    const groupKey = `${row.teamId}\0${row.key}`
    const group = grouped.get(groupKey)
    if (group) group.push(row)
    else grouped.set(groupKey, [row])
  }

  const result = new Map<string, Map<string, BestEntry>>()
  for (const teamId of teamIds) {
    const perKey = new Map<string, BestEntry>()
    for (const key of keys) {
      const group = grouped.get(`${teamId}\0${key}`)
      if (!group || group.length === 0) {
        perKey.set(key, { score: 0, attempts: 0, achievedAt: null })
        continue
      }

      let best = group[0]
      if (!best) throw new Error('expected a non-empty group')
      for (const row of group) {
        if (
          row.score > best.score ||
          (row.score === best.score && row.createdAt < best.createdAt)
        ) {
          best = row
        }
      }
      perKey.set(key, { score: best.score, attempts: group.length, achievedAt: best.createdAt })
    }
    result.set(teamId, perKey)
  }
  return result
}

/** One key's contribution to a team's tiebreak sum — `elapsedMs` is null
 * (excluded from the sum) whenever the key was never scored above zero. */
export type ScoringEntry = {
  key: string
  score: number
  attempts: number
  elapsedMs: number | null
}

/** Converts one team's `reduceBestPerProblem` row into `ScoringEntry[]`,
 * measuring elapsed time from `referenceTime` (the round's own openedAt). */
export function toScoringEntries(
  best: Map<string, BestEntry>,
  keys: string[],
  referenceTime: Date,
): ScoringEntry[] {
  return keys.map((key) => {
    const entry = best.get(key) ?? { score: 0, attempts: 0, achievedAt: null }
    const elapsedMs =
      entry.score > 0 && entry.achievedAt
        ? entry.achievedAt.getTime() - referenceTime.getTime()
        : null
    return { key, score: entry.score, attempts: entry.attempts, elapsedMs }
  })
}

export type ScoringSummary = { totalScore: number; totalAttempts: number; tiebreakTimeMs: number }

/** Sums score and attempts over every entry, and elapsed time over only the
 * scored ones (a null `elapsedMs` never enters the tiebreak sum). */
export function sumScoring(entries: ScoringEntry[]): ScoringSummary {
  let totalScore = 0
  let totalAttempts = 0
  let tiebreakTimeMs = 0
  for (const entry of entries) {
    totalScore += entry.score
    totalAttempts += entry.attempts
    if (entry.elapsedMs !== null) tiebreakTimeMs += entry.elapsedMs
  }
  return { totalScore, totalAttempts, tiebreakTimeMs }
}

export type RankInput = { teamId: string; teamName: string; entries: ScoringEntry[] }
export type RankedTeam = ScoringSummary & RankInput & { rank: number }

/**
 * Orders teams by total score desc, then tiebreak time asc, then attempts
 * asc, then team name asc — a total order, so `rank` is always sequential
 * with no ties left over (a team with zero of everything still sorts
 * deterministically by name against another team with zero of everything).
 */
export function rankTeams(teams: RankInput[]): RankedTeam[] {
  const withSummary = teams.map((team) => ({ ...team, ...sumScoring(team.entries) }))

  withSummary.sort((a, b) => {
    if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore
    if (a.tiebreakTimeMs !== b.tiebreakTimeMs) return a.tiebreakTimeMs - b.tiebreakTimeMs
    if (a.totalAttempts !== b.totalAttempts) return a.totalAttempts - b.totalAttempts
    return a.teamName.localeCompare(b.teamName)
  })

  return withSummary.map((team, index) => ({ ...team, rank: index + 1 }))
}

// --- DB-backed assembly (#43) ---
//
// A submission's round is the one stamped on it at accept time
// (submissions.round_id, #176), never derived from createdAt. The old
// derivation by time window silently dropped any submission whose judging
// outlived the round it was accepted in — the row's createdAt landed past
// closedAt and fell out of every ranking.

async function fetchTeams(db: Db): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: teamsTable.id, name: teamsTable.name })
    .from(teamsTable)
    .where(isNull(teamsTable.removedAt))
}

async function fetchRoundProblemIds(db: Db, roundId: string): Promise<string[]> {
  const rows = await db
    .select({ problemId: roundProblemsTable.problemId })
    .from(roundProblemsTable)
    .where(eq(roundProblemsTable.roundId, roundId))
    .orderBy(asc(roundProblemsTable.position))
  return rows.map((row) => row.problemId)
}

async function fetchSubmissionRows(
  db: Db,
  problemIds: string[],
  roundId: string,
): Promise<ScoringRow[]> {
  if (problemIds.length === 0) return []

  const rows = await db
    .select({
      teamId: submissionsTable.teamId,
      problemId: submissionsTable.problemId,
      score: submissionsTable.score,
      createdAt: submissionsTable.createdAt,
    })
    .from(submissionsTable)
    .where(
      and(eq(submissionsTable.roundId, roundId), inArray(submissionsTable.problemId, problemIds)),
    )

  return rows.map((row) => ({
    teamId: row.teamId,
    key: row.problemId,
    score: row.score,
    createdAt: row.createdAt,
  }))
}

// closedAt is not part of this: a round's submissions are the rows stamped
// with its id (#176), so when it ended no longer decides what counts.
type AnnouncedRound = { id: string; openedAt: Date | null }

// Shared by getRoundRanking (used as-is) and getEventRanking (summed once per
// round, per team, into a single ScoringEntry): the per-problem query and
// best-score reduction are identical either way.
async function computeRoundEntries(
  db: Db,
  round: AnnouncedRound,
  teamIds: string[],
): Promise<{ problemIds: string[]; entriesByTeam: Map<string, ScoringEntry[]> }> {
  if (!round.openedAt) throw new Error('expected an announced round to have openedAt')

  const problemIds = await fetchRoundProblemIds(db, round.id)
  const rows = await fetchSubmissionRows(db, problemIds, round.id)
  const best = reduceBestPerProblem(rows, teamIds, problemIds)

  const entriesByTeam = new Map<string, ScoringEntry[]>()
  for (const teamId of teamIds) {
    const bestForTeam = best.get(teamId) ?? new Map<string, BestEntry>()
    entriesByTeam.set(teamId, toScoringEntries(bestForTeam, problemIds, round.openedAt))
  }
  return { problemIds, entriesByTeam }
}

/**
 * A round's live leaderboard: points per problem, total and tiebreak, per
 * team. `null` when the round doesn't exist or is still a draft — a draft
 * never announces itself, same rule as `getProblemRoundAccess`.
 */
export async function getRoundRanking(db: Db, roundId: string): Promise<RoundRanking | null> {
  await reapExpiredRound(db)

  const [round] = await db.select().from(roundsTable).where(eq(roundsTable.id, roundId))
  if (!round || round.status === 'draft') return null

  const teams = await fetchTeams(db)
  const { problemIds, entriesByTeam } = await computeRoundEntries(
    db,
    round,
    teams.map((team) => team.id),
  )

  // A team with no attempts at all in this round never submitted — the
  // per-round leaderboard only lists participants (#184). getEventRanking
  // keeps every active team: a team that hasn't scored yet is still
  // legitimate information there, so it doesn't share this filter.
  const participatingTeams = teams.filter((team) =>
    (entriesByTeam.get(team.id) ?? []).some((entry) => entry.attempts > 0),
  )

  const ranked = rankTeams(
    participatingTeams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      entries: entriesByTeam.get(team.id) ?? [],
    })),
  )

  return {
    roundId: round.id,
    roundName: round.name,
    problemIds,
    teams: ranked.map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      rank: team.rank,
      totalScore: team.totalScore,
      totalAttempts: team.totalAttempts,
      tiebreakTimeMs: team.tiebreakTimeMs,
      problems: team.entries.map((entry) => ({
        problemId: entry.key,
        score: entry.score,
        attempts: entry.attempts,
      })),
    })),
  }
}

/**
 * The event-wide leaderboard: every non-draft round (closed + the one
 * currently open, if any) summed per team, with the per-round breakdown kept
 * alongside the total.
 */
export async function getEventRanking(db: Db): Promise<EventRanking> {
  await reapExpiredRound(db)

  const [rounds, teams] = await Promise.all([
    db.select().from(roundsTable).where(ne(roundsTable.status, 'draft')),
    fetchTeams(db),
  ])
  const teamIds = teams.map((team) => team.id)

  const orderedRounds = rounds
    .slice()
    .sort((a, b) => (a.openedAt?.getTime() ?? 0) - (b.openedAt?.getTime() ?? 0))
  const roundNameById = new Map(orderedRounds.map((round) => [round.id, round.name]))

  const roundEntriesByTeam = new Map<string, ScoringEntry[]>(teamIds.map((id) => [id, []]))
  for (const round of orderedRounds) {
    const { entriesByTeam } = await computeRoundEntries(db, round, teamIds)
    for (const teamId of teamIds) {
      const summary = sumScoring(entriesByTeam.get(teamId) ?? [])
      roundEntriesByTeam.get(teamId)?.push({
        key: round.id,
        score: summary.totalScore,
        attempts: summary.totalAttempts,
        elapsedMs: summary.totalScore > 0 ? summary.tiebreakTimeMs : null,
      })
    }
  }

  const ranked = rankTeams(
    teams.map((team) => ({
      teamId: team.id,
      teamName: team.name,
      entries: roundEntriesByTeam.get(team.id) ?? [],
    })),
  )

  return {
    teams: ranked.map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      rank: team.rank,
      totalScore: team.totalScore,
      totalAttempts: team.totalAttempts,
      tiebreakTimeMs: team.tiebreakTimeMs,
      rounds: team.entries.map((entry) => ({
        roundId: entry.key,
        roundName: roundNameById.get(entry.key) ?? '',
        score: entry.score,
        attempts: entry.attempts,
        tiebreakTimeMs: entry.elapsedMs ?? 0,
      })),
    })),
  }
}
