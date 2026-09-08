import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'
import { requireOrganizer, requireUser } from '../../middlewares/auth'

import {
  CreateTeamBodySchema,
  JoinTeamParamsSchema,
  MoveMemberBodySchema,
  MoveMemberParamsSchema,
  NoContentSchema,
  OrganizerTeamsListSchema,
  RemoveMemberParamsSchema,
  RemoveTeamParamsSchema,
  RenameTeamBodySchema,
  RenameTeamParamsSchema,
  TeamSchema,
  TeamsListSchema,
} from './teams.schema'
import {
  createTeam,
  joinTeam,
  leaveTeam,
  listOrganizerTeams,
  listTeams,
  moveMember,
  removeMember,
  removeTeam,
  renameTeam,
} from './teams.service'

export const createTeamRoute = defineRoute({
  method: 'POST',
  path: '/teams',
  use: [requireUser],
  input: { body: CreateTeamBodySchema },
  output: { 201: TeamSchema, 409: ErrorBodySchema },
  handler: async (c) => {
    const result = await createTeam(c.get('db'), c.get('currentUser').id, c.input.body.name)
    if (result.ok) return c.json(result.team, 201)

    switch (result.error) {
      case 'already_in_team':
        return c.error('already_in_team', 'You already belong to a team', { status: 409 })
      case 'name_taken':
        return c.error('name_taken', 'A team with this name already exists', { status: 409 })
    }
  },
})

export const listTeamsRoute = defineRoute({
  method: 'GET',
  path: '/teams',
  use: [requireUser],
  input: {},
  output: TeamsListSchema,
  handler: async (c) => listTeams(c.get('db'), c.get('currentUser').id),
})

export const joinTeamRoute = defineRoute({
  method: 'POST',
  path: '/teams/:id/join',
  use: [requireUser],
  input: { params: JoinTeamParamsSchema },
  output: { 200: TeamSchema, 404: ErrorBodySchema, 409: ErrorBodySchema },
  handler: async (c) => {
    const result = await joinTeam(c.get('db'), c.get('currentUser').id, c.input.params.id)
    if (result.ok) return c.json(result.team, 200)

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'Team not found', { status: 404 })
      case 'already_in_team':
        return c.error('already_in_team', 'You already belong to a team', { status: 409 })
      case 'team_full':
        return c.error('team_full', 'This team has no open slots', { status: 409 })
      case 'mixed_lock_violation':
        return c.error(
          'mixed_lock_violation',
          'Mixing universities in a team is locked for this event',
          { status: 409 },
        )
    }
  },
})

export const leaveTeamRoute = defineRoute({
  method: 'POST',
  path: '/teams/leave',
  use: [requireUser],
  input: {},
  output: { 204: NoContentSchema, 404: ErrorBodySchema, 409: ErrorBodySchema },
  handler: async (c) => {
    const result = await leaveTeam(c.get('db'), c.get('currentUser').id)
    if (result.ok) return c.json(undefined, 204)

    switch (result.error) {
      case 'not_in_team':
        return c.error('not_in_team', 'You do not belong to a team', { status: 404 })
      case 'team_frozen':
        return c.error(
          'team_frozen',
          'This team has already submitted — contact the organizer to leave',
          { status: 409 },
        )
    }
  },
})

// Organizer moderation (#50) / listing (#51). 401 (requireUser) and 403
// (requireOrganizer) are not declared on any route below — same note as
// problems.route.ts.

export const listOrganizerTeamsRoute = defineRoute({
  method: 'GET',
  path: '/organizer/teams',
  use: [requireUser, requireOrganizer],
  input: {},
  output: OrganizerTeamsListSchema,
  handler: async (c) => listOrganizerTeams(c.get('db')),
})

export const renameTeamRoute = defineRoute({
  method: 'PATCH',
  path: '/organizer/teams/:id',
  use: [requireUser, requireOrganizer],
  input: { params: RenameTeamParamsSchema, body: RenameTeamBodySchema },
  output: { 200: TeamSchema, 404: ErrorBodySchema, 409: ErrorBodySchema },
  handler: async (c) => {
    const result = await renameTeam(c.get('db'), c.input.params.id, c.input.body.name)
    if (result.ok) return c.json(result.team, 200)

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'Team not found', { status: 404 })
      case 'name_taken':
        return c.error('name_taken', 'A team with this name already exists', { status: 409 })
    }
  },
})

export const moveMemberRoute = defineRoute({
  method: 'POST',
  path: '/organizer/teams/members/:userId/move',
  use: [requireUser, requireOrganizer],
  input: { params: MoveMemberParamsSchema, body: MoveMemberBodySchema },
  output: { 204: NoContentSchema, 404: ErrorBodySchema, 409: ErrorBodySchema },
  handler: async (c) => {
    const result = await moveMember(c.get('db'), c.input.params.userId, c.input.body.teamId)
    if (result.ok) return c.json(undefined, 204)

    switch (result.error) {
      case 'member_not_found':
        return c.error('member_not_found', 'This user does not belong to a team', {
          status: 404,
        })
      case 'team_not_found':
        return c.error('team_not_found', 'Destination team not found', { status: 404 })
      case 'team_full':
        return c.error('team_full', 'Destination team has no open slots', { status: 409 })
    }
  },
})

export const removeMemberRoute = defineRoute({
  method: 'DELETE',
  path: '/organizer/teams/members/:userId',
  use: [requireUser, requireOrganizer],
  input: { params: RemoveMemberParamsSchema },
  output: { 204: NoContentSchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const result = await removeMember(c.get('db'), c.input.params.userId)
    if (result.ok) return c.json(undefined, 204)

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'This user does not belong to a team', { status: 404 })
    }
  },
})

export const removeTeamRoute = defineRoute({
  method: 'DELETE',
  path: '/organizer/teams/:id',
  use: [requireUser, requireOrganizer],
  input: { params: RemoveTeamParamsSchema },
  output: { 204: NoContentSchema, 404: ErrorBodySchema },
  handler: async (c) => {
    const result = await removeTeam(c.get('db'), c.input.params.id)
    if (result.ok) return c.json(undefined, 204)

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'Team not found', { status: 404 })
    }
  },
})
