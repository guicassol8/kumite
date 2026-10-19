# ADR-0001: Judge sandbox engine

- **Status:** Accepted
- **Date:** 2026-08-28
- **Deciders:** guicassol8 (product/eng), Claude (spike execution)

## Context

The judge (#15) runs a competitor's Blockly-generated `solve(input)` server-side
and scores it — "the client is never trusted with scoring." That means executing
arbitrary generated JavaScript with no trust in the code itself. #15 already
closed the operational limits: **2s timeout per test case, ~64MB memory per
execution, concurrency 4 via an internal queue, contexto fresco por caso**
(the generated code declares its variables above `solve`, so reusing a context
across cases leaks state between them — see `blocks/src/generate.ts`).

What #15 left open was *which engine* enforces those limits. Four candidates
were built as throwaway PoCs in `back/spike/` (deleted by this PR — the
harness of the winner is what's committed) and measured against the same
payload — the real `generateSolution(somaDosPares)` output plus six
hand-written hostile payloads (infinite loop, memory bomb, `require`,
dynamic `import`, `process.exit`, `fetch`) that Blockly's curated toolbox
cannot itself produce, but that any manually-crafted or future-toolbox-bug
payload could attempt. Full numbers, method and the first pass of the
tie-break reasoning are in `spike/results.md`'s git history (commit that
added it, prior to this PR's cleanup commit) — **read that commit alongside
this ADR, not instead of it**: writing the characterization test below
(`back/src/sandbox-engine.test.ts`) surfaced a timing error in that file's
memory-bomb comparison, corrected here (see Alternatives → D and
Consequences → Negative).

Candidates evaluated: **A** `worker_threads` + hard timeout, **B**
`quickjs-emscripten` in-process, **C** `isolated-vm@7`, **D**
`quickjs-emscripten` inside a `worker_thread`. Tie-break order (closed with
the user before the spike started): **isolamento > portabilidade >
simplicidade**, performance only if those three don't separate the field.

## Decision

We will use **`quickjs-emscripten` inside a `worker_thread`** (candidate D)
as the judge's sandbox engine — one persistent worker per submission, a fresh
`QuickJSRuntime` + `QuickJSContext` per test case within it, `resourceLimits`
on the worker as a second barrier behind QuickJS's own memory/interrupt
limits.

This corrects the spike's first-pass conclusion (candidate B, in-process —
see Alternatives → B below for how that pivot happened). The tie-break
still runs isolamento > portabilidade > simplicidade, but a finding made
while writing this PR's characterization test moved the memory-bomb result
from "a simplicidade wash in B's favor" to "a process-availability gap that
isolamento itself has to account for" — detailed below.

Configuration to carry into #19 (the execution service):

- One `Worker` **per submission**, not per case — `new Worker(new
  URL('./sandbox-engine.worker.ts', import.meta.url), { resourceLimits: {
  maxOldGenerationSizeMb: memoryMb * 2 } })`. The `* 2` headroom is
  deliberate: it's a backstop behind QuickJS's own `setMemoryLimit`, not the
  primary enforcement — see the Negative section on why it doesn't make the
  memory-bomb case fast.
- Inside the worker: `newQuickJSWASMModule()` **once**, then
  `module.newRuntime()` + `runtime.newContext()` **fresh per test case** —
  never reused across cases, per #15's contexto fresco requirement.
- Per case: `runtime.setMemoryLimit(memoryMb * 1024 * 1024)` (`memoryMb` from
  `JUDGE_MEMORY_MB`, default ~64) and `runtime.setInterruptHandler(
  shouldInterruptAfterDeadline(Date.now() + timeoutMs))` (`timeoutMs` from
  `JUDGE_TIMEOUT_MS`, default 2000ms).
  *Since #473 `setMemoryLimit` only refuses one block larger than the limit;
  the total is capped by the worker's own `WebAssembly.Memory` — see the
  "total memory ceiling" amendment below.*
- Call the case through a `Promise.resolve(solve(input)).then(...).catch(...)`
  wrapper assigned to a `globalThis` slot, then `runtime.executePendingJobs()`
  before reading the result back out — `evalCode` never drains microtasks on
  its own, so a `solve` that returns (or leaks into) a Promise — e.g. a stray
  dynamic `import()` — would otherwise read back as a false "ok" with an
  empty value. The slot is read by the **host** (`context.getProp` +
  `context.dump`, which serializes in C), never with a second `evalCode` —
  that would run the guest's own `JSON`, which a solution can redefine to
  forge its verdict (#281). A `dump` that does not yield an object with a
  boolean `ok` (BigInt, circular value) reads as `blocked`.
- `runtime.dispose()` / `context.dispose()` after every case.
- Request/reply protocol between the main thread and the worker (message id
  per case) plus a **main-side watchdog per request** — this session used
  `timeoutMs + a few seconds` of slack, because the memory-bomb finding below
  means a reply can legitimately take multiple seconds even when the sandbox
  is working exactly as designed.
- **Respawn on crash/exit**: a memory-limit hit can end with the worker
  itself exiting (observed in this session) — #19's pool must detect that
  (the `'exit'` event with no prior `'message'` for the pending request) and
  spin up a fresh worker for the *next* submission. It does not need to
  retry the failed case; that submission's case is done, it failed.
- `JUDGE_CONCURRENCY` (default 4, per #15) bounds how many of these workers
  run at once — implemented in #19's internal queue, orthogonal to this ADR.
- **The worker's entry point must be plain JS, not raw `.ts`.** `new
  Worker(url)` loads its entry through Node's own module resolution, not
  through whatever transform the parent process uses — on the pinned Node
  20 (CI today, and `pnpm start`'s runtime), neither `execArgv: ['--import',
  'tsx/esm']` nor tsx's own automatic worker-thread patching apply their
  loader hooks to that entry-point resolution (both confirmed against a real
  Node 20.19.5 binary, not just CI's log). `back/scripts/build-sandbox-worker.mjs`
  pre-compiles `sandbox-engine.worker.ts` to `dist/sandbox-engine.worker.js`
  (via `typescript`'s `transpileModule`, wired as this package's `pretest`)
  and the Worker loads that. #19 needs the equivalent step wherever it
  actually deploys the worker.
- Working reference for all of the above: `back/src/sandbox-engine.worker.ts`
  (worker body), `back/scripts/build-sandbox-worker.mjs` (compiles it) and
  `back/src/sandbox-engine.test.ts` (spawns the compiled worker,
  characterizes it) — #19 ports this logic into `src/modules/judge/` with
  the real submission-pool lifecycle around it. (See the Errata at the end
  of this ADR: that means the service surface, not where the files
  physically live.)

## Alternatives considered

### Alternative A — `worker_threads` + hard timeout
One `Worker` per case, `resourceLimits.maxOldGenerationSizeMb`, `terminate()`
on timeout. Rejected on the top tie-break criterion: it isolates the heap and
the event loop, not the Node API surface. `require('node:fs')` **succeeds**
inside the worker and returns real directory data — measured, not
theoretical. `process.exit(0)` silently kills the worker without crashing the
parent (recoverable, but only because we happened to treat "no reply" as a
result rather than trusting a clean exit code). This is real isolation
against a runaway loop or an OOM, but not against a payload that simply calls
`require`. Also the slowest candidate at scale for the realistic payload:
~31ms/case at n=50, roughly an order of magnitude above B/C/D — the OS-level
Worker spin-up dominates. Its one advantage, revisited below: Node's own
`resourceLimits` enforcement is a **hard, fast** kill — a follow-up check in
this PR measured its memory-bomb probe tripping in ~170ms, against QuickJS's
~3.4-3.85s for the identical payload shape (see Alternative D). Not enough
to overturn the top-criterion rejection, but the number is recorded because
it explains *why* D needs `resourceLimits` as a second barrier at all.

### Alternative C — `isolated-vm@7`
A real native V8 isolate per case (`new ivm.Isolate({ memoryLimit })`,
`script.run(context, { timeout })`), same isolation grade as B and D — every
hostile probe blocked, `require`/`process`/`fetch` don't exist as globals.
Fast too: ~1.9ms/case at n=50 for the realistic payload, and (per the same
follow-up check as A) its native `memoryLimit` trips a memory bomb in
~73ms — the fastest and hardest enforcement measured of any candidate.
Rejected on the second tie-break criterion regardless: `isolated-vm@7.0.1`'s
`engines` field requires **Node ≥24**; this repo's CI
(`.github/workflows/*.yml`, protected config) pins **Node 20** in five jobs.
The spike measured a real install here (~10s, using a prebuilt binary — no
local compiler invoked, so the native-addon story isn't as bad as it could
be), but the Node-floor mismatch against CI is unavoidable without either
bumping CI's Node version or pinning an older isolated-vm major (untested,
out of this spike's timebox). If QuickJS's slow memory-limit detection (see
below) ever proves worse than expected in production, this is the candidate
to revisit — CI's Node floor is the one thing that has to move first.

### Alternative B — `quickjs-emscripten`, in-process
**This was the spike's first-pass decision — course-corrected while writing
this PR's characterization test, before anything downstream depended on it.**

Same execution logic as D, just without the worker: a fresh runtime+context
per case on the main thread, no message protocol, no worker lifecycle. It
looked like the winner because the spike's hostile battery never printed
individual probe timings (`printEngineReport` in the deleted throwaway
harness logged outcome and detail, not elapsed ms) — the memory-bomb result
read as "resolves cleanly, no crash" for both B and D, and the *visible*
difference was D's extra complexity for an event-loop-lag guarantee that
looked purely theoretical at this payload's size (sub-millisecond cases).

Writing `sandbox-engine.test.ts` for B first (before the pivot) put a real
stopwatch on that probe: **QuickJS's own memory-limit detection took
~3.4-3.5s to trip, consistently, across repeated runs** — `evalCode` is a
synchronous, blocking WASM call with no way to preempt it externally once
started; the only thing that can stop a memory-bomb loop is QuickJS's own
internal accounting noticing the WASM heap has grown past `setMemoryLimit`,
and that check is evidently not fast. In candidate B that stall runs **on
the same thread as the rest of the Node process** — a single hostile
submission would freeze the entire judge (and anything else that process
serves) for ~3.4 seconds, more than 1.5× the nominal 2s per-case budget, with
no way for anything else to run until QuickJS itself gives up. That is not
a "slow payload" risk bounded by `JUDGE_CONCURRENCY`; it is the *sandbox
enforcement mechanism itself* being slower than the SLA it's supposed to
guarantee, in-process, where slow means "the whole server stalls."

Candidate D pays the same ~3.4-3.85s internally (this is a QuickJS
characteristic, not a worker-placement one — confirmed by measuring both
placements), but the stall is confined to that one submission's worker; the
main thread and every other in-flight submission keep running. That
isolation property — reclassified from "simplicidade cost with no measured
benefit" to "isolamento, at the process level, with a measured failure mode
it prevents" — is why D, not B, is this ADR's Decision. B remains simpler
to operate (no worker lifecycle, no respawn-on-crash handling) and that cost
is real; it just doesn't outrank a process-availability gap once one is
actually measured, per the agreed tie-break order.

## Consequences

### Positive
- Full isolation from the Node API surface (`require`/`process`/`fetch` are
  `ReferenceError`s, not caught exceptions) — the strongest grade measured,
  tied with B and C, ahead of A.
- No Node-version tax on the *engine*: `quickjs-emscripten` is pure WASM/JS,
  no `engines` constraint tighter than what the repo already runs, and CI
  stays on Node 20 — unlike C. This does need one piece of plumbing C
  doesn't: the worker's `.ts` entry has to be pre-compiled to plain JS first
  (see Decision, `back/scripts/build-sandbox-worker.mjs`), because Node 20
  can't load TypeScript directly inside a `worker_thread` even with tsx's
  loader. That's a one-time build step, not a version floor — it doesn't
  reopen the C comparison.
- The main Node process — and every other in-flight submission — stays
  responsive even when one submission's sandbox is stuck fighting a
  memory-bomb-shaped payload for multiple seconds. This is the property that
  changed the decision; see Alternatives → B for the measurement.
- Per-case cost for the realistic payload is competitive once the worker is
  warm: 0.55ms at n=50 in the spike (vs. B's 0.54ms, C's 1.90ms, A's
  31.23ms) — the worker's fixed cost is a one-time ~140-200ms cold start per
  submission, not a per-case tax.

### Negative / costs
- **The memory-bomb budget isn't actually 2s.** `JUDGE_TIMEOUT_MS` bounds
  CPU-bound loops (QuickJS's interrupt handler is checked at bytecode
  boundaries and reliably fires close to the deadline — measured ~2.0-2.1s
  for the infinite-loop probe in both B and D). It does **not** bound a
  memory-exhaustion payload: that's caught by `setMemoryLimit`'s own
  accounting, measured at ~3.4-3.85s regardless of placement. #19's
  per-request watchdog and its documentation must be explicit that a
  memory-bomb-shaped case can legitimately take multiple seconds to fail —
  don't tune the watchdog down to `JUDGE_TIMEOUT_MS` expecting it to be a
  tight bound, and don't alert on a single case exceeding 2s as if it were
  necessarily a bug.
  *Superseded by #473: those seconds were the heap growing to the WASM
  maximum of 2 GiB, not `setMemoryLimit` firing. With the total memory
  ceiling (amendment below) a memory bomb ends as `memory` in ~40–140 ms.*
- **Worker lifecycle complexity.** A request/reply protocol with per-request
  ids, a main-side watchdog, and respawn-on-crash handling — none of which
  candidate B would have needed. This is the concrete cost of the isolation
  property above; #19 owns building and testing it (this PR's
  `sandbox-engine.test.ts` exercises the shape but not the concurrency-4
  pool itself).
- A submission whose memory-bomb-shaped case exits the worker mid-batch
  loses the rest of that submission's cases too (per-submission worker, not
  per-case) — #19 needs to decide how the remaining cases score (likely:
  fail them all as a consequence of the same violation, not silently skip
  them). Not decided by this ADR; flagged as a Follow-up.
- QuickJS is not V8: minor semantic gaps against Node's V8 are possible for
  exotic language features. Not observed against the curated Blockly toolbox
  output in this spike, but #19/#20's editor↔judge parity test is the real
  guard against divergence.
- The `Promise.resolve(...).then/.catch` + `executePendingJobs()` wrapper is
  a subtlety a future maintainer could accidentally drop when refactoring
  #19 — the characterization test in `back/src/sandbox-engine.test.ts` (this
  PR) exists specifically to catch that regression (the dynamic-`import()`
  probe would silently start reading as "ok" again).

### Follow-ups
- #19 (execution service) implements `JUDGE_TIMEOUT_MS`, `JUDGE_MEMORY_MB`,
  `JUDGE_CONCURRENCY`, the per-submission worker pool, request watchdogs, and
  respawn-on-crash — this ADR's Decision section is #19's spec for the
  engine itself.
- #19 decides and documents the scoring behavior when a worker dies mid-
  submission (see Negative above) — likely "the rest of that submission's
  cases fail," but that's a product call, not an engine call.
- If `isolated-vm` is ever revisited (e.g. QuickJS's slow memory-limit
  detection proves worse in production than this session's numbers suggest),
  CI's Node floor is the blocker to clear first — that's a change to
  `.github/workflows/*.yml`, a protected config requiring explicit sign-off,
  not a decision this ADR can make unilaterally.
- Tests: `back/src/sandbox-engine.test.ts` (this PR) — behavioral
  characterization of the chosen engine (correct `solve` output, timeout
  without crashing the *main* process, memory-limit without crashing the
  main process, every hostile probe blocked). Timings are printed, never
  asserted.

## Errata (2026-09-09)

The Decision section's last bullet says "#19 ports this logic into
`src/modules/judge/`". Read literally, that sends the worker script into the
module folder — which `kata verify` rejects: the `kata/schema-file-naming`
rule accepts only the five locked suffixes inside `src/modules/<domain>/`
(`.route.ts`, `.service.ts`, `.schema.ts`, `.test.ts`, `.hurl`), while the
`src/` root is open to any filename (kata's `guide/project-layout.md`, "The
`src/` root is open" / "Module directories stay locked"). The sentence means
the **service surface** lives in `src/modules/judge/`; a file outside those
five suffixes stays at the `src/` root.

That is what #19 actually shipped:

- `back/src/sandbox-engine.worker.ts` — the worker body, at the `src/` root,
  where this ADR's own "working reference" bullet had already put it.
- `back/src/modules/judge/judge.service.ts` — the service surface: the
  per-submission worker lifecycle, the concurrency semaphore and the outcome
  mapping. It imports the worker's request/reply types from
  `../../sandbox-engine.worker`.

The Decision itself is unchanged — only the reading of that one phrase is
corrected here.

## Amendment (2026-10-05, #277): warm worker pool

The Decision's "one persistent worker per submission" is corrected here: a
worker now outlives its submission and serves the next ones, from a pool of
at most `JUDGE_CONCURRENCY` workers in `judge.service.ts`. #137 measured the
spawn (starting the worker thread and loading QuickJS's WASM) at 79–97% of a
correct submission's judge time outside the queue, on a CPU-bound judge, so
paying it once per worker instead of once per submission is the largest
throughput gain available in the judge.

- **Isolation is unchanged.** Between cases and between submissions it still
  comes from a fresh `QuickJSRuntime` + `QuickJSContext` per case, disposed
  after it. The only thing a submission inherits from the previous one on the
  same worker is the loaded QuickJS module. `judge.test.ts` proves a global
  written by one submission is gone in the next one on the same worker.
- **When a worker is discarded** instead of going back to the pool: it exited
  or emitted `error`, the watchdog fired on one of its cases, or a case came
  back `memory` or `error` from the sandbox. `memory` because WASM linear
  memory never shrinks — a worker that grew to the limit would keep it — and
  because an out-of-memory is exactly where a corrupted QuickJS module would
  show, hurting the *next* participant's submission; `error` (a host-side
  failure) for the second reason. `timeout` and `blocked` are ordinary guest
  outcomes and keep the worker, as they always kept it for the rest of the
  same submission's cases. Inside a submission nothing changed: after an
  `exit`, the remaining cases are `runtime_error`.
- **Created on demand.** A submission takes the most recently returned idle
  worker, or spawns one when there is none. The pool reaches
  `JUDGE_CONCURRENCY` after that many simultaneous submissions and never
  shrinks; a discarded worker is replaced by the next submission that finds
  no idle one. The first submissions after a boot still pay the spawn.
- **Case ids are unique per process**, from a counter that never restarts:
  on a reused worker, a late reply meant for an earlier submission can never
  be read as the current one's.
- **Listeners for the worker's life.** `ready`, `error` and `exit` are bound
  once, when the worker is created: an idle worker emitting `error` with no
  listener would otherwise crash the main process.
- **Idle workers are `unref()`'d** (and `ref()`'d when checked out): a worker
  waiting in the pool never keeps the process, vitest or the harness alive.
- **Observability.** `GET /organizer/stats/process` reports
  `judge.workers.idle`; a leak is now `alive − idle` above zero with nothing
  in flight, and a run's `spawnMs` is 0 on a warm worker.

Measured before and after with the load harness's burst, same session, same
limits: `docs/load/277-judge-pool.md` (raw reports in `docs/load/277/`). With
100 teams at once and every solution correct, a correct submission's p50
went from 8.0 s to 0.26 s and the back's CPU from its 200% cap to 28%; with
10% and 30% bad solutions, from 15.1 s to 6.1 s and from 36.6 s to 28.8 s,
where the infinite loops holding their slots for 10 s are now the floor.

## Amendment (2026-10-19, #473): total memory ceiling

`runtime.setMemoryLimit(memoryMb * 1024 * 1024)` was never a total. The
`@jitl/quickjs-wasmfile-release-sync@0.32.0` variant that
`newQuickJSWASMModule()` loads vendors bellard/quickjs `f1139494`, whose
`js_def_malloc_usable_size` returns 0 under `EMSCRIPTEN`. Its `js_def_malloc`
refuses only when `malloc_size + size > malloc_limit`, then adds
`usable_size + MALLOC_OVERHEAD` (0 + 8) to `malloc_size`: the running total
grows by 8 bytes per live block, so the limit refuses one block larger than
itself and nothing else. What actually stopped a bomb was the WASM heap's own
maximum, 32768 pages (2 GiB) per worker, which `resourceLimits` does not
cover — WASM memory is an `ArrayBuffer` outside V8's old generation. At the
default `JUDGE_CONCURRENCY` of 4 that is up to 8 GiB in the back process.

**The ceiling.** The worker is spawned with `workerData: { memoryMb }` (the
pool passes it; the worker refuses to boot without a positive integer) and
loads QuickJS through `newVariant(RELEASE_SYNC, { wasmMemory })` on its own
`WebAssembly.Memory`:

- `initial`: 256 pages (16 MiB), the minimum the `.wasm` declares for its
  imported memory — anything smaller fails to instantiate;
- `maximum`: `256 + memoryMb × 16` pages — the module's 16 MiB plus
  `memoryMb` for the solution (`wasmMemoryPages` in
  `sandbox-engine.worker.ts`).

Past `maximum`, Emscripten's `emscripten_resize_heap` catches the failed
`grow` and returns false, `malloc` returns `NULL`, and QuickJS throws
`InternalError: out of memory` — no abort; the case comes back `memory` and
the worker is discarded, as since #277. `JUDGE_MEMORY_MB` is the floor of
what the solution may hold, not an exact cap: the module itself uses only
~6 MiB of its initial 16 MiB, so the rest is the solution's too. The
effective ceiling sits between ~95% and 100% of `maximum`, because
Emscripten grows the heap by at least 5% a step; with 64 MiB a worker tops
out at ~76–80 MiB in all. Measured in the review (one fresh worker,
`memoryMb` 64, ArrayBuffers kept until `out of memory`), what a solution
holds depends on its block size: 74.6 MiB in 64 KiB blocks, 74 in 1 MiB, 72
in 4 and 8 MiB, 64 in 16 and 32 MiB. So a total between 64 and ~75 MiB still
comes back `ok`; past that, always `memory`. A case whose `memoryMb` differs
from its worker's spawn value is refused with `error`. `setMemoryLimit`
stays: it refuses one oversized block at once, before the heap is asked to
grow.

Measured with `sandbox-engine.test.ts` (one worker per case, `memoryMb` 64,
same machine, 5 runs after the change):

| Case | Before | After |
| --- | --- | --- |
| 16 × `new ArrayBuffer(8 MiB)` (2 × the limit) | `ok`, 16 | `memory`, 40–67 ms |
| 128 × `new ArrayBuffer(8 MiB)` (16 × the limit) | `ok`, 128 (570–919 ms) | `memory`, 39–56 ms |
| `while (true) a.push(new Array(1e6).fill(0))` | `memory`, ~3.6 s (at 2 GiB) | `memory`, 107–138 ms |
| 1 × `new ArrayBuffer(128 MiB)` | `memory`, ~9 ms | `memory`, ~9 ms |
| 6 × `new ArrayBuffer(8 MiB)` (48 MiB, within) | `ok`, 6 | `ok`, 6 |
| 8 × `new ArrayBuffer(8 MiB)` (64 MiB, the whole budget; review) | `ok`, 8 | `ok`, 8 |

**Rejected:** measuring the heap from the interrupt handler (the heap never
shrinks, so after one case filled it every later case of the same submission
would read a false `memory`; and a C builtin allocates between two checks); a
custom build with `malloc_usable_size` (an Emscripten toolchain and a variant
we would maintain); the quickjs-ng variant (its `js__malloc_usable_size` also
returns 0 outside Linux/Apple/Windows, and changing engines is its own ADR).

**Residual risks, not addressed here:**

- QuickJS's out-of-memory is an ordinary `InternalError`, catchable by a
  guest `try/catch`. The curated toolbox has no `try` block, and the judge
  only runs source it generated itself (`generateSolution`), so it is not
  reachable today.
- The host-side `malloc` calls in quickjs-emscripten's `interface.c` do not
  check for `NULL` near the ceiling. The mitigation is the existing discard
  of a worker that came back `memory`.
