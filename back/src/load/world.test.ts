import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app'
import { k } from '../context'
import { resetDatabase } from '../db/reset'
import { roundProblemsTable, roundsTable, teamMembersTable } from '../db/schema'

import { createRecorder } from './recorder'
import { createTransport } from './transport'
import { loginOrganizer, newRunId, roundNameFor, setupWorld, teardownWorld } from './world'

// In-process: app.fetch as the transport, the suite's own test database,
// truncated and seeded before each test the way `pnpm db:reset` does it.

const db = k.resolve('db')
const ORGANIZER = { email: 'load-organizer@edu.pucrs.br', password: 'supersecret' }

beforeEach(async () => {
  process.env['ORGANIZER_EMAIL'] = ORGANIZER.email
  process.env['ORGANIZER_PASSWORD'] = ORGANIZER.password
  await resetDatabase(db)
})

afterAll(async () => {
  await db.$client.end()
})

function harness() {
  const recorder = createRecorder()
  recorder.setPhase('setup')
  const transport = createTransport({
    baseUrl: 'http://localhost',
    recorder,
    requestTimeoutMs: 30_000,
    fetch: async (input, init) => app.request(input, init),
  })
  return { recorder, transport }
}

const BASE = { setupConcurrency: 4, durationSeconds: 30 }

describe('setupWorld', { timeout: 120_000 }, () => {
  it('signs up, logs in and forms the teams, capped at maxTeamSize, and opens its round', async () => {
    const { recorder, transport } = harness()
    const organizerToken = await loginOrganizer(transport, recorder, ORGANIZER)

    const world = await setupWorld({
      transport,
      recorder,
      organizerToken,
      runId: 'runa',
      config: { ...BASE, teams: 2, members: 5, submissions: 1 },
    })

    // The seed's maxTeamSize is 3: five members per team were asked for.
    expect(world.maxTeamSize).toBe(3)
    expect(world.membersPerTeam).toBe(3)
    expect(world.users).toHaveLength(6)
    expect(world.teams.map((team) => team.name)).toEqual(['load-runa-t0', 'load-runa-t1'])
    for (const team of world.teams) {
      expect(team.members.length).toBeLessThanOrEqual(world.maxTeamSize)
      const rows = await db
        .select()
        .from(teamMembersTable)
        .where(eq(teamMembersTable.teamId, team.id))
      expect(rows).toHaveLength(team.members.length)
    }
    expect(world.users.every((user) => user.teamId !== null && user.token.length > 0)).toBe(true)
    expect(world.users[0]?.email).toBe('load-runa-u0@edu.pucrs.br')
    expect(world.before).toEqual({ participants: 0, teams: 0 })

    if (!world.round || !world.problemId) throw new Error('expected a round and a problem')
    expect(world.round.name).toBe(roundNameFor('runa'))
    const [round] = await db.select().from(roundsTable).where(eq(roundsTable.id, world.round.id))
    expect(round?.status).toBe('open')
    const problems = await db
      .select()
      .from(roundProblemsTable)
      .where(eq(roundProblemsTable.roundId, world.round.id))
    expect(problems.map((row) => row.problemId)).toEqual([world.problemId])

    const snapshot = recorder.snapshot()
    expect(snapshot.actions['signup']).toEqual({ started: 6, completed: 6 })
    expect(snapshot.actions['login']).toEqual({ started: 6, completed: 6 })
    expect(snapshot.actions['join-team']).toEqual({ started: 4, completed: 4 })
    expect(snapshot.unexpected).toEqual([])
    expect(snapshot.warnings).toEqual([])

    await teardownWorld({ transport, recorder, organizerToken, round: world.round })
    const [closed] = await db.select().from(roundsTable).where(eq(roundsTable.id, world.round.id))
    expect(closed?.status).toBe('closed')
  })

  it('runs a second time on the same database with another runId, closing the leftover load round', async () => {
    const first = harness()
    const organizerToken = await loginOrganizer(first.transport, first.recorder, ORGANIZER)
    const firstWorld = await setupWorld({
      ...first,
      organizerToken,
      runId: 'runb',
      config: { ...BASE, teams: 1, members: 1, submissions: 1 },
    })
    // No teardown: an aborted run leaves its round open.

    const second = harness()
    const secondWorld = await setupWorld({
      ...second,
      organizerToken,
      runId: newRunId(Date.now() + 1),
      config: { ...BASE, teams: 1, members: 1, submissions: 1 },
    })

    expect(secondWorld.closedLeftoverRounds).toEqual([firstWorld.round?.name])
    expect(secondWorld.before).toEqual({ participants: 1, teams: 1 })
    const warnings = second.recorder.snapshot().warnings
    expect(warnings.some((warning) => warning.includes('not clean'))).toBe(true)
    expect(warnings.some((warning) => warning.includes('load-runb'))).toBe(true)

    const rounds = await db.select().from(roundsTable)
    const open = rounds.filter((round) => round.status === 'open')
    expect(open.map((round) => round.id)).toEqual([secondWorld.round?.id])
  })

  it('refuses to touch an open round that is not the harness’s, naming it', async () => {
    await db.insert(roundsTable).values({
      name: 'Rodada 1',
      durationMinutes: 60,
      status: 'open',
      openedAt: new Date(),
      closesAt: new Date(Date.now() + 3_600_000),
    })
    const { recorder, transport } = harness()
    const organizerToken = await loginOrganizer(transport, recorder, ORGANIZER)

    await expect(
      setupWorld({
        transport,
        recorder,
        organizerToken,
        runId: 'runc',
        config: { ...BASE, teams: 1, members: 1, submissions: 1 },
      }),
    ).rejects.toThrow('"Rodada 1"')
  })

  it('opens no round when the run has no submissions', async () => {
    const { recorder, transport } = harness()
    const organizerToken = await loginOrganizer(transport, recorder, ORGANIZER)

    const world = await setupWorld({
      transport,
      recorder,
      organizerToken,
      runId: 'rund',
      config: { ...BASE, teams: 1, members: 2, submissions: 0 },
    })

    expect(world.round).toBeNull()
    expect(world.problemId).toBeNull()
    expect(world.users).toHaveLength(2)
  })
})
