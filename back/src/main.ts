import { app } from './app'
import { env } from './config'
import { k } from './context'
import { serveApp } from './lib/http-server'
import { runExpiryTick, runRankingTick } from './modules/sse/sse.service'
import { startProcessSampler } from './modules/stats/stats.service'

// Keep-alive and header timeouts tuned against Caddy's upstream pool (#438).
serveApp(app.fetch, env.PORT, (info) => {
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

// Event-loop lag and utilization, one window per second, the last two minutes
// kept (#136). Read by GET /organizer/stats/process; wired here for the same
// reason as the ticks above, and its own timer is unref'd too.
startProcessSampler({ windowMs: 1000, keep: 120 })
