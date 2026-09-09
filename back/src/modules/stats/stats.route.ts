import { defineRoute } from '../../context'
import { requireOrganizer, requirePasswordUpToDate, requireUser } from '../../middlewares/auth'

import { EventStatsSchema } from './stats.schema'
import { getEventStats } from './stats.service'

// 401/403 aren't declared: both are middleware short-circuits, never this
// handler's own outcomes (ADR-0011), same as every other organizer route.
export const getEventStatsRoute = defineRoute({
  method: 'GET',
  path: '/organizer/stats',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: {},
  output: EventStatsSchema,
  handler: async (c) => getEventStats(c.get('db')),
})
