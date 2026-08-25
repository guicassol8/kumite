import { ErrorBodySchema } from '@katajs-framework/core'

import { defineRoute } from '../../context'

import { CreateGreetingBodySchema, GreetingParamsSchema, GreetingSchema } from './greetings.schema'
import { createGreeting, getGreeting } from './greetings.service'

// POST /greetings — validates the JSON body against CreateGreetingBodySchema
// (ADR-0003) before the handler runs, then returns the created greeting.
export const createGreetingRoute = defineRoute({
  method: 'POST',
  path: '/greetings',
  input: { body: CreateGreetingBodySchema },
  output: GreetingSchema,
  handler: (c) => createGreeting(c.input.body),
})

// GET /greetings/:id — validates the path param, then reads the greeting back.
// A miss returns the unified ADR-0008 error envelope with a 404, declared
// alongside the 200 body so c.error type-checks (ADR-0011).
export const getGreetingRoute = defineRoute({
  method: 'GET',
  path: '/greetings/:id',
  input: { params: GreetingParamsSchema },
  output: { 200: GreetingSchema, 404: ErrorBodySchema },
  handler: (c) => {
    const greeting = getGreeting(c.input.params.id)
    if (!greeting) return c.error('not_found', 'Greeting not found', { status: 404 })
    return greeting
  },
})
