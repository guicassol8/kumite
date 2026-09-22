import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm'

import type { Db } from '../../db/client'
import {
  problemsTable,
  problemTranslationsTable,
  roundProblemsTable,
  roundsTable,
  submissionsTable,
  teamsTable,
  usersTable,
} from '../../db/schema'
import type { Locale } from '../../lib/locale'
import type { ScoringRow } from '../ranking/ranking.service'
import { getEventRanking, getRoundRanking, reduceBestPerProblem } from '../ranking/ranking.service'
import type { OrganizerTeamMember } from '../teams/teams.schema'
import { listOrganizerTeams } from '../teams/teams.service'

import type {
  EventExport,
  ExportCsvKind,
  ExportRemovedTeam,
  ExportRound,
  ExportSubmission,
} from './export.schema'

// --- The event export (#278) ---
//
// Composes the services the live screens already use instead of rewriting
// their queries: `getEventRanking` is what GET /ranking serves,
// `getRoundRanking` what GET /rounds/:id/ranking serves (filter of #184 and
// denominator verdict of #193 included), and `listOrganizerTeams` what
// GET /organizer/teams serves. That is not tidiness — it is the only way the
// issue's first criterion ("coherent with what /leaderboard and
// /organizer/teams show at that instant") can hold without two truths.

const ALPHABET_SIZE = 26

/** A, B, C… for the first 26 positions in a round, the 1-based position past
 * Z — the same rule the front renders (front/src/lib/round-position.ts), so a
 * CSV column header matches the letter on screen. */
function positionLabel(position: number): string {
  if (position >= 0 && position < ALPHABET_SIZE) {
    return String.fromCharCode('A'.charCodeAt(0) + position)
  }
  return String(position + 1)
}

/** Non-draft rounds, oldest first, each with its problems in position order
 * and every locale's title. Same ordering as getEventRanking's, so the round
 * columns of the ranking CSV line up with `ranking.rounds`. */
async function fetchExportRounds(db: Db): Promise<ExportRound[]> {
  const rounds = await db.select().from(roundsTable).where(ne(roundsTable.status, 'draft'))
  if (rounds.length === 0) return []

  const ordered = rounds
    .slice()
    .sort((a, b) => (a.openedAt?.getTime() ?? 0) - (b.openedAt?.getTime() ?? 0))

  const problemRows = await db
    .select({
      roundId: roundProblemsTable.roundId,
      problemId: roundProblemsTable.problemId,
      position: roundProblemsTable.position,
      points: problemsTable.points,
      difficulty: problemsTable.difficulty,
    })
    .from(roundProblemsTable)
    .innerJoin(problemsTable, eq(problemsTable.id, roundProblemsTable.problemId))
    .where(
      inArray(
        roundProblemsTable.roundId,
        ordered.map((round) => round.id),
      ),
    )

  const problemIds = [...new Set(problemRows.map((row) => row.problemId))]
  const translationRows =
    problemIds.length === 0
      ? []
      : await db
          .select({
            problemId: problemTranslationsTable.problemId,
            locale: problemTranslationsTable.locale,
            title: problemTranslationsTable.title,
          })
          .from(problemTranslationsTable)
          .where(inArray(problemTranslationsTable.problemId, problemIds))

  const titlesByProblem = new Map<string, { locale: Locale; title: string }[]>()
  for (const row of translationRows) {
    const titles = titlesByProblem.get(row.problemId) ?? []
    titles.push({ locale: row.locale, title: row.title })
    titlesByProblem.set(row.problemId, titles)
  }

  return ordered.map((round) => ({
    id: round.id,
    name: round.name,
    status: round.status,
    openedAt: round.openedAt,
    closesAt: round.closesAt,
    closedAt: round.closedAt,
    problems: problemRows
      .filter((row) => row.roundId === round.id)
      .sort((a, b) => a.position - b.position)
      .map((row) => ({
        problemId: row.problemId,
        position: row.position,
        letter: positionLabel(row.position),
        points: row.points,
        difficulty: row.difficulty,
        titles: (titlesByProblem.get(row.problemId) ?? [])
          .slice()
          .sort((a, b) => a.locale.localeCompare(b.locale)),
      })),
  }))
}

