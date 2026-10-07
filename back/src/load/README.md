# Load harness

Generates load against the back and reports what it saw (#136, part of
#135; the `burst` scenario, the judge and SSE timings and the settle and
storm phases are #137 and #138). TypeScript, Node's own `fetch`, no new dependency. It builds its own
world through the public API (signups, teams, a round), holds `/sse`
connections open, sends submissions, and polls the back's own metrics
(`GET /organizer/stats/process` and `/organizer/stats/live`) as the
organizer.

It lives in `back/src/load/` rather than in a package of its own, so it
shares the back's `tsc`, vitest and `tsx`. It reaches the API through the
typed client (`hc<AppType>`, type-only) and validates SSE payloads with the
back's own `SseEventSchema`, each distinct payload once per run (#442). It
is not a kata module.

## Scenarios

```bash
pnpm load:baseline            # 100 teams × 3, 400 idle SSE, no submission
pnpm load:smoke               # 10 teams × 2, 20 SSE, 30 submissions (10% infinite loops)
pnpm load:burst               # 100 teams × 3 at once on 5 problems, 400 SSE, then a storm
pnpm load smoke --teams 5     # any flag overrides the preset
pnpm load --help
```

| flag (env) | `baseline` | `smoke` | `burst` |
|---|---|---|---|
| `--url` (`LOAD_API_URL`; default `http://localhost:$PORT`) | | | |
| `--teams` | 100 | 10 | 100 |
| `--members` (capped at the event's `maxTeamSize`) | 3 | 2 | 3 |
| `--sse` (round-robin across the participants) | 400 | 20 | 400 |
| `--submissions` (total; 0 = no round) | 0 | 30 | 300 |
| `--bad-fraction` (share of bad submissions) | 0 | 0.1 | 0.1 |
| `--memory-share` (among the bad ones, the share of memory bombs; the rest are infinite loops) | 0 | 0 | 0.5 |
| `--problems` (problems in the run's round) | 1 | 1 | 5 |
| `--past-rounds` (closed rounds before the run's) | 0 | 0 | 0 |
| `--until-done` / `--no-until-done` | off | off | on |
| `--storm` / `--no-storm` · `--storm-window` s | off · 0 | off · 0 | on · 0 |
| `--resend-stale` / `--no-resend-stale` (for a back before #438, below) | off | off | off |
| `--rest` s / `--duration` s | 60 / 120 | 10 / 90 | 30 / 600 |
| `--request-timeout` ms | 60000 | 60000 | 290000 |
| `--setup-concurrency` · `--sse-ramp` (connections/s) · `--sample-interval` ms · `--cooldown` ms | 4 · 50 · 1000 · 5000 | same | same |
| `--out` (default `load-results/` at the repo root) · `--problem-id` (default: the seeded "Soma dos Pares") · `--allow-remote` | | | |

A run goes through `rest` (the back idle, only the organizer polling),
`setup` (signups + logins with bounded concurrency — argon2 costs 64 MiB per
hash, so 400 at once would exhaust a 4 GB back; its duration is the event's
opening signup rush), `sse-ramp`, then `sse-idle` (baseline) or `load`
(smoke, burst) for `--duration`, then — after any load — `settle`, then
`storm` with `--storm`, and `teardown` (streams closed, the run's round
closed). SSE connections are never reconnected on their own: a drop is
counted.

### The burst (#137, #138)

- **Submissions.** Each team sends one at a time, as in `smoke`; with 300
  over 100 teams, the first wave is all 100 teams at the same moment. A
  submission is the correct solution, an infinite loop (a `timeout` on every
  case, `JUDGE_TIMEOUT_MS` each) or a memory bomb (a string doubled with
  `text_join` until QuickJS runs out of memory: `runtime_error`). Which one
  is deterministic: the same flags send the same sequence.
- **Problems.** `--problems n` clones the base problem n−1 times through
  the organizer API (`load-<runId>-p<k>`, same cases and statements,
  published), so the round has n problems and the correct solution scores on
  all of them. A team's k-th submission goes to problem k mod n.
- **Past rounds.** `--past-rounds k` opens, scores (one correct submission
  per team) and closes `load-<runId>-r<j>` before the run's round: the event
  ranking every `ranking.updated` carries sums every non-draft round.
- **`--until-done`.** The load phase ends when the last submission is over;
  `--duration` is then only the deadline for starting new ones.
- **The 290 s ceiling.** undici (Node's `fetch`) gives up on response headers
  at 300 s, so `--request-timeout 290000` keeps every timeout the harness's
  own. A submission that waits longer counts as never completed: a
  participant waiting five minutes for a verdict is a broken system.
- **settle.** Polls, up to 15 s each: the judge drained (`/organizer/stats/live`
  shows nothing in flight or waiting, and no worker alive), then every open
  stream's last `ranking.updated` has the same digest (sha256 of the
  canonical `{round, event}`, `serverTime` left out) and it is the digest of
  `GET /rounds/:id/ranking` + `GET /ranking`.
- **storm.** Every stream is closed by the harness (counted as closed, not
  dropped) and as many reopen, spread over `--storm-window` seconds (0: all
  at once, like a back restart; 2: like a wifi drop). The same ranking check
  then runs on the new streams, its 15 s counted after the last one opened.

### Varying the judge's concurrency

The back reads `JUDGE_CONCURRENCY` from its environment, and a variable set
on the command line wins over `back/.env` (`process.loadEnvFile()` never
overrides the shell). After the `eval` of step 1 below, from `back/`:

```bash
JUDGE_CONCURRENCY=8 systemd-run --user --scope -p CPUQuota=200% -p MemoryMax=4G \
  -p MemorySwapMax=0 ./node_modules/.bin/tsx src/main.ts
```

The report's judge section prints the configuration the back says it judges
with, which proves the override took.

The organizer comes from `ORGANIZER_EMAIL` / `ORGANIZER_PASSWORD`, read from
the shell or else from `back/.env` — the same pair the seed, hurl and the
E2E use. `PORT` is read the same way when `--url`/`LOAD_API_URL` is unset.

## Running it locally

1. **Environment.** In a linked worktree, `pnpm worktree:env` once (its own
   database and port), then in each shell:

   ```bash
   eval "$(bash scripts/worktree-env.sh --print)"
   ```

   In the main checkout, `back/.env` is enough.

2. **A clean database.** `pnpm worktree:env --reset` in a worktree, or
   `pnpm --filter @kumite/back db:reset` in the main checkout (both truncate
   and re-seed, local databases only).

3. **The back, limited to the VPS's size** (2 CPUs, 4 GB, no swap). Without
   Docker, with a cgroup v2 scope (verified on this project's dev machine):

   ```bash
   cd back
   node scripts/build-sandbox-worker.mjs
   systemd-run --user --scope -p CPUQuota=200% -p MemoryMax=4G -p MemorySwapMax=0 \
     ./node_modules/.bin/tsx src/main.ts
   ```

   With Docker (same limits; not verified on the dev machine, which has no
   Docker):

   ```bash
   docker build -f back/Dockerfile -t kumite-back .
   docker run --rm --cpus=2 --memory=4g --memory-swap=4g --network host \
     --env-file back/.env kumite-back
   ```

4. **A quiet machine.** No E2E, test suite or pre-push of another agent at
   the same time: they share the CPU and move every number (#431). Check
   `cat /proc/loadavg` first. The report's header records the harness
   machine's load average at the start and at the end, so a noisy run shows.
   The report's `Phases (harness process)` table is the run's own check:
   a phase marked saturated measured the harness, not the back (below).

5. **Run**, e.g. `pnpm load:baseline --sse 300`.

6. **Between runs you want to compare, reset the database and restart the
   back.** The database reset alone is not enough: the submission throttle,
   the judge queue and the RSS belong to the process. A run against a dirty
   database still works — every run's data carries its own `load-<runId>`
   prefix, so nothing collides — and its report says so in a warning, but
   its numbers are not comparable with a clean run's.

Open files: every SSE connection is a socket on both sides. `ulimit -n` must
be well above `--sse` for the harness and for the back (it usually is on
Linux; macOS defaults to 256).

## Against the VPS

The harness refuses any host that is not `localhost`/`127.0.0.1`/`::1`
unless `--allow-remote` is passed: pointed at the VPS by accident, it would
sign up hundreds of accounts in the event's real database. It never resets
anything. The `load-<runId>` accounts, teams and the closed round stay in
the database; cleaning them up is part of the runbook in #139. Runs on the
VPS happen only in the windows agreed in #137–#139.

## What the back reports about itself

`GET /organizer/stats/process` (organizer only) carries, besides CPU,
memory and the event-loop windows:

- `judge`: the configuration it judges with, the worker counters (`spawned`,
  `exited`, `alive = spawned − exited`: a worker that never exits shows
  here) and a ring of the last 512 runs — arrival, queue position, queue
  wait, spawn (slot to the worker's `ready`, QuickJS loaded; null if the
  worker died first), execution (`ready` to the last case's reply), the sum
  of the per-case times, and the worst case's outcome;
- `sse`: a ring of the last 256 emissions (a ranking tick's three query
  stages, and for every emission the subscriber count and the synchronous
  `bus.publish` time — the N `JSON.stringify` plus queueing the writes, not
  the socket write itself) and of the last 1024 connects (building
  `state.sync`, the ranking's three stages, the total until the snapshot's
  ranking frame was written, and how many snapshots were being built at
  once).

`?since=<epoch ms>` keeps only the ring entries that ended at or after it.
The harness passes the previous answer's `sampledAt` and dedupes by `seq`,
so each poll carries only what is new.

## Output

Each run writes `report.md` and `report.json` into
`load-results/<scenario>-<runId>/` (git-ignored) and prints the Markdown to
stdout; progress goes to stderr. The reports worth keeping are copied into
`docs/load/` (then `pnpm format`: biome reflows the JSON).

The report has: the run (target, Node, commit, start/end, the harness
machine's load average and parallelism), the config, the world built, a
table per phase of the back's CPU %, RSS, heap, event-loop lag and
utilization, judge queue and server-side SSE count, the same per phase for
the harness's own process (CPU %, ELU, lag, the largest gap between two
back polls, and whether it saturated — #442), HTTP latency
(p50/p95/p99/max) and status counts per route and phase, the verdict matrix
(sent × verdict), actions started vs completed, and SSE (opened, failed,
dropped and why, events per connection, heartbeat gaps and each
connection's largest gap). With submissions: the submission latency per
kind, and the judge during the load (runs per outcome; queue, spawn,
execution and total per outcome; the spawn's share of the passed runs; the
largest queue at an arrival; the first-wave curve — the k-th arrival's queue
wait and the p95 of the first k, for k = 10, 25, 50, 75, 100, and the first
k whose p95 passes 5 s; the workers and the config). Then the SSE cost:
bytes per event type and the largest `ranking.updated` × connections, the
back's emissions per phase and kind, and the connects per phase (the ramp
apart from the storm). Then settle and storm. The JSON also carries the raw
back samples, event-loop windows, judge runs, emissions and connects.

Exit codes: `0` passed, `1` the run had failures (listed first in the
report), `2` configuration error. Ctrl-C once stops scheduling, closes the
streams and still writes the report (marked partial); twice quits at once.

### What fails a run

Only these, each counted and listed — the run never stops at the first:

- any 5xx;
- a status the call site did not expect (a 429 on a submission is expected:
  it waits and retries, up to 3 times);
- a network error or a timeout (an action that started and never completed),
  except one the harness retried (below). Each network error is listed with
  its code, whether it came before any response or mid-body, and whether
  the socket was a reused keep-alive one;
- an SSE connection that did not open, or that dropped before the harness
  closed it;
- an SSE payload that `SseEventSchema` rejects;
- a verdict incoherent with what was sent (the correct solution must be
  `accepted`, the infinite loop `timeout`, the memory bomb `runtime_error`);
- a judge that did not drain within 15 s of the load's end, or a worker
  still alive;
- an SSE ranking that differs between open connections or from the API,
  after the load or after the storm, and a storm connection that did not
  open, dropped or got an invalid payload;
- an error that stopped a phase (setup included), and an abort.

Latency, queue wait, spawn, CPU, memory, lag, bytes and heartbeat cadence
are observations: they never fail a run.

### The harness's own load (#442)

The harness is one Node process holding every stream. Each frame reaches
all of them, and since #439 its bytes are identical on every connection;
validating it 400 times (JSON, the zod union, and for a `ranking.updated`
of 90–130 KB two more zod parses, a canonical JSON and a sha256) kept the
harness at 100% of one core through a burst's `load` phase. Its heartbeat
gaps and its back polls (15–46 s apart) then measured the harness, not the
back.

- **One validation per distinct payload.** A cache shared by the run's
  streams, keyed by the `data:` text, keeps the answer for the last 64
  distinct payloads (valid or not, the type, the ranking digest, the bytes).
  The answer depends only on the text, so every connection still counts its
  own invalid payloads and keeps its own last ranking digest: settle and
  the storm compare exactly what they compared before. The SSE table shows
  `payloads validated (distinct / reused)`.
- **The harness reports its own load.** Every `--sample-interval` it reads
  its CPU (`process.cpuUsage`), event-loop utilization and event-loop delay
  (`monitorEventLoopDelay`), tagged with the phase. `## Phases (harness
  process)` shows them per phase, with the largest gap between two answers
  of the back sampler.
- **Saturated:** a phase whose mean ELU is ≥ 0.9, or where the harness's
  loop stalled ≥ 1000 ms (the heartbeat's period). Each saturated phase adds
  a warning — `harness saturated in <phase> …: heartbeat gaps, poll gaps
  and latencies of this phase measure the harness, not the back` — and
  **never fails the run**: like CPU and lag, it is an observation. Read
  that phase's heartbeat gaps and latencies as an upper bound.

### The stale-socket resend, off by default (#138, #438)

Before #438, Node's server closed a keep-alive socket after 5 s idle (its
default `keepAliveTimeout`), and a team's next submission comes after a 5 s
cooldown: the harness could reuse a socket at the moment the back closed it.
undici then failed the POST with `UND_ERR_SOCKET` ("other side closed")
before any byte of a response — the request never reached a handler. A
browser silently resends a request in exactly that case; undici does not,
and neither does Caddy, which keeps its own keep-alive pool to the back
(`reverse_proxy back:3000`): in production that race is a 502 on submit
(`docs/load/138-sse-fanout.md`).

**The back now announces `Keep-Alive: timeout=130` and closes an idle socket
at 131 s** (`back/src/lib/http-server.ts`, #438), after Caddy's pinned 120 s
upstream idle time. Caddy always drops an idle socket first, and undici,
which honors the header, keeps one a little under 130 s — the race is closed for both
paths. `docs/load/438-keepalive.md` reruns R8 and R9 without the resend.

`--resend-stale` stays, off, to measure a back from before #438: a
submission — and likewise one of the harness's own reads (the sampler's
polls, settle's checks) — is sent again **once**, only for `UND_ERR_SOCKET`
or `ECONNRESET` on a reused socket before any response. Every retry is
counted in the report's `Retries` section and stays in the HTTP table as the
network error it answered; a second failure is not retried and fails the
run. On a current back, a network error with the resend off is a real
failure to investigate, not this race.
