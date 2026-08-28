# #17 spike — sandbox engine measurements

All numbers below are from this session, on this machine (Node 26.1.0, WASL/Linux dev box),
via `pnpm --filter @kumite/back exec tsx spike/engine-*.ts`. Timeout budget 2000ms/case,
memory budget 64MB/case, fresh context per case in every candidate (variable declarations
land above `solve` in the generated code — see `spike/harness.ts`). No number here comes from
documentation or a third party.

## Timing — realistic payload (`generateSolution(somaDosPares)`)

| Engine | cold start | n=1 total | n=1 avg/case | n=10 total | n=10 avg/case | n=50 total | n=50 avg/case |
|---|---:|---:|---:|---:|---:|---:|---:|
| A — worker_threads | 34.7ms | 34.4ms | 34.20ms | 311.8ms | 31.10ms | 1564.6ms | 31.23ms |
| B — quickjs-emscripten (in-process) | 15.1ms | 13.3ms | 10.19ms | 23.1ms | 0.99ms | 45.4ms | 0.54ms |
| C — isolated-vm (fresh Isolate/case) | 12.5ms | 8.1ms | 7.74ms | 34.2ms | 3.24ms | 102.2ms | 1.90ms |
| D — quickjs in worker_thread | 200.9ms | 3.6ms | 1.93ms | 23.6ms | 0.81ms | 54.9ms | 0.55ms |

A's per-case cost is a whole OS-level Worker spin-up every time — roughly an order of
magnitude above the other three at n=50. B and D converge on the same per-case cost once
warm (same execution engine — D just pays a one-time ~200ms Worker+WASM cold start on top).
C sits between B/D and A: real native isolates, cheaper than a Worker, pricier than a WASM
context.

## Event loop lag (sampled on the main thread, 20ms cadence, during the n=1/10/50 curves)

| Engine | p50 | max |
|---|---:|---:|
| A — worker_threads | 0.16ms | 1.54ms |
| B — quickjs-emscripten (in-process) | 0.00ms | 0.00ms |
| C — isolated-vm | 0.56ms | 2.40ms |
| D — quickjs in worker_thread | 0.07ms | 0.07ms |

B shows zero lag only because each case is fast enough (sub-ms) not to register at a 20ms
sampling cadence — it is still running on the main thread and a slower `solve` would show up
here. D confirms the premise it exists to test: moving the same execution off the main thread
keeps lag negligible regardless of case duration.

## Hostile battery — one call each, real result observed this session

| Payload | A — worker_threads | B — quickjs (in-process) | C — isolated-vm | D — quickjs (worker) |
|---|---|---|---|---|
| infinite loop, no alloc | **timeout** (2000ms) | **timeout** (interrupt) | **timeout** (script timeout) | **timeout** (interrupt) |
| memory bomb | **memory** (worker killed, parent alive) | **memory** (few ms) | **memory** (isolate disposed) | **times out its own 2s budget** — see below |
| `require('node:fs')` | **`ok`** — succeeds, returns dir listing | **blocked** (ReferenceError) | **blocked** (ReferenceError) | **blocked** (ReferenceError) |
| `import('node:fs')` | **error** (rejects — value not structured-cloneable, not a real block) | **blocked** (no module loader configured) | **blocked** ("Not supported") | **blocked** (no module loader configured) |
| `process.exit(0)` | **blocked** (worker dies silently, parent survives — no result) | **blocked** (ReferenceError) | **blocked** (ReferenceError) | **blocked** (ReferenceError) |
| `fetch(...)` | **error** (same non-cloneable-value accident as import, not a real block) | **blocked** (ReferenceError) | **blocked** (ReferenceError) | **blocked** (ReferenceError) |

A is the only candidate where a hostile payload actually **succeeds** (`require('node:fs')`
returns real filesystem data) — Node's API surface is fully reachable inside a `worker_threads`
Worker; it isolates the heap and the event loop, nothing else. B, C and D all block every
probe outright: `require`/`process`/`fetch` don't exist in the global scope at all
(ReferenceError, not a caught exception), and dynamic `import()` fails for lack of a
configured module loader.

