import { defineRoute } from '../../context'
import { requireOrganizer, requirePasswordUpToDate, requireUser } from '../../middlewares/auth'

import { publishSubmissionsPaused } from '../sse/sse.service'

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
  handler: async (c) => {
    const config = await updateEventConfig(c.get('db'), c.input.body)
    // Announced on every PATCH that carries the flag, changed or not (#285):
    // the front applies it idempotently, so there is no previous value to
    // compare against. Published here, not in the service — services stay pure.
    if (c.input.body.submissionsPaused !== undefined) {
      publishSubmissionsPaused(c.get('sseBus'), config.submissionsPaused)
    }
    return config
  },
})
