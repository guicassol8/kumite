import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../db/client'
import {
  eventConfigTable,
  problemsTable,
  problemTranslationsTable,
  roundProblemsTable,
  roundsTable,
  submissionsTable,
  teamMembersTable,
  teamsTable,
  usersTable,
} from '../../db/schema'
import { getEventRanking, getRoundRanking } from '../ranking/ranking.service'
import { listOrganizerTeams, removeTeam } from '../teams/teams.service'
import type { Role, University } from '../users/users.schema'

import type { EventExport } from './export.schema'
import { buildExportCsv, getEventExport } from './export.service'

// Runs against the real Postgres (same as the other DB-backed service
// suites): the whole point of this module is that it agrees with the queries
// /leaderboard and /organizer/teams already run, and a mocked db would only
// prove it agrees with itself.
const db = createDb()

beforeEach(async () => {
  await db.execute(
    sql`truncate table ${submissionsTable}, ${roundProblemsTable}, ${roundsTable}, ${problemTranslationsTable}, ${problemsTable}, ${teamMembersTable}, ${teamsTable}, ${eventConfigTable}, ${usersTable} restart identity cascade`,
  )
})

afterAll(async () => {
  await db.$client.end()
})

let userCounter = 0

async function insertUser(options: { university?: University; role?: Role; name?: string } = {}) {
  userCounter += 1
  const [user] = await db
    .insert(usersTable)
    .values({
      email: `export-fixture-${userCounter}@edu.pucrs.br`,
      name: options.name ?? `Export Fixture ${userCounter}`,
      passwordHash: 'hash',
      role: options.role ?? 'participant',
      university: options.university ?? 'pucrs',
    })
    .returning()
  if (!user) throw new Error('expected a user fixture')
  return user
}

async function insertTeam(name: string) {
  const [team] = await db.insert(teamsTable).values({ name }).returning()
  if (!team) throw new Error('expected a team fixture')
  return team
}

async function joinTeam(userId: string, teamId: string) {
  await db.insert(teamMembersTable).values({ userId, teamId })
}

async function insertProblem(titles: Record<string, string>, points = 100) {
  const [problem] = await db
    .insert(problemsTable)
    .values({ difficulty: 'easy', status: 'published', points })
    .returning()
  if (!problem) throw new Error('expected a problem fixture')
  for (const [locale, title] of Object.entries(titles)) {
    await db.insert(problemTranslationsTable).values({
      problemId: problem.id,
      locale: locale as 'pt' | 'es' | 'en',
      title,
      statementMd: '# enunciado',
    })
  }
  return problem
}

async function insertRound(
  name: string,
  fields: Partial<typeof roundsTable.$inferInsert> = {},
): Promise<typeof roundsTable.$inferSelect> {
  const [round] = await db
    .insert(roundsTable)
    .values({ name, durationMinutes: 60, ...fields })
    .returning()
  if (!round) throw new Error('expected a round fixture')
  return round
}

async function addRoundProblem(roundId: string, problemId: string, position = 0) {
  await db.insert(roundProblemsTable).values({ roundId, problemId, position })
}

let attemptCounter = 0

async function submit(options: {
  problemId: string
  roundId: string
  teamId: string
  userId: string
  score: number
  acceptedAt: Date
  maxScore?: number | null
}) {
  attemptCounter += 1
  await db.insert(submissionsTable).values({
    problemId: options.problemId,
    roundId: options.roundId,
    teamId: options.teamId,
    userId: options.userId,
    workspace: {},
    generatedCode: '',
    caseResults: [],
    score: options.score,
    maxScore: options.maxScore === undefined ? 100 : options.maxScore,
    hiddenCaseCount: 2,
    attemptNumber: attemptCounter,
    acceptedAt: options.acceptedAt,
  })
}

// A closed round that actually opened — the ranking refuses to score a round
// without openedAt, so every fixture round carries one.
function closedRoundFields(openedAt: Date) {
  return {
    status: 'closed' as const,
    openedAt,
    closesAt: new Date(openedAt.getTime() + 3_600_000),
    closedAt: new Date(openedAt.getTime() + 3_600_000),
  }
}