/**
 * The best attempt of every (team, problem) pair that has one, over the given
 * rounds. `reduceBestPerProblem` is the ranking's own reducer, so "best" here
 * means exactly what it means on the leaderboard: highest score, a tie going
 * to the earliest acceptedAt.
 *
 * Shared by the live teams and the removed ones (`removedTeams[].submissions`)
 * so that both halves of the export are reduced by the same rule — a removed
 * team's history is not a second, looser aggregation.
 */
async function buildSubmissions(
  db: Db,
  rounds: ExportRound[],
  teams: { id: string; name: string }[],
): Promise<ExportSubmission[]> {
  if (rounds.length === 0 || teams.length === 0) return []

  const teamIds = teams.map((team) => team.id)
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]))
  const result: ExportSubmission[] = []

  for (const round of rounds) {
    const problemIds = round.problems.map((problem) => problem.problemId)
    if (problemIds.length === 0) continue

    const rows = await db
      .select({
        teamId: submissionsTable.teamId,
        problemId: submissionsTable.problemId,
        score: submissionsTable.score,
        acceptedAt: submissionsTable.acceptedAt,
        maxScore: submissionsTable.maxScore,
      })
      .from(submissionsTable)
      .where(
        and(
          eq(submissionsTable.roundId, round.id),
          inArray(submissionsTable.problemId, problemIds),
          inArray(submissionsTable.teamId, teamIds),
        ),
      )

    const scoringRows: ScoringRow[] = rows.map((row) => ({
      teamId: row.teamId,
      key: row.problemId,
      score: row.score,
      acceptedAt: row.acceptedAt,
      maxScore: row.maxScore,
    }))
    const best = reduceBestPerProblem(scoringRows, teamIds, problemIds)

    for (const team of teams) {
      const perProblem = best.get(team.id)
      if (!perProblem) continue
      for (const problem of round.problems) {
        const entry = perProblem.get(problem.problemId)
        // A pair with no attempt is not a submission — it is simply absent,
        // instead of a zero row that would inflate every count downstream.
        if (!entry || entry.attempts === 0 || !entry.achievedAt) continue
        result.push({
          teamId: team.id,
          teamName: teamNameById.get(team.id) ?? '',
          roundId: round.id,
          roundName: round.name,
          problemId: problem.problemId,
          letter: problem.letter,
          attempts: entry.attempts,
          bestScore: entry.score,
          bestMaxScore: entry.maxScore,
          bestAcceptedAt: entry.achievedAt,
        })
      }
    }
  }

  return result
}

/**
 * Removed teams, JSON-only by decision: they stay out of the ranking, out of
 * `teams` and out of all three CSVs (which is what keeps the export equal to
 * what /leaderboard and /organizer/teams show), and live here so the export
 * still works as the readable half of the backup.
 *
 * `membersWhoSubmitted` is not a roster: `removeTeam` deletes the team's
 * `team_members` rows, so the roster is gone from the database entirely. What
 * is left is `submissions.userId`, the audit field — whoever never submitted
 * left no trace, and the field is named for what it can honestly deliver.
 */
