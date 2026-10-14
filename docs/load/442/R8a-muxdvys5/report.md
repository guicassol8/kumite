# Load report: burst `muxdvys5`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3442 |
| started | 2026-10-07T00:43:10.431Z |
| ended | 2026-10-07T00:46:17.325Z |
| node | v24.21.0 |
| commit | 685bfa8 |
| harness loadavg (1/5/15 min) at start | 1.88 / 2.57 / 3.18 |
| harness loadavg (1/5/15 min) at end | 2.79 / 2.54 / 3.04 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3442 |
| teams | 100 |
| members | 3 |
| sse | 400 |
| submissions | 300 |
| badFraction | 0.1 |
| memoryShare | 0.5 |
| problems | 5 |
| untilDone | true |
| storm | true |
| stormWindowSeconds | 0 |
| pastRounds | 0 |
| resendStale | false |
| restSeconds | 30 |
| durationSeconds | 600 |
| setupConcurrency | 4 |
| sseRamp | 50 |
| sampleIntervalMs | 1000 |
| requestTimeoutMs | 290000 |
| cooldownMs | 5000 |
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/442/R8a/raw |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muxdvys5 (8120ebb1-b175-4439-ada5-52a6aa89d2da) |
| problem | b228f503-df09-45a4-b6f3-134a058b140d |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.1 | 2.0 | 279.0 | 66.5 | 2.0 | 2.0 | 0.009 | 0 | 0 | 30 |
| setup | 73.6 | 137.2 | 149.8 | 473.5 | 99.8 | 88.2 | 88.2 | 0.077 | 0 | 0 | 67 |
| sse-ramp | 8.0 | 37.2 | 45.8 | 334.3 | 134.3 | 12.4 | 12.4 | 0.363 | 0 | 396 | 8 |
| load | 71.3 | 193.9 | 204.4 | 593.2 | 171.8 | 88.4 | 88.4 | 0.133 | 92 | 400 | 70 |
| settle | 0.5 | 55.3 | 55.3 | 458.6 | 141.3 | — | — | — | 0 | 400 | 1 |
| storm | 3.3 | 121.9 | 132.7 | 650.6 | 366.8 | 7.5 | 7.5 | 0.766 | 0 | 400 | 2 |
| teardown | 0.1 | 71.4 | 71.4 | 664.9 | 151.0 | 14.6 | 14.6 | 0.446 | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 10.5 | 21.3 | 0.657 | 0.666 | 11.0 | 15.6 | 1007 | 30 | — |
| setup | 12.5 | 22.5 | 0.651 | 0.665 | 13.3 | 17.2 | 1390 | 73 | — |
| sse-ramp | 29.6 | 37.9 | 0.634 | 0.673 | 11.6 | 14.9 | 1016 | 8 | — |
| load | 19.9 | 33.3 | 0.672 | 0.695 | 24.5 | 58.8 | 1084 | 71 | — |
| settle | 10.5 | 10.5 | 0.668 | 0.668 | 11.0 | 11.0 | 1003 | 1 | — |
| storm | 64.4 | 120.3 | 0.760 | 0.983 | 137.9 | 145.2 | 1355 | 3 | — |
| teardown | 81.6 | 81.6 | 0.885 | 0.885 | 163.1 | 163.1 | 920 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.7 | 6.4 | 17.1 | 17.1 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.4 | 6.0 | 9.7 | 9.7 | 0 |
| `POST /auth/login` | 1 | 200×1 | 96.1 | 96.1 | 96.1 | 96.1 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.9 | 4.9 | 4.9 | 4.9 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.9 | 4.9 | 4.9 | 4.9 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 17.3 | 17.3 | 17.3 | 17.3 | 0 |
| `GET /organizer/stats/live` | 67 | 200×67 | 84.4 | 297.4 | 389.7 | 389.7 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 85.0 | 298.6 | 389.7 | 389.7 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.5 | 11.2 | 11.2 | 11.2 | 0 |
| `POST /auth/login` | 300 | 200×300 | 492.5 | 583.8 | 591.8 | 595.9 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 497.9 | 594.2 | 600.9 | 608.1 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.3 | 4.4 | 4.4 | 4.4 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.1 | 6.9 | 6.9 | 6.9 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 8.3 | 8.3 | 8.3 | 8.3 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.4 | 8.4 | 8.4 | 8.4 | 0 |
| `POST /teams` | 100 | 201×100 | 7.6 | 11.6 | 58.8 | 59.3 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.1 | 15.4 | 19.9 | 21.9 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.0 | 15.1 | 15.1 | 15.1 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.6 | 16.1 | 16.1 | 16.1 | 0 |
| `GET /sse` | 400 | 200×400 | 2.7 | 4.3 | 9.1 | 10.8 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 70 | 200×70 | 3.4 | 70.9 | 83.5 | 83.5 | 0 |
| `GET /organizer/stats/process` | 70 | 200×70 | 3.4 | 72.2 | 84.0 | 84.0 | 0 |
| `POST /submissions` | 300 | 201×300 | 16102.9 | 19485.9 | 26467.7 | 27598.3 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 2.9 | 3.9 | 3.9 | 3.9 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 2.8 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /ranking` | 3 | 200×3 | 6.7 | 7.0 | 7.0 | 7.0 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 8.6 | 9.0 | 9.0 | 9.0 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 124.5 | 336.7 | 336.7 | 336.7 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 124.0 | 336.4 | 336.4 | 336.4 | 0 |
| `GET /ranking` | 3 | 200×3 | 656.3 | 1109.9 | 1109.9 | 1109.9 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 915.8 | 1110.5 | 1110.5 | 1110.5 | 0 |
| `GET /sse` | 400 | 200×400 | 329.8 | 577.2 | 597.8 | 603.1 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 9.2 | 9.2 | 9.2 | 9.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 9.5 | 9.5 | 9.5 | 9.5 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 41.4 | 41.4 | 41.4 | 41.4 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 270 | 0 | 0 |
| memory | 0 | 15 | 0 |
| loop | 0 | 0 | 15 |

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
| correct | 270 | 16083.9 | 17727.4 | 19865.4 | 20265.7 |
| memory | 15 | 16417.1 | 19486.0 | 19486.0 | 19486.0 |
| loop | 15 | 25883.2 | 27598.5 | 27598.5 | 27598.5 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 0.99 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 15619.0 | 17293.9 | 18213.9 | 18985.8 |
| all | spawn | 300 | 311.5 | 412.0 | 500.0 | 606.5 |
| all | exec | 300 | 9.7 | 394.8 | 10080.7 | 10096.2 |
| all | total | 300 | 16013.1 | 18704.5 | 26400.9 | 27584.6 |
| passed | queue | 270 | 15619.0 | 17295.6 | 18600.4 | 18985.8 |
| passed | spawn | 270 | 312.3 | 412.1 | 548.6 | 606.5 |
| passed | exec | 270 | 9.2 | 95.6 | 202.1 | 207.3 |
| passed | total | 270 | 15989.0 | 17683.2 | 19002.6 | 19385.6 |
| runtime_error | queue | 15 | 15709.2 | 18091.4 | 18091.4 | 18091.4 |
| runtime_error | spawn | 15 | 304.3 | 400.3 | 400.3 | 400.3 |
| runtime_error | exec | 15 | 297.1 | 394.8 | 394.8 | 394.8 |
| runtime_error | total | 15 | 16327.2 | 18704.5 | 18704.5 | 18704.5 |
| timeout | queue | 15 | 15400.1 | 17184.6 | 17184.6 | 17184.6 |
| timeout | spawn | 15 | 313.3 | 412.3 | 412.3 | 412.3 |
| timeout | exec | 15 | 10012.0 | 10096.2 | 10096.2 | 10096.2 |
| timeout | total | 15 | 25803.7 | 27584.6 | 27584.6 | 27584.6 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1017.8 | 1020.5 |
| 25 | 2970.2 | 2495.6 |
| 50 | 6812.6 | 6506.0 |
| 75 | 13997.3 | 13098.0 |
| 100 | 18985.8 | 17901.0 |

First k whose p95 queue wait passes 5000 ms: 42.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| payloads validated (distinct / reused) | 1672 / 57592 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 1203.0 / 1203.3 / 1203.3 / 1203.3 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 1000.3 / 1005.1 / 1202.4 / 1203.3 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 72 | 76.2 | 80 |
| ranking.updated | 66 | 66 | 66 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 31664 | 60 | 60 | 60 |
| ranking.updated | 26800 | 28022 | 82299 | 91630 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.95 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.02 / 0.03 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 74 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 383 | 1.25 / 1.72 / 1.72 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 71 | 400 | 1.79 / 2.65 / 2.76 | — / — / — | — / — / — | — / — / — |
| load | ranking | 64 | 400 | 1.96 / 70.62 / 71.40 | 1.56 / 14.33 / 15.13 | 12.73 / 89.20 / 97.05 | 4.70 / 75.99 / 85.78 |
| settle | heartbeat | 1 | 400 | 1.88 / 1.88 / 1.88 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 1.38 / 1.38 / 1.38 | 7.78 / 7.78 / 7.78 | 3.93 / 3.93 / 3.93 | 3.27 / 3.27 / 3.27 |
| storm | heartbeat | 3 | 400 | 0.59 / 1.50 / 1.50 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.9 / 1.5 / 1.8 / 3.6 | 5.8 / 10.2 / 15.3 / 26.0 | 7.0 / 11.9 / 16.9 / 27.9 | 2 |
| load | 1 | 0.9 / 0.9 / 0.9 / 0.9 | 4.7 / 4.7 / 4.7 / 4.7 | 5.7 / 5.7 / 5.7 / 5.7 | 1 |
| storm | 400 | 136.9 / 168.3 / 171.3 / 172.5 | 1673.1 / 1849.0 / 1861.1 / 1871.9 | 1842.1 / 1969.4 / 1977.9 / 1988.2 | 400 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 4 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 543 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 329.8 / 577.2 / 597.8 / 603.1 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 496.9 / 702.0 / 714.1 / 716.2 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2256.1 / 2834.3 / 2880.5 / 2893.8 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2556 ms) |