describe('getEventExport', () => {
  it('returns a valid, empty export when the event has nothing in it', async () => {
    const data = await getEventExport(db)

    expect(data.rounds).toEqual([])
    expect(data.submissions).toEqual([])
    expect(data.removedTeams).toEqual([])
    expect(data.ranking.rounds).toEqual([])
    expect(data.ranking.event.teams).toEqual([])
    expect(data.teams.teams).toEqual([])
    expect(data.generatedAt).toBeInstanceOf(Date)
  })

  it('agrees cell for cell with the ranking and the organizer team listing', async () => {
    const user = await insertUser()
    const team = await insertTeam('Time Coerente')
    await joinTeam(user.id, team.id)
    const problem = await insertProblem({ pt: 'Soma', es: 'Suma', en: 'Sum' })
    const round = await insertRound('Rodada 1', closedRoundFields(new Date('2026-09-01T10:00:00Z')))
    await addRoundProblem(round.id, problem.id)
    await submit({
      problemId: problem.id,
      roundId: round.id,
      teamId: team.id,
      userId: user.id,
      score: 80,
      acceptedAt: new Date('2026-09-01T10:10:00Z'),
    })

    const data = await getEventExport(db)

    expect(data.ranking.event).toEqual(await getEventRanking(db))
    expect(data.ranking.rounds).toHaveLength(1)
    expect(data.ranking.rounds[0]).toEqual(await getRoundRanking(db, round.id))
    expect(data.teams).toEqual(await listOrganizerTeams(db))
  })

  it('describes each round with its problems, letters and every title', async () => {
    const problemA = await insertProblem({ pt: 'Alfa', es: 'Alfa', en: 'Alpha' }, 50)
    const problemB = await insertProblem({ pt: 'Beta', es: 'Beta', en: 'Beta' })
    const round = await insertRound('Rodada 1', closedRoundFields(new Date('2026-09-01T10:00:00Z')))
    await addRoundProblem(round.id, problemA.id, 0)
    await addRoundProblem(round.id, problemB.id, 1)

    const data = await getEventExport(db)

    expect(data.rounds).toHaveLength(1)
    expect(data.rounds[0]?.name).toBe('Rodada 1')
    expect(data.rounds[0]?.problems.map((problem) => problem.letter)).toEqual(['A', 'B'])
    expect(data.rounds[0]?.problems[0]?.points).toBe(50)
    expect(data.rounds[0]?.problems[0]?.titles).toEqual(
      expect.arrayContaining([
        { locale: 'pt', title: 'Alfa' },
        { locale: 'es', title: 'Alfa' },
        { locale: 'en', title: 'Alpha' },
      ]),
    )
  })

  it('orders rounds chronologically and leaves draft rounds out', async () => {
    const problem = await insertProblem({ pt: 'Soma', es: 'Suma', en: 'Sum' })
    const second = await insertRound(
      'Rodada 2',
      closedRoundFields(new Date('2026-09-02T10:00:00Z')),
    )
    const first = await insertRound('Rodada 1', closedRoundFields(new Date('2026-09-01T10:00:00Z')))
    const draft = await insertRound('Rascunho')
    await addRoundProblem(first.id, problem.id)
    await addRoundProblem(second.id, problem.id)
    await addRoundProblem(draft.id, problem.id)

    const data = await getEventExport(db)

    expect(data.rounds.map((round) => round.name)).toEqual(['Rodada 1', 'Rodada 2'])
    expect(data.ranking.rounds.map((round) => round.roundName)).toEqual(['Rodada 1', 'Rodada 2'])
  })

  it('counts every attempt but keeps the best one, ties going to the earliest', async () => {
    const user = await insertUser()
    const team = await insertTeam('Time Tentativas')
    await joinTeam(user.id, team.id)
    const problem = await insertProblem({ pt: 'Soma', es: 'Suma', en: 'Sum' })
    const round = await insertRound('Rodada 1', closedRoundFields(new Date('2026-09-01T10:00:00Z')))
    await addRoundProblem(round.id, problem.id)
    const best = new Date('2026-09-01T10:05:00Z')
    await submit({
      problemId: problem.id,
      roundId: round.id,
      teamId: team.id,
      userId: user.id,
      score: 90,
      acceptedAt: best,
    })
    await submit({
      problemId: problem.id,
      roundId: round.id,
      teamId: team.id,
      userId: user.id,
      score: 40,
      acceptedAt: new Date('2026-09-01T10:20:00Z'),
    })

    const data = await getEventExport(db)

    expect(data.submissions).toHaveLength(1)
    expect(data.submissions[0]).toMatchObject({
      teamId: team.id,
      teamName: 'Time Tentativas',
      roundId: round.id,
      roundName: 'Rodada 1',
      problemId: problem.id,
      letter: 'A',
      attempts: 2,
      bestScore: 90,
      bestMaxScore: 100,
    })
    expect(data.submissions[0]?.bestAcceptedAt.toISOString()).toBe(best.toISOString())
  })

  it('breaks a score tie by the earliest acceptedAt, like the ranking does', async () => {
    const user = await insertUser()
    const team = await insertTeam('Time Empate')
    await joinTeam(user.id, team.id)
    const problem = await insertProblem({ pt: 'Soma', es: 'Suma', en: 'Sum' })
    const round = await insertRound('Rodada 1', closedRoundFields(new Date('2026-09-01T10:00:00Z')))
    await addRoundProblem(round.id, problem.id)
    const earliest = new Date('2026-09-01T10:05:00Z')
    await submit({
      problemId: problem.id,
      roundId: round.id,
      teamId: team.id,
      userId: user.id,
      score: 70,
      acceptedAt: new Date('2026-09-01T10:30:00Z'),
    })
    await submit({
      problemId: problem.id,
      roundId: round.id,
      teamId: team.id,
      userId: user.id,
      score: 70,
      acceptedAt: earliest,
    })

    const data = await getEventExport(db)

    expect(data.submissions[0]?.attempts).toBe(2)
    expect(data.submissions[0]?.bestAcceptedAt.toISOString()).toBe(earliest.toISOString())
  })

  it('omits a (team, problem) pair that was never attempted', async () => {
    const user = await insertUser()
    const team = await insertTeam('Time Parcial')
    await joinTeam(user.id, team.id)
    const attempted = await insertProblem({ pt: 'Soma', es: 'Suma', en: 'Sum' })
    const untouched = await insertProblem({ pt: 'Fatorial', es: 'Factorial', en: 'Factorial' })
    const round = await insertRound('Rodada 1', closedRoundFields(new Date('2026-09-01T10:00:00Z')))
    await addRoundProblem(round.id, attempted.id, 0)
    await addRoundProblem(round.id, untouched.id, 1)
    await submit({
      problemId: attempted.id,
      roundId: round.id,
      teamId: team.id,
      userId: user.id,
      score: 100,
      acceptedAt: new Date('2026-09-01T10:05:00Z'),
    })

    const data = await getEventExport(db)

    expect(data.submissions.map((row) => row.problemId)).toEqual([attempted.id])
  })

  describe('removed teams', () => {
    // The whole point of this section: removeTeam deletes team_members, so
    // going through the real service (never a hand-written UPDATE) is what
    // makes the fixture honest about what the database still holds.
    async function scenario() {
      const submitter = await insertUser({ name: 'Quem Submeteu' })
      const silent = await insertUser({ name: 'Quem Nunca Submeteu' })
      const removed = await insertTeam('Time Removido')
      await joinTeam(submitter.id, removed.id)
      await joinTeam(silent.id, removed.id)

      const survivor = await insertUser({ name: 'Time Vivo' })
      const kept = await insertTeam('Time Mantido')
      await joinTeam(survivor.id, kept.id)

      const problem = await insertProblem({ pt: 'Soma', es: 'Suma', en: 'Sum' })
      const round = await insertRound(
        'Rodada 1',
        closedRoundFields(new Date('2026-09-01T10:00:00Z')),
      )
      await addRoundProblem(round.id, problem.id)
      await submit({
        problemId: problem.id,
        roundId: round.id,
        teamId: removed.id,
        userId: submitter.id,
        score: 100,
        acceptedAt: new Date('2026-09-01T10:05:00Z'),
      })
      await submit({
        problemId: problem.id,
        roundId: round.id,
        teamId: kept.id,
        userId: survivor.id,
        score: 60,
        acceptedAt: new Date('2026-09-01T10:06:00Z'),
      })

      const result = await removeTeam(db, removed.id)
      expect(result.ok).toBe(true)

      return { removed, kept, problem, round, submitter, silent }
    }

    it('keeps a removed team out of the teams listing, the ranking and the submissions', async () => {
      const { removed, kept } = await scenario()

      const data = await getEventExport(db)

      expect(data.teams.teams.map((team) => team.id)).toEqual([kept.id])
      expect(data.ranking.event.teams.map((team) => team.teamId)).toEqual([kept.id])
      expect(data.ranking.rounds[0]?.teams.map((team) => team.teamId)).toEqual([kept.id])
      expect(data.submissions.map((row) => row.teamId)).toEqual([kept.id])
      expect(JSON.stringify(data.submissions)).not.toContain(removed.id)
    })

    it('preserves the removed team, its submissions and whoever submitted for it', async () => {
      const { removed, round, problem, submitter } = await scenario()

      const data = await getEventExport(db)

      expect(data.removedTeams).toHaveLength(1)
      const entry = data.removedTeams[0]
      expect(entry?.id).toBe(removed.id)
      expect(entry?.name).toBe('Time Removido')
      expect(entry?.removedAt).toBeInstanceOf(Date)
      expect(entry?.submissions).toHaveLength(1)
      expect(entry?.submissions[0]).toMatchObject({
        teamId: removed.id,
        roundId: round.id,
        problemId: problem.id,
        letter: 'A',
        attempts: 1,
        bestScore: 100,
      })
      expect(entry?.membersWhoSubmitted.map((member) => member.userId)).toEqual([submitter.id])
      expect(entry?.membersWhoSubmitted[0]?.email).toBe(submitter.email)
    })

    it('cannot recover a member who never submitted — the roster is gone with team_members', async () => {
      const { removed, silent } = await scenario()

      const data = await getEventExport(db)

      // Not a bug in the aggregator: removeTeam deleted the membership row, so
      // this participant left no trace anywhere. The field is named
      // `membersWhoSubmitted` precisely so the export does not promise a
      // roster the database no longer has.
      expect(
        data.removedTeams[0]?.membersWhoSubmitted.map((member) => member.userId),
      ).not.toContain(silent.id)
      const membership = await db
        .select()
        .from(teamMembersTable)
        .where(eq(teamMembersTable.teamId, removed.id))
      expect(membership).toEqual([])
    })
  })
})