async function fetchRemovedTeams(db: Db, rounds: ExportRound[]): Promise<ExportRemovedTeam[]> {
  const removed = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      removedAt: teamsTable.removedAt,
    })
    .from(teamsTable)
    .where(isNotNull(teamsTable.removedAt))

  if (removed.length === 0) return []

  const ordered = removed
    .slice()
    .sort((a, b) => (a.removedAt?.getTime() ?? 0) - (b.removedAt?.getTime() ?? 0))
  const removedIds = ordered.map((team) => team.id)

  const submissions = await buildSubmissions(
    db,
    rounds,
    ordered.map((team) => ({ id: team.id, name: team.name })),
  )

  const authorRows = await db
    .selectDistinct({
      teamId: submissionsTable.teamId,
      userId: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      university: usersTable.university,
      role: usersTable.role,
    })
    .from(submissionsTable)
    .innerJoin(usersTable, eq(usersTable.id, submissionsTable.userId))
    .where(inArray(submissionsTable.teamId, removedIds))

  const authorsByTeam = new Map<string, OrganizerTeamMember[]>()
  for (const row of authorRows) {
    const authors = authorsByTeam.get(row.teamId) ?? []
    authors.push({
      userId: row.userId,
      email: row.email,
      name: row.name,
      university: row.university,
      role: row.role,
    })
    authorsByTeam.set(row.teamId, authors)
  }

  return ordered.map((team) => {
    if (!team.removedAt) throw new Error('expected a removed team to have removedAt')
    return {
      id: team.id,
      name: team.name,
      removedAt: team.removedAt,
      membersWhoSubmitted: (authorsByTeam.get(team.id) ?? [])
        .slice()
        .sort((a, b) => a.email.localeCompare(b.email)),
      submissions: submissions.filter((row) => row.teamId === team.id),
    }
  })
}

// --- The three flat tables (#278) ---
//
// Pure functions from here down: they take the EventExport above and return
// a file, with no I/O of their own.

// Semicolon, not RFC4180's comma, and a BOM in front. The audience for these
// files is a human with Excel open: in pt-BR and es-MX the system list
// separator is `;`, so a comma-separated file opened by double-click lands
// entirely in column A — which is exactly what the issue's second criterion
// ("one row per team and one column per problem and per round") forbids. The
// BOM is what stops Excel reading "Mérida" as "MÃ©rida". Whoever consumes this
// by machine uses the JSON, which is lossless and has no dialect.
// Double-click is also why a leading formula character is neutralized — see
// FORMULA_TRIGGER below.
const CSV_DELIMITER = ';'
const CSV_EOL = '\r\n'
// Written via fromCharCode, never as a literal U+FEFF in the source: biome
// rewrites the escape '\uFEFF' into the raw character, which is invisible in
// a diff and in review (same reason as blocks/src/fixtures).
const UTF8_BOM = String.fromCharCode(0xfeff)

// CSV formula injection (CWE-1236, #329). A team name is free text chosen by
// a participant, and Excel and LibreOffice evaluate a cell that starts with
// one of these characters (`=1+1+cmd|'/C calc'!A0`). A leading apostrophe is
// the convention both read as "this is text", so such a field is prefixed
// with `'` and, from there on, always quoted. The scope is deliberately
// narrow — first character only, these six — so every ordinary name stays
// byte for byte what it was. Numeric columns are never negative and dates
// start with the year, so no number can match.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