D's memory-bomb result needs its own line: a standalone diagnostic run during this session
(throwaway, not part of the committed harness), with the same `setMemoryLimit`/`resourceLimits`
pairing, measured **~3.85s** for
QuickJS's OOM to trip inside a worker — against a few milliseconds in-process (B) for the
identical payload — and the worker process **exits (code 1) right after replying**. Moving
QuickJS into a worker doesn't just add a cold-start line item: it also breaks the very
timeout/memory budget the sandbox exists to enforce, and turns a memory-limit hit into
"respawn the worker," not "the next case runs fine."

## Portability — install, this session

| Engine | Package | Install | Native build? |
|---|---|---:|---|
| A | (`node:worker_threads`, built in) | — | — |
| B | `quickjs-emscripten@0.32.0` | ~6.8s (`pnpm add`) | No — pure WASM/JS, `type: commonjs` with an ESM entrypoint, no `engines` constraint tighter than the workspace's |
| C | `isolated-vm@7.0.1` | ~10.3s (`pnpm add`, `4.3s user / 1.0s system`) | Native addon; a **prebuild** was used here (`node_modules/isolated-vm/prebuilds/`) — no local compiler invoked. `engines.node: ">=24.0.0"` |
| D | `quickjs-emscripten@0.32.0` (same as B) | — | — |

C's Node floor is the real portability finding: this repo's CI (`.github/workflows/*.yml`)
pins `node-version: "20"` in five jobs. isolated-vm@7 refuses to install below Node 24. If C
wins, either CI moves to Node ≥24 (a change to `.github/workflows/`, a protected config — see
the ADR's Consequences) or the app pins an older isolated-vm major with a weaker Node floor
(not measured here — out of the spike's timebox).

## Library health/maintenance (`npm view`, checked this session — registry data, not a local measurement)

| Engine | Package | Latest version | Last publish |
|---|---|---|---|
| A | `node:worker_threads` | Node core, ships with every Node ≥12 | n/a |
| B / D | `quickjs-emscripten` (github.com/justjake/quickjs-emscripten) | 0.32.0 | 2026-02-16 |
| C | `isolated-vm` (github.com/laverdet/isolated-vm) | 7.0.1 | 2026-08-06 |

Both third-party candidates published within the last ~7 months as of this spike (2026-08-28) —
neither is abandoned. No further weight given to this criterion; it does not separate B from D
(same package) or from C.

## Verdict against the issue's criteria

Tie-break order, per the plan: **isolamento > portabilidade > simplicidade**, performance only
if the first three don't separate the field.

- **Isolamento** — separates the field outright. A leaves the Node API surface reachable
  (`require` genuinely works); B, C and D block every probe. A is out on this criterion alone.
- **Portabilidade** — separates B/D from C. B and D need nothing beyond the Node the repo
  already runs; C needs Node ≥24, which this repo's CI does not have today.
- **Simplicidade** — separates B from D. B is a runtime+context pair per case, no message
  protocol, no second process boundary, no respawn logic. D is the same engine plus a
  worker lifecycle, a request/reply protocol with per-request watchdogs, and (per the memory-bomb
  finding above) respawn-on-crash handling it doesn't get for free — and it buys, in exchange,
  an event-loop-lag guarantee this repo's judge doesn't need yet: cases are single-digit
  milliseconds each (B's own numbers), so the "main thread blocks" risk D solves is
  theoretical at today's payload sizes, not measured as a real problem in this session.

**Decision: quickjs-emscripten in-process (candidate B).** Full isolation (matches C and D),
no Node-version tax (unlike C), no worker-lifecycle complexity (unlike D), and the fastest
warm per-case time measured in this session (0.54ms at n=50 — faster than A, C and D). Detail
and configuration in `back/docs/adr/0001-judge-sandbox-engine.md`.