// --- The three flat tables (#278) ---
//
// Pure functions over an EventExport: no database, so every case below is
// about the shape of the file an organizer opens in Excel, not about SQL.

// Written via fromCharCode, never as a literal U+FEFF in the source: biome
// rewrites the escape '\uFEFF' into the raw character, which is invisible in
// a diff and in review (same reason as blocks/src/fixtures).
const BOM = String.fromCharCode(0xfeff)
const CRLF = '\r\n'

function emptyExport(): EventExport {
  return {
    generatedAt: new Date('2026-09-20T12:00:00Z'),
    rounds: [],
    ranking: { event: { teams: [] }, rounds: [] },
    teams: { maxTeamSize: 3, teams: [] },
    removedTeams: [],
    submissions: [],
  }
}

// Two rounds — one with two problems, one with three — and two teams, of
// which the second never submitted in the first round. That is the smallest
// fixture that exercises both the column layout and the missing-cell rule.
function populatedExport(): EventExport {
  const roundOne = {
    id: 'round-1',
    name: 'Rodada 1',
    status: 'closed' as const,
    openedAt: new Date('2026-09-01T10:00:00Z'),
    closesAt: new Date('2026-09-01T11:00:00Z'),
    closedAt: new Date('2026-09-01T11:00:00Z'),
    problems: [
      {
        problemId: 'p1',
        position: 0,
        letter: 'A',
        points: 100,
        difficulty: 'easy' as const,
        titles: [{ locale: 'pt' as const, title: 'Soma' }],
      },
      {
        problemId: 'p2',
        position: 1,
        letter: 'B',
        points: 100,
        difficulty: 'medium' as const,
        titles: [{ locale: 'pt' as const, title: 'Fatorial' }],
      },
    ],
  }
  const roundTwo = {
    ...roundOne,
    id: 'round-2',
    name: 'Rodada 2',
    problems: [
      ...roundOne.problems,
      {
        problemId: 'p3',
        position: 2,
        letter: 'C',
        points: 100,
        difficulty: 'hard' as const,
        titles: [{ locale: 'pt' as const, title: 'Grafos' }],
      },
    ],
  }

  return {
    generatedAt: new Date('2026-09-20T12:00:00Z'),
    rounds: [roundOne, roundTwo],
    ranking: {
      event: {
        teams: [
          {
            teamId: 't1',
            teamName: 'Time Um',
            rank: 1,
            totalScore: 180,
            totalAttempts: 3,
            tiebreakTimeMs: 600000,
            rounds: [
              {
                roundId: 'round-1',
                roundName: 'Rodada 1',
                score: 100,
                attempts: 1,
                tiebreakTimeMs: 300000,
              },
              {
                roundId: 'round-2',
                roundName: 'Rodada 2',
                score: 80,
                attempts: 2,
                tiebreakTimeMs: 300000,
              },
            ],
          },
          {
            teamId: 't2',
            teamName: 'Time; Dois',
            rank: 2,
            totalScore: 50,
            totalAttempts: 1,
            tiebreakTimeMs: 120000,
            rounds: [
              {
                roundId: 'round-1',
                roundName: 'Rodada 1',
                score: 0,
                attempts: 0,
                tiebreakTimeMs: 0,
              },
              {
                roundId: 'round-2',
                roundName: 'Rodada 2',
                score: 50,
                attempts: 1,
                tiebreakTimeMs: 120000,
              },
            ],
          },
        ],
      },
      rounds: [
        {
          roundId: 'round-1',
          roundName: 'Rodada 1',
          problemIds: ['p1', 'p2'],
          denominators: 'consistent' as const,
          // Team 2 never submitted in this round, so #184 leaves it out here.
          teams: [
            {
              teamId: 't1',
              teamName: 'Time Um',
              rank: 1,
              totalScore: 100,
              totalAttempts: 1,
              tiebreakTimeMs: 300000,
              problems: [
                { problemId: 'p1', score: 100, attempts: 1, maxScore: 100 },
                { problemId: 'p2', score: 0, attempts: 0, maxScore: null },
              ],
            },
          ],
        },
        {
          roundId: 'round-2',
          roundName: 'Rodada 2',
          problemIds: ['p1', 'p2', 'p3'],
          denominators: 'consistent' as const,
          teams: [
            {
              teamId: 't1',
              teamName: 'Time Um',
              rank: 1,
              totalScore: 80,
              totalAttempts: 2,
              tiebreakTimeMs: 300000,
              problems: [
                { problemId: 'p1', score: 30, attempts: 1, maxScore: 100 },
                { problemId: 'p2', score: 50, attempts: 1, maxScore: 100 },
                { problemId: 'p3', score: 0, attempts: 0, maxScore: null },
              ],
            },
            {
              teamId: 't2',
              teamName: 'Time; Dois',
              rank: 2,
              totalScore: 50,
              totalAttempts: 1,
              tiebreakTimeMs: 120000,
              problems: [
                { problemId: 'p1', score: 0, attempts: 0, maxScore: null },
                { problemId: 'p2', score: 0, attempts: 0, maxScore: null },
                { problemId: 'p3', score: 50, attempts: 1, maxScore: 100 },
              ],
            },
          ],
        },
      ],
    },
    teams: {
      maxTeamSize: 3,
      teams: [
        {
          id: 't1',
          name: 'Time Um',
          frozen: true,
          slotsAvailable: 1,
          members: [
            {
              userId: 'u1',
              email: 'um@edu.pucrs.br',
              name: 'Ana "A" Silva',
              university: 'pucrs' as const,
              role: 'participant' as const,
            },
            {
              userId: 'u2',
              email: 'dois@merida.mx',
              name: 'Beto\nQuebra',
              university: 'merida' as const,
              role: 'participant' as const,
            },
          ],
        },
        {
          id: 't2',
          name: 'Time; Dois',
          frozen: false,
          slotsAvailable: 3,
          // A team with no members at all must still appear in the file.
          members: [],
        },
      ],
    },
    removedTeams: [
      {
        id: 't3',
        name: 'Time Fantasma',
        removedAt: new Date('2026-09-10T12:00:00Z'),
        membersWhoSubmitted: [
          {
            userId: 'u9',
            email: 'fantasma@edu.pucrs.br',
            name: 'Carlos Fantasma',
            university: 'pucrs' as const,
            role: 'participant' as const,
          },
        ],
        submissions: [
          {
            teamId: 't3',
            teamName: 'Time Fantasma',
            roundId: 'round-1',
            roundName: 'Rodada 1',
            problemId: 'p1',
            letter: 'A',
            attempts: 1,
            bestScore: 100,
            bestMaxScore: 100,
            bestAcceptedAt: new Date('2026-09-01T10:05:00Z'),
          },
        ],
      },
    ],
    submissions: [
      {
        teamId: 't1',
        teamName: 'Time Um',
        roundId: 'round-1',
        roundName: 'Rodada 1',
        problemId: 'p1',
        letter: 'A',
        attempts: 1,
        bestScore: 100,
        bestMaxScore: 100,
        bestAcceptedAt: new Date('2026-09-01T10:05:00Z'),
      },
      {
        teamId: 't2',
        teamName: 'Time; Dois',
        roundId: 'round-2',
        roundName: 'Rodada 2',
        problemId: 'p3',
        letter: 'C',
        attempts: 1,
        bestScore: 50,
        bestMaxScore: 100,
        bestAcceptedAt: new Date('2026-09-02T10:05:00Z'),
      },
    ],
  }
}

