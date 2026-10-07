# Load report: burst `muxe528h`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3442 |
| started | 2026-10-07T00:50:14.805Z |
| ended | 2026-10-07T00:53:57.189Z |
| node | v24.21.0 |
| commit | 685bfa8 |
| harness loadavg (1/5/15 min) at start | 1.73 / 2.27 / 2.80 |
| harness loadavg (1/5/15 min) at end | 2.48 / 2.21 / 2.64 |
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
| pastRounds | 3 |
| resendStale | false |
| restSeconds | 30 |
| durationSeconds | 600 |
| setupConcurrency | 4 |
| sseRamp | 50 |
| sampleIntervalMs | 1000 |
| requestTimeoutMs | 290000 |
| cooldownMs | 5000 |
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/442/R10/raw |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muxe528h (28fdb87e-70ed-4411-a8e8-8784a9e28523) |
| problem | 5e8a719f-faa7-4513-bb74-3d306af2542d |
| problems in the round | 5 |
| past rounds | load-muxe528h-r0, load-muxe528h-r1, load-muxe528h-r2 |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.7 | 278.4 | 66.1 | 1.1 | 1.1 | 0.007 | 0 | 0 | 30 |
| setup | 109.5 | 156.0 | 204.5 | 475.8 | 127.3 | 84.6 | 85.3 | 0.113 | 82 | 0 | 102 |
| sse-ramp | 8.0 | 51.9 | 91.7 | 489.2 | 182.9 | 47.1 | 47.1 | 0.382 | 0 | 387 | 8 |
| load | 69.3 | 193.4 | 209.1 | 689.4 | 235.8 | 94.6 | 94.6 | 0.144 | 92 | 400 | 68 |
| settle | 1.2 | 65.2 | 65.2 | 558.2 | 115.8 | 5.8 | 5.8 | 0.048 | 0 | 400 | 1 |
| storm | 4.2 | 111.0 | 140.4 | 629.8 | 256.5 | 15.1 | 15.1 | 0.821 | 0 | 400 | 3 |
| teardown | 0.1 | 35.6 | 35.6 | 647.7 | 297.4 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.7 | 9.0 | 0.004 | 0.025 | 10.8 | 13.9 | 1008 | 30 | — |
| setup | 2.2 | 21.5 | 0.016 | 0.169 | 13.7 | 28.1 | 1478 | 109 | — |
| sse-ramp | 20.3 | 24.0 | 0.159 | 0.177 | 12.5 | 13.5 | 1005 | 8 | — |
| load | 12.2 | 28.9 | 0.075 | 0.151 | 46.1 | 95.9 | 1097 | 69 | — |
| settle | 13.9 | 25.7 | 0.075 | 0.132 | 41.6 | 50.0 | 1004 | 2 | — |
| storm | 51.1 | 87.8 | 0.452 | 0.858 | 522.5 | 522.5 | 1604 | 4 | — |
| teardown | 65.9 | 65.9 | 0.490 | 0.490 | 82.8 | 82.8 | 877 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 6.0 | 15.8 | 15.8 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 6.0 | 8.4 | 8.4 | 0 |
| `POST /auth/login` | 1 | 200×1 | 82.2 | 82.2 | 82.2 | 82.2 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.0 | 4.0 | 4.0 | 4.0 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.4 | 4.4 | 4.4 | 4.4 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.8 | 4.8 | 4.8 | 4.8 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.9 | 15.9 | 15.9 | 15.9 | 0 |
| `GET /organizer/stats/live` | 102 | 200×102 | 12.6 | 298.3 | 378.2 | 477.0 | 0 |
| `GET /organizer/stats/process` | 102 | 200×102 | 10.7 | 294.9 | 316.6 | 379.5 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.2 | 12.0 | 12.0 | 12.0 | 0 |
| `POST /auth/login` | 300 | 200×300 | 485.9 | 580.9 | 590.6 | 609.0 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 490.8 | 581.9 | 595.2 | 599.1 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.0 | 5.0 | 5.0 | 5.0 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.5 | 6.8 | 6.8 | 6.8 | 0 |
| `POST /organizer/rounds` | 4 | 201×4 | 8.5 | 8.8 | 8.8 | 8.8 | 0 |
| `POST /organizer/rounds/:id/close` | 3 | 200×3 | 11.1 | 68.1 | 68.1 | 68.1 | 0 |
| `POST /organizer/rounds/:id/open` | 4 | 200×4 | 7.6 | 62.7 | 62.7 | 62.7 | 0 |
| `POST /submissions` | 379 | 201×300, 429:submission_throttled×79 | 4060.8 | 10151.4 | 12043.9 | 12254.9 | 0 |
| `POST /teams` | 100 | 201×100 | 7.9 | 11.9 | 13.2 | 14.1 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.5 | 14.3 | 62.7 | 69.2 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.3 | 3.7 | 3.7 | 3.7 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.1 | 3.7 | 3.7 | 3.7 | 0 |
| `GET /sse` | 400 | 200×400 | 2.3 | 3.0 | 6.4 | 13.6 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 68 | 200×68 | 3.5 | 73.5 | 93.6 | 93.6 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 3.4 | 73.3 | 93.4 | 93.4 | 0 |
| `POST /submissions` | 300 | 201×300 | 15406.6 | 19423.9 | 25730.6 | 27932.3 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 2.4 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 2.7 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /ranking` | 5 | 200×5 | 14.1 | 70.2 | 70.2 | 70.2 | 0 |
| `GET /rounds/:id/ranking` | 5 | 200×5 | 7.8 | 63.7 | 63.7 | 63.7 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 461.5 | 526.0 | 526.0 | 526.0 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 463.9 | 522.0 | 522.0 | 522.0 | 0 |
| `GET /ranking` | 3 | 200×3 | 1518.2 | 1579.0 | 1579.0 | 1579.0 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 800.7 | 1518.0 | 1518.0 | 1518.0 | 0 |
| `GET /sse` | 400 | 200×400 | 267.2 | 455.2 | 467.1 | 469.6 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 5.1 | 5.1 | 5.1 | 5.1 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 5.4 | 5.4 | 5.4 | 5.4 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 37.1 | 37.1 | 37.1 | 37.1 | 0 |

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
| past-submission | 300 | 300 |
| submission | 300 | 300 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 270 | 15344.2 | 17125.3 | 19424.0 | 19723.2 |
| memory | 15 | 15628.8 | 20250.9 | 20250.9 | 20250.9 |
| loop | 15 | 25101.4 | 27932.4 | 27932.4 | 27932.4 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 0.99 |
| workers spawned / exited / alive at the end | 600 / 600 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 14963.2 | 16574.4 | 18402.5 | 18997.6 |
| all | spawn | 300 | 302.6 | 394.4 | 410.9 | 471.7 |
| all | exec | 300 | 9.3 | 400.1 | 10081.4 | 10108.7 |
| all | total | 300 | 15383.0 | 18793.7 | 25709.5 | 27321.8 |
| passed | queue | 270 | 14909.0 | 16574.4 | 18402.5 | 18792.3 |
| passed | spawn | 270 | 302.9 | 394.9 | 412.9 | 471.7 |
| passed | exec | 270 | 8.7 | 92.8 | 122.0 | 184.2 |
| passed | total | 270 | 15210.1 | 16896.1 | 18793.7 | 19102.8 |
| runtime_error | queue | 15 | 14988.0 | 18997.6 | 18997.6 | 18997.6 |
| runtime_error | spawn | 15 | 302.6 | 389.8 | 389.8 | 389.8 |
| runtime_error | exec | 15 | 282.0 | 400.1 | 400.1 | 400.1 |
| runtime_error | total | 15 | 15504.1 | 19610.4 | 19610.4 | 19610.4 |
| timeout | queue | 15 | 14615.1 | 17011.9 | 17011.9 | 17011.9 |
| timeout | spawn | 15 | 301.4 | 397.1 | 397.1 | 397.1 |
| timeout | exec | 15 | 10010.4 | 10108.7 | 10108.7 | 10108.7 |
| timeout | total | 15 | 25009.0 | 27321.8 | 27321.8 | 27321.8 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 976.7 | 979.7 |
| 25 | 3007.2 | 2695.0 |
| 50 | 7022.2 | 6768.3 |
| 75 | 14411.1 | 13920.8 |
| 100 | 18997.6 | 18099.5 |

First k whose p95 queue wait passes 5000 ms: 41.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| payloads validated (distinct / reused) | 1653 / 56593 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 1074.2 / 1074.9 / 1074.9 / 1074.9 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 999.8 / 1004.2 / 1074.1 / 1074.9 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 71 | 74.6 | 79 |
| ranking.updated | 64 | 64.0 | 65 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 31440 | 60 | 60 | 60 |
| ranking.updated | 26006 | 67445 | 120896 | 130545 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 49.80 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.03 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 109 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | ranking | 36 | 0 | 0.00 / 0.00 / 0.00 | 1.23 / 109.12 / 118.16 | 4.84 / 93.98 / 287.31 | 8.19 / 82.11 / 83.64 |
| sse-ramp | heartbeat | 8 | 355 | 1.01 / 1.44 / 1.44 | — / — / — | — / — / — | — / — / — |
| sse-ramp | ranking | 1 | 6 | 0.25 / 0.25 / 0.25 | 1.46 / 1.46 / 1.46 | 2.65 / 2.65 / 2.65 | 9.28 / 9.28 / 9.28 |
| load | heartbeat | 70 | 400 | 1.92 / 2.62 / 2.88 | — / — / — | — / — / — | — / — / — |
| load | ranking | 62 | 400 | 1.84 / 65.65 / 68.46 | 1.12 / 12.47 / 14.08 | 10.92 / 89.88 / 91.86 | 13.68 / 84.16 / 88.60 |
| settle | heartbeat | 1 | 400 | 1.41 / 1.41 / 1.41 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 1.54 / 1.54 / 1.54 | 7.28 / 7.28 / 7.28 | 3.96 / 3.96 / 3.96 | 8.28 / 8.28 / 8.28 |
| storm | heartbeat | 4 | 400 | 0.13 / 1.90 / 1.90 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.0 / 2.5 / 3.7 | 9.7 / 12.3 / 16.6 / 20.2 | 10.8 / 13.5 / 17.9 / 24.0 | 2 |
| load | 1 | 0.9 / 0.9 / 0.9 / 0.9 | 10.1 / 10.1 / 10.1 / 10.1 | 11.3 / 11.3 / 11.3 / 11.3 | 1 |
| storm | 400 | 103.8 / 132.7 / 134.1 / 134.5 | 2490.4 / 2649.0 / 2662.8 / 2666.6 | 2624.3 / 2744.8 / 2755.7 / 2759.9 | 400 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 1183 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 267.2 / 455.2 / 467.1 / 469.6 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 401.6 / 551.2 / 560.0 / 561.4 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 3119.2 / 3774.2 / 3833.1 / 3846.1 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 3649 ms) |

