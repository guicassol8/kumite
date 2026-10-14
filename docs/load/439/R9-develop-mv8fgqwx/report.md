# Load report: burst `mv8fgqwx`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3440 |
| started | 2026-10-14T18:12:47.557Z |
| ended | 2026-10-14T18:17:01.555Z |
| node | v24.21.0 |
| commit | a5050fc |
| harness loadavg (1/5/15 min) at start | 0.92 / 1.59 / 1.77 |
| harness loadavg (1/5/15 min) at end | 2.60 / 2.35 / 2.06 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3440 |
| teams | 100 |
| members | 3 |
| sse | 400 |
| submissions | 300 |
| badFraction | 0.3 |
| memoryShare | 0.5 |
| problems | 5 |
| untilDone | true |
| storm | true |
| stormWindowSeconds | 2 |
| pastRounds | 0 |
| resendStale | false |
| restSeconds | 30 |
| durationSeconds | 600 |
| setupConcurrency | 4 |
| sseRamp | 50 |
| sampleIntervalMs | 1000 |
| requestTimeoutMs | 290000 |
| cooldownMs | 5000 |
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3cbb33f2-aa81-414a-834c-d64a0a6449ee/scratchpad/t439-a798/runs/R9/results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-mv8fgqwx (4d30ec51-6e91-47a0-aa25-24a40874f325) |
| problem | 6eb51199-658c-41d1-8921-87a5f8f19aca |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.8 | 278.6 | 66.6 | 1.4 | 1.4 | 0.006 | 0 | 0 | 30 |
| setup | 72.6 | 133.1 | 150.3 | 473.2 | 100.5 | 84.9 | 84.9 | 0.086 | 0 | 0 | 65 |
| sse-ramp | 8.0 | 34.0 | 53.4 | 310.8 | 112.3 | 5.4 | 6.6 | 0.261 | 0 | 385 | 8 |
| load | 140.5 | 197.9 | 207.4 | 547.6 | 146.0 | 89.1 | 90.6 | 0.082 | 96 | 400 | 139 |
| settle | 0.3 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 2.5 | 103.0 | 124.6 | 455.8 | 147.0 | 4.2 | 4.2 | 0.765 | 0 | 295 | 2 |
| teardown | 0.1 | 89.2 | 89.2 | 469.4 | 145.1 | 4.1 | 4.1 | 0.789 | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.7 | 9.4 | 0.003 | 0.026 | 11.7 | 13.4 | 1007 | 30 | — |
| setup | 2.3 | 10.0 | 0.017 | 0.046 | 13.9 | 19.2 | 1401 | 72 | — |
| sse-ramp | 17.3 | 26.0 | 0.120 | 0.166 | 11.9 | 12.6 | 1013 | 8 | — |
| load | 7.8 | 18.8 | 0.041 | 0.143 | 19.6 | 34.4 | 1172 | 141 | — |
| settle | — | — | — | — | — | — | — | 0 | — |
| storm | 67.4 | 67.9 | 0.567 | 0.638 | 18.5 | 90.2 | 1027 | 2 | — |
| teardown | 67.8 | 67.8 | 0.628 | 0.628 | 22.4 | 74.8 | 1015 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up; a slow answer from the back widens it too, so it points at the harness only next to a high ELU or lag). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.3 | 5.3 | 18.4 | 18.4 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.1 | 5.0 | 9.5 | 9.5 | 0 |
| `POST /auth/login` | 1 | 200×1 | 84.5 | 84.5 | 84.5 | 84.5 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.2 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.2 | 5.2 | 5.2 | 5.2 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.4 | 15.4 | 15.4 | 15.4 | 0 |
| `GET /organizer/stats/live` | 65 | 200×65 | 89.7 | 300.0 | 399.4 | 399.4 | 0 |
| `GET /organizer/stats/process` | 65 | 200×65 | 93.9 | 299.6 | 399.4 | 399.4 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.5 | 10.8 | 10.8 | 10.8 | 0 |
| `POST /auth/login` | 300 | 200×300 | 488.2 | 579.6 | 589.5 | 594.1 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 494.7 | 592.5 | 1094.3 | 1107.0 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.8 | 4.5 | 4.5 | 4.5 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.4 | 6.6 | 6.6 | 6.6 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.4 | 9.4 | 9.4 | 9.4 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.5 | 8.5 | 8.5 | 8.5 | 0 |
| `POST /teams` | 100 | 201×100 | 7.7 | 9.9 | 75.7 | 76.0 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.5 | 13.8 | 20.9 | 22.5 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 2.8 | 10.6 | 10.6 | 10.6 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.3 | 12.0 | 12.0 | 12.0 | 0 |
| `GET /sse` | 400 | 200×400 | 2.3 | 3.3 | 10.5 | 17.6 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 139 | 200×139 | 2.9 | 70.0 | 83.0 | 170.7 | 0 |
| `GET /organizer/stats/process` | 139 | 200×139 | 2.9 | 69.2 | 83.0 | 170.6 | 0 |
| `POST /submissions` | 300 | 201×300 | 37927.1 | 48612.3 | 51384.4 | 54221.2 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /ranking` | 2 | 200×2 | 8.2 | 13.4 | 13.4 | 13.4 | 0 |
| `GET /rounds/:id/ranking` | 2 | 200×2 | 7.4 | 15.4 | 15.4 | 15.4 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 13.7 | 25.4 | 25.4 | 25.4 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 13.3 | 24.9 | 24.9 | 24.9 | 0 |
| `GET /ranking` | 2 | 200×2 | 5.9 | 119.5 | 119.5 | 119.5 | 0 |
| `GET /rounds/:id/ranking` | 2 | 200×2 | 8.2 | 138.6 | 138.6 | 138.6 | 0 |
| `GET /sse` | 400 | 200×400 | 22.3 | 36.5 | 40.4 | 44.3 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 5.4 | 5.4 | 5.4 | 5.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 40.3 | 40.3 | 40.3 | 40.3 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 210 | 0 | 0 |
| memory | 0 | 45 | 0 |
| loop | 0 | 0 | 45 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |
| submission | 300 | 300 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 210 | 36772.4 | 42882.9 | 44896.9 | 45203.1 |
| memory | 45 | 36224.7 | 42397.0 | 44798.9 | 44798.9 |
| loop | 45 | 46179.3 | 52158.4 | 54221.3 | 54221.3 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×210, runtime_error×45, timeout×45 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 0.99 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 36093.4 | 42473.9 | 44404.7 | 44878.6 |
| all | spawn | 300 | 283.5 | 383.5 | 472.9 | 502.8 |
| all | exec | 300 | 12.0 | 10010.7 | 10076.4 | 10089.8 |
| all | total | 300 | 37400.2 | 48599.4 | 51307.2 | 54200.3 |
| passed | queue | 210 | 36321.8 | 42491.1 | 44512.0 | 44878.6 |
| passed | spawn | 210 | 283.0 | 385.8 | 480.4 | 502.8 |
| passed | exec | 210 | 7.7 | 87.6 | 108.5 | 201.0 |
| passed | total | 210 | 36695.2 | 42798.0 | 44816.4 | 45187.3 |
| runtime_error | queue | 45 | 35796.7 | 41898.2 | 44291.9 | 44291.9 |
| runtime_error | spawn | 45 | 283.3 | 380.6 | 400.6 | 400.6 |
| runtime_error | exec | 45 | 207.0 | 310.1 | 394.8 | 394.8 |
| runtime_error | total | 45 | 36208.4 | 42383.2 | 44720.4 | 44720.4 |
| timeout | queue | 45 | 35804.4 | 41071.8 | 43895.6 | 43895.6 |
| timeout | spawn | 45 | 291.8 | 383.1 | 400.5 | 400.5 |
| timeout | exec | 45 | 10009.0 | 10081.0 | 10089.8 | 10089.8 |
| timeout | total | 45 | 46084.9 | 51371.3 | 54200.3 | 54200.3 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1350.6 | 1350.6 |
| 25 | 3481.8 | 3295.8 |
| 50 | 21014.1 | 16203.2 |
| 75 | 29906.3 | 28907.4 |
| 100 | 41115.0 | 39898.9 |

First k whose p95 queue wait passes 5000 ms: 29.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| payloads validated (distinct / reused) | 1818 / 94225 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 1403.9 / 1405.8 / 1406.2 / 1406.3 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 1000.0 / 1004.0 / 1077.3 / 1406.3 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 141 | 144.9 | 149 |
| ranking.updated | 91 | 91 | 91 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 58443 | 60 | 60 | 60 |
| ranking.updated | 36800 | 28022 | 82747 | 91530 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.92 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 72 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 372 | 0.78 / 1.53 / 1.53 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 140 | 400 | 1.41 / 2.51 / 77.30 | — / — / — | — / — / — | — / — / — |
| load | ranking | 89 | 400 | 1.58 / 61.27 / 69.57 | 1.10 / 12.21 / 78.72 | 11.77 / 87.18 / 88.63 | 3.79 / 71.05 / 74.39 |
| settle | heartbeat | 1 | 400 | 1.25 / 1.25 / 1.25 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 1.43 / 1.43 / 1.43 | 1.05 / 1.05 / 1.05 | 14.06 / 14.06 / 14.06 | 3.34 / 3.34 / 3.34 |
| storm | heartbeat | 2 | 333 | 0.59 / 1.27 / 1.27 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — the frame encoded once, in the first subscriber (#439), plus N writes of it queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.1 / 1.5 / 4.0 | 5.4 / 7.0 / 8.8 / 9.6 | 6.4 / 8.1 / 10.4 / 11.0 | 2 |
| load | 1 | 0.9 / 0.9 / 0.9 / 0.9 | 6.2 / 6.2 / 6.2 / 6.2 | 7.3 / 7.3 / 7.3 / 7.3 | 1 |
| storm | 400 | 17.8 / 31.6 / 34.3 / 40.5 | 180.0 / 287.7 / 292.6 / 294.2 | 197.7 / 314.2 / 322.3 / 323.7 | 65 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 285 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 2 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 22.3 / 36.5 / 40.4 / 44.3 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 39.1 / 64.8 / 67.9 / 70.2 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 222.5 / 350.1 / 353.5 / 357.4 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 406 ms) |