/** The file's data lines, with the BOM and the trailing terminator removed —
 * the two things every assertion below would otherwise have to restate. */
function lines(csv: string): string[] {
  expect(csv.startsWith(BOM)).toBe(true)
  expect(csv.endsWith(CRLF)).toBe(true)
  return csv.slice(BOM.length, -CRLF.length).split(CRLF)
}

describe('buildExportCsv', () => {
  it('writes a UTF-8 BOM, CRLF terminators and semicolon-separated fields', () => {
    const csv = buildExportCsv(populatedExport(), 'ranking')

    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain(CRLF)
    expect(lines(csv)[0]?.startsWith('posicao;time;pontos;tentativas;tempo_ms')).toBe(true)
  })

  it('quotes a field containing the delimiter and doubles an inner quote', () => {
    const teams = buildExportCsv(populatedExport(), 'teams')

    // "Time; Dois" would otherwise split into two columns.
    expect(teams).toContain('"Time; Dois"')
    expect(teams).toContain('"Ana ""A"" Silva"')
  })

  it('keeps a field with a line break inside one quoted cell', () => {
    const teams = buildExportCsv(populatedExport(), 'teams')

    expect(teams).toContain('"Beto\nQuebra"')
    // The embedded LF must not be mistaken for a row terminator: the file
    // still has exactly one line per member plus the header.
    expect(lines(teams)).toHaveLength(4)
  })

  it('lays out one column per round and per problem, with zeros where a team did not submit', () => {
    const csv = buildExportCsv(populatedExport(), 'ranking')
    const rows = lines(csv)

    // 5 fixed columns + (1 round column + 2 problems) + (1 round column + 3 problems).
    expect(rows[0]).toBe(
      'posicao;time;pontos;tentativas;tempo_ms;Rodada 1;Rodada 1 A;Rodada 1 B;Rodada 2;Rodada 2 A;Rodada 2 B;Rodada 2 C',
    )
    expect(rows[1]).toBe('1;Time Um;180;3;600000;100;100;0;80;30;50;0')
    // Team 2 is absent from round 1's ranking (#184): every cell of that round
    // is a zero, not an empty cell that Excel would show as blank.
    expect(rows[2]).toBe('2;"Time; Dois";50;1;120000;0;0;0;50;0;0;50')
    expect(rows).toHaveLength(3)
  })

  it('writes one row per member and keeps a team with no members', () => {
    const rows = lines(buildExportCsv(populatedExport(), 'teams'))

    expect(rows[0]).toBe('time;congelado;membro;email;universidade;papel')
    expect(rows[1]).toBe('Time Um;sim;"Ana ""A"" Silva";um@edu.pucrs.br;pucrs;participant')
    expect(rows[3]).toBe('"Time; Dois";nao;;;;')
  })

  it('writes one row per (team, problem) pair that has attempts', () => {
    const rows = lines(buildExportCsv(populatedExport(), 'submissions'))

    expect(rows[0]).toBe(
      'time;rodada;letra;problem_id;tentativas;melhor_score;melhor_maximo;melhor_aceita_em',
    )
    expect(rows[1]).toBe('Time Um;Rodada 1;A;p1;1;100;100;2026-09-01T10:05:00.000Z')
    expect(rows).toHaveLength(3)
  })

  it('never names a removed team in any of the three tables', () => {
    const data = populatedExport()

    for (const kind of ['ranking', 'teams', 'submissions'] as const) {
      expect(buildExportCsv(data, kind)).not.toContain('Time Fantasma')
    }
    // It is in the JSON, though — that is the whole point of the section.
    expect(data.removedTeams[0]?.name).toBe('Time Fantasma')
  })

  it('still produces a valid file with only a header when the event is empty', () => {
    for (const kind of ['ranking', 'teams', 'submissions'] as const) {
      const rows = lines(buildExportCsv(emptyExport(), kind))
      expect(rows).toHaveLength(1)
      expect(rows[0]?.length).toBeGreaterThan(0)
    }
  })
})

