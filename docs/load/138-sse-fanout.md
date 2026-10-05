# SSE fan-out and the ranking payload under a burst (#138)

The burst of #137 (`docs/load/137-judge-burst.md`), now with **400 SSE
connections** open throughout. The setup is the same: 100 teams × 3, a round
of 5 problems, 300 submissions with the first wave all at once.

Each run measures:

- what each `ranking.updated` costs, both building it and fanning it out;
- how big each event type is on the wire;
- what a connect's snapshot costs;
- whether every connection ends with the same ranking as the API, both after
  the load and after a reconnect storm (every stream closed and reopened).

All the runs are local. **Pending: confirmation on the VPS (#139).** The raw reports are in
[`138/`](138/).

## Verdict

**R8, R9 and R10 failed**, for one reason: a **confirmed back finding, not a
harness defect**. Some `POST /submissions` died before any response, on a
keep-alive socket the back closed just as it was reused. The details are in
[the keep-alive race](#the-keep-alive-race-438) below, and the issue is
#438.

Everything else #138 asks for **passed**, in all seven runs:

- all 400 connections stayed open through the burst, with none dropped and
  no invalid payload;
- no 5xx;
- every connection ended with the same ranking, equal to
  `GET /rounds/:id/ranking` + `GET /ranking`, both after the load and after
  the storm.

The fan-out's cost is measured. It is large enough to be a finding of its
own: #439.

## Environment

The same as #137:

- the back on the same commit, under `systemd-run` with 2 CPUs, 4 GB and no
  swap, verified on every scope;
- `JUDGE_CONCURRENCY=4`;
- the database reset and the back restarted before every run;
- each run waited for a 1-minute load average under 1.0.

The load averages below are taken at the harness's start, after the back
booted. The reruns started a little above 1.0 because the previous run's
load was still decaying.

| # | run | resend | harness load average (1/5/15 min), start → end |
|---|---|---|---|
| R8 | `pnpm load:burst --bad-fraction 0.1` (400 SSE, storm all at once) | — | 0.84 / 1.37 / 1.42 → 3.23 / 1.79 / 1.54 |
| R9 | `pnpm load:burst --bad-fraction 0.3 --storm-window 2` | — | 0.90 / 1.38 / 1.41 → 2.73 / 1.79 / 1.54 |
| R10 | `pnpm load:burst --bad-fraction 0.1 --past-rounds 3` | — | 0.85 / 1.41 / 1.42 → 2.70 / 2.30 / 1.79 |
| R8b | R8, with each network error's detail recorded | off | 0.28 / 0.84 / 1.28 → 2.45 / 1.75 / 1.55 |
| R8c | R8, resending once after a stale socket (now `--resend-stale`) | 1× | 1.35 / 1.48 / 1.48 → 3.06 / 2.11 / 1.72 |
| R9c | R9, the same | 1× | 1.03 / 1.68 / 1.61 → 3.60 / 2.83 / 2.10 |
| R10c | R10, the same | 1× | 0.89 / 2.12 / 1.92 → 3.06 / 2.81 / 2.27 |

- **Commits.** R8–R10 ran at commit `ed48fe6`. The reruns ran on the commits
  that added the error detail (`b5f7bf9`) and the resend (`b32ec95`).
- **The resend is off by default now.** `--resend-stale` masks the
  Caddy→back race, so the harness leaves it off to model production (see
  below).

## The keep-alive race (#438)

| # | `POST /submissions` that failed | resent | failed again | result |
|---|---|---|---|---|
| R8 | 35 | — | — | FAIL |
| R9 | 18 | — | — | FAIL |
| R10 | 5 | — | — | FAIL |
| R8b | 28 | — | — | FAIL |
| R8c | 25 | 23 | 2 | FAIL |
| R9c | 29 | 22 | 7 | FAIL |
| R10c | 3 | 3 | 0 | PASS |

- **The harness's own reads hit it too.** Its stats polls failed the same
  way, 1–3 times per run.
- **None of these requests reached the back.** Its request log has exactly
  as many `POST /submissions` lines as completed submissions.
- **Every error was the same**, wherever the detail was recorded:
  `UND_ERR_SOCKET` "other side closed", before any response byte, on a
  reused socket.
- **The socket's byte counters show the reuse.** It had written about
  4,144 bytes, roughly two submission POSTs, and read about 695, one earlier
  response.
- **R1–R7 of #137, with no SSE, never hit it.** That is 2,400 submissions.

### The race

1. Node's HTTP server closes an idle keep-alive socket after
   `keepAliveTimeout`, 5 s by default. The back uses the default.
2. A team's next submission comes after a 5 s cooldown, so the client often
   picks a socket that has been idle for about 5 s.
3. The back closes it while the request is on its way. The client gets
   "other side closed" before any response and does not resend a POST.

### Why the fan-out widens it

Each `ranking.updated` holds the event loop for 130–600 ms (below). While
the loop is stuck, the back's keep-alive timers fire late and in a batch,
and a request that already reached a socket is not read in time. Resending
once is not enough: the resend picks another idle socket from the same pool,
which the back is closing in the same batch. That is what happened to 2 of
23 resends in R8c and 7 of 22 in R9c.

### Why browsers would not see it, and why participants still would

- **A browser would not see it directly.** A browser resends a request that
  fails on a reused connection before any response. Talking to the back
  directly, a participant would never notice.
- **But in production, nobody talks to the back directly.** The browsers
  talk to Caddy (`Caddyfile`: `reverse_proxy back:3000`), and Caddy keeps its
  own keep-alive pool to the back.
- **Caddy would expose it, according to the documentation.** These defaults
  are **still to verify**, and #438 includes checking them:
  - Caddy's upstream idle timeout is about 2 min, far above the back's 5 s;
  - Go's `http.Transport` does not resend a non-idempotent POST that fails on
    a reused connection.
- **So the same race would most likely become a 502 on submit** for a
  participant, in the final rush of a round.
- **The harness without a resend models Caddy.** undici behaves the same way
  on this point, which is why `--resend-stale` stays off.

### Acceptance 1 of #138

"No 5xx on the HTTP routes served in parallel" held at the back: the back
answered no 5xx. Through Caddy, the failed requests above would most likely
have been **502s**. #438 is the fix, and its acceptance is to rerun R8 and
R9 without the resend and get 0 network errors.

## SSE connections and heartbeat

| # | opened / dropped / invalid | heartbeat interval ms, p50 / p95 / p99 / max | largest gap per connection, p50 / max |
|---|---|---|---|
| R8 | 400 / 0 / 0 | 888 / 4,075 / 4,866 / 9,392 | 4.9 s / 9.4 s |
| R9 | 400 / 0 / 0 | 4 / 6,174 / 9,645 / 18,756 | 10.1 s / 18.8 s |
| R10 | 400 / 0 / 0 | 4 / 6,325 / 10,086 / 20,813 | 11.3 s / 20.8 s |

- **The cadence suffers badly**, as an observation: the 1 s heartbeat
  arrives up to 20 s late.
- **The tiny intervals (4 ms) are heartbeats delivered in a batch** once the
  loop frees up.
- **No connection dropped.** Neither the harness nor the front's client
  (`front/src/lib/sse-client.ts`) has a heartbeat timeout, so a late
  heartbeat closes nothing.
- **The reruns agree:** the largest gap is 14–40 s.

## Payloads

`data:` line in UTF-8, over every event every connection received:

| event | R8 min / mean / max | R10 (3 past rounds) min / mean / max |
|---|---|---|
| `state.sync` | 179 / 179 / 179 B | 179 / 179 / 179 B |
| `heartbeat` | 60 / 60 / 60 B | 60 / 60 / 60 B |
| `ranking.updated` | 28,022 / 80,988 / 91,654 B | 67,441 / 121,640 / 130,715 B |

- **One ranking emission writes 36.7 MB** in total: the largest
  `ranking.updated` times 400 connections. With 3 past rounds it writes
  52.3 MB.
- **The event ranking sums every non-draft round**, so the payload grows
  with each round of the event, and it goes out whole on every emission.
- **Not counted here: the herd of refetches.** Every tab refetches its HTTP
  rankings on `round.closed`, which multiplies the traffic of a round's end.
  The note is on #139.

## Emissions (back)

Load phase, 400 subscribers:

| # | ranking emissions | publish ms, p50 / p95 / max | open round ms, p50 / p95 | round ranking ms, p50 / p95 | event ranking ms, p50 / p95 | heartbeat publish ms, p50 / max |
|---|---|---|---|---|---|---|
| R8 | 58 | 133 / 294 / 377 | 1.2 / 87 | 68 / 98 | 4.9 / 74 | 1.1 / 76 |
| R9 | 117 | 196 / 277 / 364 | 9.0 / 77 | 14 / 92 | 5.0 / 75 | 1.1 / 1.6 |
| R10 | 79 | 271 / 486 / 498 | 1.6 / 15 | 14 / 96 | 18 / 92 | 0.9 / 1.7 |

- **What `publish` measures.** It is the synchronous `bus.publish`: one
  `JSON.stringify` per subscriber, plus the write queued. It does not include
  the socket write. The worst publish across the reruns was 601 ms (R10c).
- **The fan-out is the expensive part, not the queries.**
  - **Queries:** building the snapshot takes a few ms per stage with an idle
    loop. Its p95 near 100 ms is mostly the loop being busy.
  - **Fan-out:** the synchronous publish takes hundreds of ms on every
    emission.
- **The effect on the event loop.** The lag p99 in the load phase goes from
  80 ms (R2 of #137, no SSE) to 502 ms (R8), 562 ms (R9) and 692 ms (R10).
- **RSS** peaked at 669 MiB in R8 and about **2.0 GB in R10**: the bigger
  payloads queue up in the write buffers while the loop is stuck.

## Where the fan-out competes with the judge

Same bad fraction, without and with 400 streams:

| | R2 (no SSE) | R8 (400 SSE) | R3 (no SSE) | R9 (400 SSE) |
|---|---|---|---|---|
| correct submission p50 / p95 | 15.0 / 16.4 s | 18.0 / 24.8 s | 37.4 / 41.7 s | 43.8 / 54.0 s |
| back CPU % mean, load | 193 | 196 | 197 | 200 |
| event-loop lag p99, load | 80 ms | 502 ms | 71 ms | 562 ms |
| first k whose p95 queue wait passes 5 s | 46 | 42 | 24 | 25 |

The reruns R8b, R8c and R9c put the correct submission's p50 at 20.6–22.2 s
for R8 and 47.3 s for R9.

## Connects and the storm (back)

- **During the ramp** (50 connections/s), a connect's snapshot costs little:
  - total 6–16 ms at p50 and 8–16 ms at p95;
  - at most 2–5 snapshots being built at once.
- **The storm costs that many snapshots at once:**

| # | storm | snapshots at once (max) | snapshot total ms, p50 / p95 / max | to headers, p50 / max | to the first `ranking.updated`, p50 / p95 / max | ranking consistent after it |
|---|---|---|---|---|---|---|
| R8 | 400 at once | 396 | 1,492 / 1,715 / 1,745 | 256 / 300 ms | 2,063 / 2,549 / 2,599 ms | yes, 400 compared, 1 digest = API |
| R9 | 400 over 2 s | 77 | 274 / 381 / 391 | 28 / 48 ms | 309 / 421 / 432 ms | yes |
| R10 | 400 at once, 3 past rounds | 397 | 3,868 / 4,269 / 4,294 | 312 / 352 ms | 4,789 / 5,571 / 5,709 ms | yes |

- **A storm costs about as many snapshots as there are connections.** When
  all 400 reconnect at once, as after a back restart (the front's reconnect
  backoff has no jitter), every one waits 1.5–4.3 s for its snapshot.
- **A 2 s spread makes it about 5× cheaper.** The note on jitter is on #139.
- **Every new connection received its snapshot.** In all seven runs, the
  ranking was consistent after the storm.

## Acceptance (#138)

- **400 connections stay alive through the burst, with no 5xx served in
  parallel.** The connections held, and the back answered no 5xx. But up to
  35 submissions per run died on the keep-alive race, which through Caddy
  would most likely be 502s. Finding #438.
- **Every connection gets the same score, equal to the API at the end.**
  Accepted in every run, at settle and after the storm.
- **Heartbeat cadence, lag, CPU/RSS and payload sizes recorded as
  observations.** Accepted: they are in the tables above.
- **Anything disproportionately expensive gets an issue instead of a fix
  here.** Accepted:
  - **#439**, the synchronous fan-out: 130–600 ms per emission, a 20 s
    heartbeat delay, RSS around 2 GB with past rounds, 92–131 KB payloads;
  - **#438**, the keep-alive race that the fan-out's stalls widen.

## Conclusion

- **Where the fan-out starts competing with the judge: from the first
  emission under load.** With 400 connections, a single `ranking.updated`
  holds the event loop for 130–600 ms, and the first wave waits longer for
  its verdicts. The correct submission's p50 rises 20–48% at 10% bad
  (15.0 → 18.0–22.2 s) and 17–26% at 30% (37.4 → 43.8–47.3 s).
- **The serialization and the write are the cost, not the queries.**
  - **The serialization:** the payload is the whole event ranking,
    serialized once per connection.
  - **The write:** the result is held in buffers while the loop is stuck.
  - It grows with the number of rounds in the event: 92 KB with one round,
    131 KB with four, and about 2 GB of RSS.
- **What a connect and a storm cost.**
  - **One connect** costs 6–16 ms.
  - **A storm of 400 at once** costs 1.5–4.3 s per connection to its
    snapshot.
  - **Spread over 2 s**, it costs about 0.3–0.4 s.
- **Bandwidth per emission.** 36.7 MB with one round (the largest
  `ranking.updated` × 400) and 52.3 MB with four rounds. That is per second
  of a busy round, since the debounce emits at most once a second.
- **The fan-out's stalls turn a latent keep-alive race into failed
  submissions.** The back closes idle sockets at 5 s, below what Caddy keeps
  them for. #438 fixes the timeouts; #439 removes the stalls.

Pending: confirmation on the VPS (#139).
