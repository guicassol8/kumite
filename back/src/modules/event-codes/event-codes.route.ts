import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'
import { requireOrganizer, requireUser } from '../../middlewares/auth'

import {
  EventCodeListSchema,
  EventCodeParamsSchema,
  EventCodeSchema,
  UpdateEventCodeBodySchema,
} from './event-codes.schema'
import { listEventCodes, updateEventCode } from './event-codes.service'

export const listEventCodesRoute = defineRoute({
  method: 'GET',
  path: '/organizer/event-codes',
  use: [requireUser, requireOrganizer],
  input: {},
  output: EventCodeListSchema,
  handler: async (c) => listEventCodes(c.get('db')),
})

export const updateEventCodeRoute = defineRoute({
  method: 'PATCH',
  path: '/organizer/event-codes/:university',
  use: [requireUser, requireOrganizer],
  input: { params: EventCodeParamsSchema, body: UpdateEventCodeBodySchema },
  output: { 200: EventCodeSchema, 404: ErrorBodySchema, 409: ErrorBodySchema },
  handler: async (c) => {
    const result = await updateEventCode(c.get('db'), c.input.params.university, c.input.body)
    if (result.ok) return c.json(result.eventCode, 200)

    switch (result.error) {
      case 'not_found':
        return c.error('not_found', 'No event code found for this university', { status: 404 })
      case 'code_taken':
        return c.error('code_taken', 'This code is already in use', { status: 409 })
    }
  },
})