// --- CSV formula injection (#329, CWE-1236) ---

// `populatedExport` with free text an attacker controls: team 1 renamed to a
// formula, round 1 renamed to one (the organizer's own text, which also lands
// in the ranking header), and team 1's roster replaced by one member per
// trigger character plus the mixed and mid-field cases.
function hostileExport(): EventExport {
  const data = populatedExport()
  const TEAM = '=1+1'
  const ROUND = '=Rodada'

  for (const team of data.ranking.event.teams) {
    if (team.teamId === 't1') team.teamName = TEAM
    for (const round of team.rounds) if (round.roundId === 'round-1') round.roundName = ROUND
  }
  for (const round of data.ranking.rounds) {
    if (round.roundId === 'round-1') round.roundName = ROUND
    for (const team of round.teams) if (team.teamId === 't1') team.teamName = TEAM
  }
  const roundOne = data.rounds.find((round) => round.id === 'round-1')
  if (roundOne) roundOne.name = ROUND
  for (const row of data.submissions) {
    if (row.teamId === 't1') row.teamName = TEAM
    if (row.roundId === 'round-1') row.roundName = ROUND
  }

  const teamOne = data.teams.teams.find((team) => team.id === 't1')
  if (teamOne) {
    teamOne.name = TEAM
    const member = (userId: string, name: string, email = `${userId}@edu.pucrs.br`) => ({
      userId,
      email,
      name,
      university: 'pucrs' as const,
      role: 'participant' as const,
    })
    teamOne.members = [
      member('m-plus', '+soma'),
      member('m-minus', '-menos'),
      member('m-at', '@arroba'),
      member('m-tab', '\tTab'),
      member('m-cr', '\rCR'),
      member('m-quote', '=x"y'),
      member('m-semi', '=1;2'),
      member('m-mid', 'Time-Um'),
      member('m-mid-eq', 'a=b', 'x@y.com'),
    ]
  }
  return data
}

