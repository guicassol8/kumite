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
payload could attempt. Full numbers, method and the tie-break reasoning are
in `spike/results.md`'s git history (commit that added it, prior to this
PR's cleanup commit) — this ADR summarizes the decision.

Candidates evaluated: **A** `worker_threads` + hard timeout, **B**
`quickjs-emscripten` in-process, **C** `isolated-vm@7`, **D**
`quickjs-emscripten` inside a `worker_thread`. Tie-break order (closed with
the user before the spike started): **isolamento > portabilidade >
simplicidade**, performance only if those three don't separate the field.

## Decision

We will use **`quickjs-emscripten`, in-process** (candidate B) as the judge's
sandbox engine — a fresh `QuickJSRuntime` + `QuickJSContext` per test case,
memory-limited and interrupt-limited per case, no worker, no native addon.

Configuration to carry into #19 (the execution service):

- `newQuickJSWASMModule()` once per process (WASM module load, ~15-30ms
  measured this session); `module.newRuntime()` + `runtime.newContext()`
  fresh **per test case** — never reused across cases, per #15's contexto
  fresco requirement.
- `runtime.setMemoryLimit(memoryMb * 1024 * 1024)` with `memoryMb` from
  `JUDGE_MEMORY_MB` (default ~64, per #15) — implemented in #19.
- `runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() +
  timeoutMs))` with `timeoutMs` from `JUDGE_TIMEOUT_MS` (default 2000ms) —
  implemented in #19.
- Call the case through a `Promise.resolve(solve(input)).then(...).catch(...)`
  wrapper assigned to a `globalThis` slot, then `runtime.executePendingJobs()`
  before reading the result back out — `evalCode` never drains microtasks on
  its own, so a `solve` that returns (or leaks into) a Promise — e.g. a stray
  dynamic `import()` — would otherwise read back as a false "ok" with an
  empty value. See `spike/engine-quickjs.ts` for the working shape; #19 ports
  this logic into `src/modules/judge/`.
- `runtime.dispose()` / `context.dispose()` after every case (both are
  cheap — this is what keeps per-case cost near-zero at n=50).
- `JUDGE_CONCURRENCY` (default 4, per #15) bounds how many of these
  runtime+context pairs run at once — implemented in #19's internal queue,
  orthogonal to this ADR.

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
`require`. Also the slowest candidate at scale: ~31ms/case at n=50, roughly
an order of magnitude above B/C/D — the OS-level Worker spin-up dominates.

### Alternative C — `isolated-vm@7`
A real native V8 isolate per case (`new ivm.Isolate({ memoryLimit })`,
`script.run(context, { timeout })`), same isolation grade as B and D — every
hostile probe blocked, `require`/`process`/`fetch` don't exist as globals.
Fast too: ~1.9ms/case at n=50. Rejected on the second tie-break criterion:
`isolated-vm@7.0.1`'s `engines` field requires **Node ≥24**; this repo's CI
(`.github/workflows/*.yml`, protected config) pins **Node 20** in five jobs.
The spike measured a real install here (~10s, using a prebuilt binary — no
local compiler invoked, so the native-addon story isn't as bad as it could
be), but the Node-floor mismatch against CI is unavoidable without either
bumping CI's Node version or pinning an older isolated-vm major (untested,
out of this spike's timebox). Isolation-wise this candidate is a fine
runner-up if quickjs-emscripten ever needs replacing.

### Alternative D — `quickjs-emscripten` inside a `worker_thread`
Candidate B's exact execution logic, relocated into one persistent worker per
"submission" (`resourceLimits` as a second barrier behind QuickJS's own
limits). Built to test one hypothesis: does moving QuickJS off the main
thread matter? Measured event-loop lag on the main thread reads ~0 for both
B and D at this payload's size (single-digit-millisecond cases), so D buys
an isolation property (main-thread safety under a slow case) that isn't a
measured problem today. It also costs something concrete: a standalone check
found the memory-bomb probe takes **~3.85s** to trip inside the worker versus
a few milliseconds in-process for the identical payload and limits — blowing
straight through the 2s budget it's supposed to enforce — and the worker
process exits right after, meaning a memory-limit hit requires respawning
the worker rather than just moving to the next case. Rejected on the third
tie-break criterion (simplicidade): B gets the same isolation grade with no
worker lifecycle, no message protocol, no per-request watchdog, and none of
that memory-limit regression.

## Consequences

### Positive
- Full isolation from the Node API surface (`require`/`process`/`fetch` are
  `ReferenceError`s, not caught exceptions) — the strongest grade measured,
  tied with C and D, ahead of A.
- No Node-version tax: `quickjs-emscripten` is pure WASM/JS, no `engines`
  constraint tighter than what the repo already runs. CI stays on Node 20.
- Fastest warm per-case cost measured across all four candidates: 0.54ms at
  n=50 (vs. A's 31.23ms, C's 1.90ms, D's 0.55ms) — cheap enough that
  `JUDGE_CONCURRENCY=4` has real headroom.
- Simplest integration: no worker, no native build step, no message-passing
  protocol for #19 to own.

### Negative / costs
- In-process execution means a `solve` that manages to burn CPU for close to
  the full 2s timeout **does** block the Node event loop for that duration
  (measured lag was ~0 only because this session's cases were sub-millisecond
  — a pathological payload near the timeout ceiling would show up here). This
  is bounded by `JUDGE_TIMEOUT_MS` and `JUDGE_CONCURRENCY`, but #19 should be
  aware the queue, not the sandbox, is what keeps this from starving other
  requests.
- QuickJS is not V8: minor semantic gaps against Node's V8 are possible for
  exotic language features. Not observed against the curated Blockly toolbox
  output in this spike, but #19/#20's editor↔judge parity test is the real
  guard against divergence.
- The `Promise.resolve(...).then/.catch` + `executePendingJobs()` wrapper is
  a subtlety a future maintainer could accidentally drop when refactoring
  #19 — the characterization test in `src/sandbox-engine.test.ts` (this PR)
  exists specifically to catch that regression (the dynamic-`import()` probe
  would silently start reading as "ok" again).

### Follow-ups
- #19 (execution service) implements `JUDGE_TIMEOUT_MS`, `JUDGE_MEMORY_MB`,
  `JUDGE_CONCURRENCY` and ports the runtime/context/wrapper logic described
  above — this ADR's Decision section is #19's spec for the engine itself.
- If `isolated-vm` is ever revisited (e.g. an isolation gap is found in
  QuickJS), CI's Node floor is the blocker to clear first — that's a change
  to `.github/workflows/*.yml`, a protected config requiring explicit
  sign-off, not a decision this ADR can make unilaterally.
- Tests: `back/src/sandbox-engine.test.ts` (this PR) — behavioral
  characterization of the chosen engine (correct `solve` output, timeout
  without crashing the process, memory-limit without crashing the process,
  every hostile probe blocked). Timings are printed, never asserted.
