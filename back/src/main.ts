import { serve } from '@hono/node-server'

import { app } from './app'
import { env } from './config'
import { k } from './context'
import { runExpiryTick, runRankingTick } from './modules/sse/sse.service'

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log('kumite api: listening on http://localhost:' + info.port)
})

// Wired here, not as a side effect of the sseBus singleton's construction
// (context.ts): a test that only imports app.ts/context.ts (auth-guards.test.ts,
// module tests) must not inherit a real 1s DB-polling timer. .unref() so it
// never keeps the process alive on its own.
setInterval(() => {
  runExpiryTick(k.resolve('db'), k.resolve('sseBus')).catch((err) => {
    console.error('sse expiry tick failed', err)
  })
  runRankingTick(k.resolve('db'), k.resolve('sseBus')).catch((err) => {
    console.error('sse ranking tick failed', err)
  })
}, 1000).unref()
