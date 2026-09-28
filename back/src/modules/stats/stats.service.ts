import { and, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'

import { JUDGE_CONCURRENCY } from '../../config'
import type { Db } from '../../db/client'
import {
  roundsTable,
  submissionsTable,
  teamMembersTable,
  teamsTable,
  usersTable,
} from '../../db/schema'
import { getEventConfig } from '../event-config/event-config.service'
import { getJudgeLoad } from '../judge/judge.service'
import { findOpenRound, reapExpiredRound } from '../rounds/rounds.service'
import type { SseBus } from '../sse/sse.service'
import { getSubmissionLoad } from '../submissions/submissions.service'

import type { EventStats, LiveStats, StatsRoundRef } from './stats.schema'

type RoundRow = typeof roundsTable.$inferSelect

function toRoundRef(round: RoundRow): StatsRoundRef {
  return {
    id: round.id,
    name: round.name,
    status: round.status,
    openedAt: round.openedAt,
    closesAt: round.closesAt,
    closedAt: round.closedAt,
  }
}

// "Inscritos" are the active participants: an organizer account is staff,
// and a deactivated one is no longer competing. Both dimensions the overview
// shows (university, has-a-team) are cut from this same population, so they
// always add up to the same total.
async function countParticipants(db: Db): Promise<EventStats['participants']> {
  const rows = await db
    .select({
      university: usersTable.university,
      inTeam: isNotNull(teamMembersTable.userId),
      total: count(),
    })
    .from(usersTable)
    .leftJoin(teamMembersTable, eq(teamMembersTable.userId, usersTable.id))
    .where(and(eq(usersTable.role, 'participant'), eq(usersTable.active, true)))
    .groupBy(usersTable.university, isNotNull(teamMembersTable.userId))

  const participants = { total: 0, pucrs: 0, merida: 0, inTeam: 0, withoutTeam: 0 }
  for (const row of rows) {
    participants.total += row.total
    participants[row.university] += row.total
    if (row.inTeam) participants.inTeam += row.total
    else participants.withoutTeam += row.total
  }
  return participants
}

// Removed teams (#50) are excluded exactly as they are from the listings and
// the ranking. Their team_members rows are deleted by removeTeam, so the
// ex-members already land in `withoutTeam` above with no extra handling.
//
// openSlots clamps per team, not on the sum: maxTeamSize can be lowered
// after teams are formed, and an over-full team must contribute 0 free
// seats rather than a negative number that would hide another team's slots.
async function countTeams(db: Db, maxTeamSize: number): Promise<EventStats['teams']> {
  const rows = await db
    .select({ teamId: teamsTable.id, members: count(teamMembersTable.userId) })
    .from(teamsTable)
    .leftJoin(teamMembersTable, eq(teamMembersTable.teamId, teamsTable.id))
    .where(isNull(teamsTable.removedAt))
    .groupBy(teamsTable.id)

  let openSlots = 0
  for (const row of rows) openSlots += Math.max(0, maxTeamSize - row.members)
  return { total: rows.length, openSlots, maxTeamSize }
}

async function countAllSubmissions(db: Db): Promise<number> {
  const [row] = await db.select({ total: count() }).from(submissionsTable)
  return row?.total ?? 0
}

// A submission's round is the one stamped on it at accept time (#176), right
// after the accept gate validated that round as open — never derived from
// createdAt. The old [openedAt, closedAt] window lost submissions whose judging
// finished after the round closed, and could count a row stamped with another
// round that shared a problem. No problem filter either: a round's problem set
// is frozen once it leaves draft (round_not_draft), so every row stamped with
// it is already on one of its problems.
async function countSubmissionsInRound(db: Db, round: RoundRow): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(submissionsTable)
    .where(eq(submissionsTable.roundId, round.id))
  return row?.total ?? 0
}

async function findLastClosedRound(db: Db): Promise<RoundRow | null> {
  const [round] = await db
    .select()
    .from(roundsTable)
    .where(eq(roundsTable.status, 'closed'))
    .orderBy(desc(sql`coalesce(${roundsTable.closedAt}, ${roundsTable.closesAt})`))
    .limit(1)
  return round ?? null
}

/**
 * The Painel overview's numbers (#54), all derived on read: signups per
 * university, team formation, submissions, and the round the event is on
 * right now (the open one, else the last closed one).
 */
export async function getEventStats(db: Db): Promise<EventStats> {
  // Before anything reads `status`: a round past its own closesAt must never
  // be reported as active just because no other read path ran first.
  await reapExpiredRound(db)

  const [config, activeRound, lastClosedRound, participants, totalSubmissions] = await Promise.all([
    getEventConfig(db),
    findOpenRound(db),
    findLastClosedRound(db),
    countParticipants(db),
    countAllSubmissions(db),
  ])

  const teams = await countTeams(db, config.maxTeamSize)
  const referenceRound = activeRound ?? lastClosedRound

  return {
    participants,
    teams,
    submissions: {
      total: totalSubmissions,
      inRound: referenceRound ? await countSubmissionsInRound(db, referenceRound) : null,
    },
    round: {
      active: activeRound ? toRoundRef(activeRound) : null,
      lastClosed: lastClosedRound ? toRoundRef(lastClosedRound) : null,
    },
  }
}

/**
 * The organizer's live card (#279): the judge queue, open SSE streams and
 * accepted submissions, all read from process memory. The signature takes no
 * `Db` on purpose — polling this every 5 s from every organizer tab must never
 * reach the database.
 */
export function getLiveStats(bus: Pick<SseBus, 'connections'>, now = Date.now()): LiveStats {
  return {
    judge: { ...getJudgeLoad(), concurrency: JUDGE_CONCURRENCY },
    sse: { connections: bus.connections() },
    submissions: getSubmissionLoad(now),
  }
}
