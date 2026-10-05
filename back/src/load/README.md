# Load harness

Generates load against the back and reports what it saw (#136, part of
#135). TypeScript, Node's own `fetch`, no new dependency. It builds its own
world through the public API (signups, teams, a round), holds `/sse`
connections open, sends submissions, and polls the back's own metrics
(`GET /organizer/stats/process` and `/organizer/stats/live`) as the
organizer.

It lives in `back/src/load/` rather than in a package of its own, so it
shares the back's `tsc`, vitest and `tsx`. It reaches the API through the
typed client (`hc<AppType>`, type-only) and validates SSE payloads with the
back's own `SseEventSchema`. It is not a kata module.

## Scenarios

```bash
pnpm load:baseline            # 100 teams × 3, 400 idle SSE, no submission
pnpm load:smoke               # 10 teams × 2, 20 SSE, 30 submissions (10% infinite loops)
pnpm load smoke --teams 5     # any flag overrides the preset
pnpm load --help
```

| flag (env) | `baseline` | `smoke` |
|---|---|---|
| `--url` (`LOAD_API_URL`; default `http://localhost:$PORT`) | | |
| `--teams` | 100 | 10 |
| `--members` (capped at the event's `maxTeamSize`) | 3 | 2 |
| `--sse` (round-robin across the participants) | 400 | 20 |
| `--submissions` (total; 0 = no round) | 0 | 30 |
| `--bad-fraction` (share of infinite loops) | 0 | 0.1 |
| `--rest` s / `--duration` s | 60 / 120 | 10 / 90 |
| `--setup-concurrency` · `--sse-ramp` (connections/s) · `--sample-interval` ms · `--request-timeout` ms · `--cooldown` ms | 4 · 50 · 1000 · 60000 · 5000 | same |
| `--out` (default `load-results/` at the repo root) · `--problem-id` (default: the seeded "Soma dos Pares") · `--allow-remote` | | |

A run goes through `rest` (the back idle, only the organizer polling),
`setup` (signups + logins with bounded concurrency — argon2 costs 64 MiB per
hash, so 400 at once would exhaust a 4 GB back; its duration is the event's
opening signup rush), `sse-ramp`, then `sse-idle` (baseline) or `load`
(smoke) for `--duration`, and `teardown` (streams closed, the run's round
closed). SSE connections are never reconnected: a drop is counted.

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

## Output

Each run writes `report.md` and `report.json` into
`load-results/<scenario>-<runId>/` (git-ignored) and prints the Markdown to
stdout; progress goes to stderr. The reports worth keeping are copied into
`docs/load/` (then `pnpm format`: biome reflows the JSON).

The report has: the run (target, Node, commit, start/end, the harness
machine's load average and parallelism), the config, the world built, a
table per phase of the back's CPU %, RSS, heap, event-loop lag and
utilization, judge queue and server-side SSE count, HTTP latency
(p50/p95/p99/max) and status counts per route and phase, the verdict matrix
(sent × verdict), actions started vs completed, and SSE (opened, failed,
dropped and why, events per connection, heartbeat gaps). The JSON also
carries the raw back samples and event-loop windows.

Exit codes: `0` passed, `1` the run had failures (listed first in the
report), `2` configuration error. Ctrl-C once stops scheduling, closes the
streams and still writes the report (marked partial); twice quits at once.

### What fails a run

Only these, each counted and listed — the run never stops at the first:

- any 5xx;
- a status the call site did not expect (a 429 on a submission is expected:
  it waits and retries, up to 3 times);
- a network error or a timeout (an action that started and never completed);
- an SSE connection that did not open, or that dropped before the harness
  closed it;
- an SSE payload that `SseEventSchema` rejects;
- a verdict incoherent with what was sent (the correct solution must be
  `accepted`, the infinite loop `timeout`);
- an error that stopped a phase (setup included), and an abort.

Latency, CPU, memory and lag are observations: they never fail a run.