/** A minimal reader for this dialect (`;`, CRLF, `"` quoting with `""` as an
 * inner quote), so the column-count criterion is checked by a parser that
 * honours quotes rather than by splitting on `;`. */
function parseCsv(csv: string): string[][] {
  const text = csv.startsWith(BOM) ? csv.slice(BOM.length) : csv
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ';') {
      row.push(field)
      field = ''
    } else if (char === '\r' && text[i + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
    } else field += char
  }
  if (field !== '' || row.length > 0) rows.push([...row, field])
  return rows
}

describe('buildExportCsv — formula injection (#329)', () => {
  it('prefixes a team name starting with = with an apostrophe and quotes it, in all three kinds', () => {
    const data = hostileExport()

    for (const kind of ['ranking', 'teams', 'submissions'] as const) {
      const csv = buildExportCsv(data, kind)
      expect(csv).toContain(`"'=1+1"`)
      // No cell may start with the bare formula.
      for (const row of parseCsv(csv)) expect(row).not.toContain('=1+1')
    }
  })

  it('protects a round name in the ranking header and in the submissions round column', () => {
    const data = hostileExport()

    expect(lines(buildExportCsv(data, 'ranking'))[0]).toBe(
      `posicao;time;pontos;tentativas;tempo_ms;"'=Rodada";"'=Rodada A";"'=Rodada B";Rodada 2;Rodada 2 A;Rodada 2 B;Rodada 2 C`,
    )
    expect(lines(buildExportCsv(data, 'submissions'))[1]).toBe(
      `"'=1+1";"'=Rodada";A;p1;1;100;100;2026-09-01T10:05:00.000Z`,
    )
  })

  it.each([
    ['+', '+soma'],
    ['-', '-menos'],
    ['@', '@arroba'],
    ['TAB', '\tTab'],
    ['CR', '\rCR'],
  ])('prefixes a field starting with %s', (_label, name) => {
    expect(buildExportCsv(hostileExport(), 'teams')).toContain(`;"'${name}";`)
  })

  it('keeps quote doubling when a field both starts with a trigger and contains a quote', () => {
    expect(buildExportCsv(hostileExport(), 'teams')).toContain(`;"'=x""y";`)
  })

  it('keeps delimiter quoting when a field both starts with a trigger and contains ;', () => {
    const data = hostileExport()
    expect(buildExportCsv(data, 'teams')).toContain(`;"'=1;2";`)

    // A quote-aware parser sees the same column count on every line.
    for (const kind of ['ranking', 'teams', 'submissions'] as const) {
      const rows = parseCsv(buildExportCsv(data, kind))
      const width = rows[0]?.length ?? 0
      expect(width).toBeGreaterThan(0)
      for (const row of rows) expect(row).toHaveLength(width)
    }
    const members = parseCsv(buildExportCsv(data, 'teams')).map((row) => row[2])
    expect(members).toContain("'=1;2")
    expect(members).toContain('\'=x"y')
  })

  it('leaves a trigger character in the middle of a field untouched', () => {
    const csv = buildExportCsv(hostileExport(), 'teams')

    expect(csv).toContain(';Time-Um;m-mid@edu.pucrs.br;pucrs;participant\r\n')
    expect(csv).toContain(';a=b;x@y.com;pucrs;participant\r\n')
  })
})
