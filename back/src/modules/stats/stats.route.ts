import { defineRoute } from '../../context'
import { requireOrganizer, requirePasswordUpToDate, requireUser } from '../../middlewares/auth'

import { EventStatsSchema, LiveStatsSchema } from './stats.schema'
import { getEventStats, getLiveStats } from './stats.service'

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

// Polled every 5 s by the organizer's live card (#279). The handler reads
// process memory only; the one query per request is requireUser's lookup.
export const getLiveStatsRoute = defineRoute({
  method: 'GET',
  path: '/organizer/stats/live',
  use: [requireUser, requirePasswordUpToDate, requireOrganizer],
  input: {},
  output: LiveStatsSchema,
  handler: async (c) => getLiveStats(c.get('sseBus')),
})
