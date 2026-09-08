import { defineRoute } from '../../context'
import { requireOrganizer, requirePasswordUpToDate, requireUser } from '../../middlewares/auth'

import { EventConfigSchema, UpdateEventConfigBodySchema } from './event-config.schema'
import { getOrCreateEventConfig, updateEventConfig } from './event-config.service'

export const getEventConfigRoute = defineRoute({
  method: 'GET',
  path: '/organizer/event-config',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: {},
  output: EventConfigSchema,
  handler: async (c) => getOrCreateEventConfig(c.get('db')),
})

export const updateEventConfigRoute = defineRoute({
  method: 'PATCH',
  path: '/organizer/event-config',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: { body: UpdateEventConfigBodySchema },
  output: EventConfigSchema,
  handler: async (c) => updateEventConfig(c.get('db'), c.input.body),
})
