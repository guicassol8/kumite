import { defineRoute } from '../../context'
import { requireUser } from '../../middlewares/auth'

import { PublicUserSchema } from './users.schema'

export const meRoute = defineRoute({
  method: 'GET',
  path: '/me',
  use: [requireUser],
  input: {},
  output: PublicUserSchema,
  handler: async (c) => c.get('currentUser'),
})
