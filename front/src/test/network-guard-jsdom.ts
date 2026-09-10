import { afterEach } from 'vitest'

// No test in this suite is allowed to reach the real network. A route-mounting
// test that lets a request through gets whatever the developer's machine
// happens to be serving on port 3000: a 401 from it drops the session, the
// `__root` effect bounces the router to /login, and the test passes or fails
// depending on when that lands — the order-dependent failure of #168.
//
// `vi.mock('@/lib/api', …)` is not proof of being offline: `sse-client.ts`
// fetches outside the RPC client, so that mock never sees it. Hence a runtime
// guard instead of a static sweep — the only thing that can actually observe a
// request leaving.
//
// There is no allowlist and no escape hatch: a test that needs a controlled
// `fetch` replaces the whole chain with `vi.stubGlobal('fetch', …)`, which is
// what `api.test.ts` and `sse-client.test.ts` already do.
//
// Ordering matters: this runs BEFORE `blockly-jsdom.ts` in `setupFiles`, so
// Blockly's shim wraps this one and answers its own `/blockly-media/` sound
// preloads without ever reaching the guard.

const attempted: string[] = []

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return (input as Request).url
}

globalThis.fetch = ((input: RequestInfo | URL) => {
  const url = urlOf(input)
  attempted.push(url)
  throw new Error(`NETWORK-GUARD: blocked a real request to ${url}`)
}) as typeof fetch

// Callers swallow their own failures (react-query retries, the SSE reader
// catches everything), so throwing at the call site is not enough to fail a
// test — this is what actually turns a leaked request into a red run.
afterEach(() => {
  if (attempted.length === 0) return
  const urls = [...new Set(attempted)]
  attempted.length = 0
  throw new Error(
    'NETWORK-GUARD: this test reached the real network. Mock it (see front/AGENTS.md).\n' +
      urls.map((url) => `  - ${url}`).join('\n'),
  )
})
