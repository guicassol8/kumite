# The keep-alive race, after the fix (#438)

R8 and R9 of #138 (`docs/load/138-sse-fanout.md`), rerun **without**
`--resend-stale` on a back that announces `Keep-Alive: timeout=130` and
closes an idle socket at 131 s (`back/src/lib/http-server.ts`). Before the
fix, the back closed idle sockets at 6 s (Node's 5 s default plus its 1 s
buffer) and the same runs lost 35 and 18 submissions to the race.

The raw reports are in [`438/`](438/).

## Verdict

**Both runs PASS with 0 network errors.** Every `POST /submissions` got a
201, the back's request log has 300 `POST /submissions` lines per run, and
the `Retries` section is empty, because the resend was off.

| # | run | `POST /submissions` with a network error, #138 → #438 | network errors, all routes and phases | `POST /submissions` statuses | retries | result |
|---|---|---|---|---|---|---|
| R8 | `pnpm load:burst --bad-fraction 0.1` | 35 → **0** | 0 | 201×300 | none | PASS |
| R9 | `pnpm load:burst --bad-fraction 0.3 --storm-window 2` | 18 → **0** | 0 | 201×300 | none | PASS |

- **The verdicts are coherent:** R8 judged 270 accepted, 15 runtime_error
  and 15 timeout; R9 judged 210, 45 and 45. Incoherent: 0.
- **The SSE side matches #138:** in both runs all 400 connections stayed
  open, and every connection's ranking matched the API after the load and
  after the storm.

## The stalls were still there

This branch does not include #439, so the fan-out stays synchronous. The
event-loop stalls that widened the race in #138 were still present, which
makes this a fair rerun:

| # | `ranking.updated` publish ms, p50 / p95 / max | load-phase lag max ms |
|---|---|---|
| R8 of #138 | 132.99 / 293.73 / 377.31 | 502.1 |
| R8 here | 205.73 / 311.87 / 394.63 | 672.3 |
| R9 of #138 | 196.44 / 276.51 / 363.54 | 565.5 |
| R9 here | 193.02 / 297.33 / 303.66 | 508.6 |

## Environment

The same as #137 and #138:

- **The back:** commit `34d84bf`, under `systemd-run --user --scope -p
  CPUQuota=200% -p MemoryMax=4G -p MemorySwapMax=0`. `systemctl --user show`
  on each run's scope confirmed `CPUQuotaPerSecUSec=2s`,
  `MemoryMax=4294967296` and `MemorySwapMax=0`. `JUDGE_CONCURRENCY=4`.
- **Each run started clean:** the database was reset with `pnpm
  worktree:env --reset` and the back restarted.
- **Each cycle held `/tmp/kumite-load.lock`** from the reset to the back's
  stop, so no other worktree's measurement overlapped it.
- **The fix was live:** before the harness started, a `curl -si /health` on
  each booted back returned `Keep-Alive: timeout=130`.

Each run waited for a 1-minute load average under 1.0 before the back
booted. The load averages below are from the report header, taken at the
harness's start:

| # | harness load average (1/5/15 min), start → end | started (UTC) |
|---|---|---|
| R8 | 0.96 / 2.18 / 1.34 → 3.60 / 3.02 / 1.85 | 2026-10-05 23:03 |
| R9 | 0.85 / 1.75 / 1.60 → 2.53 / 2.25 / 1.85 | 2026-10-05 23:11 |

## Why it holds

The fix closes the race on both paths, the harness's and production's:

- **The harness (undici)** honors the back's `Keep-Alive: timeout=130`. It
  drops an idle socket a little before 130 s, well after the 5 s cooldown
  between a team's submissions. This is the path these runs measure.
- **Production (Caddy v2.11.4)** ignores that header. Its upstream pool
  keeps an idle socket for 2 min, and the `Caddyfile` now pins that value.
  The back closes at 131 s, so Caddy always drops an idle socket first. A
  back test reads the `Caddyfile`'s `keepalive` and fails if the back would
  close first.

The sources these defaults were read from are in the module comment of
`back/src/lib/http-server.ts`.

Pending: confirmation on the VPS through Caddy (#139).