function escapeCsvField(field: string): string {
  if (FORMULA_TRIGGER.test(field)) return `"'${field.replaceAll('"', '""')}"`
  if (!/[;"\r\n]/.test(field)) return field
  return `"${field.replaceAll('"', '""')}"`
}

/** Rows to a CSV document: BOM, semicolons, CRLF, one terminator per line
 * (the last one included, so appending is never ambiguous). */
export function toCsv(rows: string[][]): string {
  const body = rows.map((row) => row.map(escapeCsvField).join(CSV_DELIMITER) + CSV_EOL).join('')
  return UTF8_BOM + body
}

const YES = 'sim'
const NO = 'nao'

/**
 * One row per team in event-ranking order, one column per round and per
 * problem inside it. A team that never submitted in a round is absent from
 * that round's ranking (#184) and gets zeros, never blanks: a blank cell in
 * Excel reads as "unknown", and this is a known zero.
 */
export function rankingCsvRows(data: EventExport): string[][] {
  const header = ['posicao', 'time', 'pontos', 'tentativas', 'tempo_ms']
  for (const round of data.rounds) {
    header.push(round.name)
    for (const problem of round.problems) header.push(`${round.name} ${problem.letter}`)
  }

  // (roundId → teamId → problemId → score), straight off the per-round
  // rankings, so a cell here is the very number /rounds/:id/ranking serves.
  const scoreByRound = new Map<string, Map<string, Map<string, number>>>()
  for (const round of data.ranking.rounds) {
    const perTeam = new Map<string, Map<string, number>>()
    for (const team of round.teams) {
      perTeam.set(
        team.teamId,
        new Map(team.problems.map((entry) => [entry.problemId, entry.score])),
      )
    }
    scoreByRound.set(round.roundId, perTeam)
  }

  const rows = [header]
  for (const team of data.ranking.event.teams) {
    const row = [
      String(team.rank),
      team.teamName,
      String(team.totalScore),
      String(team.totalAttempts),
      String(team.tiebreakTimeMs),
    ]
    for (const round of data.rounds) {
      const roundEntry = team.rounds.find((entry) => entry.roundId === round.id)
      row.push(String(roundEntry?.score ?? 0))
      const perProblem = scoreByRound.get(round.id)?.get(team.teamId)
      for (const problem of round.problems) {
        row.push(String(perProblem?.get(problem.problemId) ?? 0))
      }
    }
    rows.push(row)
  }
  return rows
}

/** One row per member. A team with no members keeps a row of its own with the
 * member columns empty — otherwise it would silently vanish from the file. */
export function teamsCsvRows(data: EventExport): string[][] {
  const rows = [['time', 'congelado', 'membro', 'email', 'universidade', 'papel']]
  for (const team of data.teams.teams) {
    const frozen = team.frozen ? YES : NO
    if (team.members.length === 0) {
      rows.push([team.name, frozen, '', '', '', ''])
      continue
    }
    for (const member of team.members) {
      rows.push([
        team.name,
        frozen,
        member.name ?? '',
        member.email,
        member.university,
        member.role,
      ])
    }
  }
  return rows
}

/** One row per (team, problem) pair that has at least one attempt. */
export function submissionsCsvRows(data: EventExport): string[][] {
  const rows = [
    [
      'time',
      'rodada',
      'letra',
      'problem_id',
      'tentativas',
      'melhor_score',
      'melhor_maximo',
      'melhor_aceita_em',
    ],
  ]
  for (const row of data.submissions) {
    rows.push([
      row.teamName,
      row.roundName,
      row.letter,
      row.problemId,
      String(row.attempts),
      String(row.bestScore),
      row.bestMaxScore === null ? '' : String(row.bestMaxScore),
      new Date(row.bestAcceptedAt).toISOString(),
    ])
  }
  return rows
}

/**
 * The flat table for one `kind`. All three read only the live halves of the
 * export — `data.teams`, `data.ranking` and `data.submissions` — so a removed
 * team can never reach a CSV: it lives in `removedTeams`, which nothing here
 * touches.
 */
export function buildExportCsv(data: EventExport, kind: ExportCsvKind): string {
  switch (kind) {
    case 'ranking':
      return toCsv(rankingCsvRows(data))
    case 'teams':
      return toCsv(teamsCsvRows(data))
    case 'submissions':
      return toCsv(submissionsCsvRows(data))
  }
}

/** Everything the event produced, in one read-only snapshot. */
export async function getEventExport(db: Db): Promise<EventExport> {
  // getEventRanking reaps an expired round before ranking it, so it runs
  // first: every later read then sees the same, already-settled world.
  const eventRanking = await getEventRanking(db)
  const teams = await listOrganizerTeams(db)
  const rounds = await fetchExportRounds(db)

  const roundRankings = []
  for (const round of rounds) {
    const ranking = await getRoundRanking(db, round.id)
    // Non-draft by construction, so getRoundRanking never returns null here —
    // but a round deleted between the two reads would, and dropping it beats
    // putting a hole in the array.
    if (ranking) roundRankings.push(ranking)
  }

  const activeTeams = await db
    .select({ id: teamsTable.id, name: teamsTable.name })
    .from(teamsTable)
    .where(isNull(teamsTable.removedAt))

  const submissions = await buildSubmissions(db, rounds, activeTeams)
  const removedTeams = await fetchRemovedTeams(db, rounds)

  return {
    generatedAt: new Date(),
    rounds,
    ranking: { event: eventRanking, rounds: roundRankings },
    teams,
    removedTeams,
    submissions,
  }
}
