# Load report: burst `muxe0u3f`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3442 |
| started | 2026-10-07T00:46:57.631Z |
| ended | 2026-10-07T00:50:05.287Z |
| node | v24.21.0 |
| commit | 685bfa8 |
| harness loadavg (1/5/15 min) at start | 1.67 / 2.27 / 2.93 |
| harness loadavg (1/5/15 min) at end | 2.04 / 2.35 / 2.83 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/442/R8b/raw |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muxe0u3f (d322d569-2a1b-4415-b3b5-a2ae1702b414) |
| problem | ca78bcdb-fc34-45b2-ae0c-bbea3f13d186 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 1.6 | 279.4 | 66.2 | 1.1 | 1.1 | 0.007 | 0 | 0 | 30 |
| setup | 74.1 | 128.4 | 152.6 | 477.6 | 99.5 | 86.8 | 86.8 | 0.078 | 0 | 0 | 68 |
| sse-ramp | 8.0 | 34.0 | 42.2 | 305.7 | 119.2 | 16.4 | 16.4 | 0.275 | 0 | 386 | 8 |
| load | 71.4 | 193.1 | 205.3 | 570.8 | 173.6 | 91.2 | 91.2 | 0.137 | 96 | 400 | 70 |
| settle | 1.1 | 48.8 | 48.8 | 446.0 | 107.2 | 8.0 | 8.0 | 0.058 | 0 | 400 | 1 |
| storm | 2.9 | 106.2 | 140.5 | 535.7 | 107.9 | 37.8 | 37.8 | 0.938 | 0 | 400 | 2 |
| teardown | 0.1 | 58.8 | 58.8 | 555.3 | 194.5 | 7.0 | 7.0 | 0.457 | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.8 | 9.0 | 0.004 | 0.025 | 11.5 | 12.4 | 1007 | 30 | — |
| setup | 2.5 | 11.7 | 0.018 | 0.103 | 14.2 | 15.2 | 1397 | 74 | — |
| sse-ramp | 16.6 | 22.4 | 0.120 | 0.137 | 11.5 | 11.6 | 1005 | 8 | — |
| load | 10.7 | 21.2 | 0.059 | 0.098 | 24.0 | 37.6 | 1139 | 71 | — |
| settle | 2.6 | 2.6 | 0.022 | 0.022 | 10.6 | 12.8 | 1003 | 1 | — |
| storm | 53.5 | 112.4 | 0.434 | 0.980 | 175.0 | 175.0 | 1281 | 3 | — |
| teardown | 65.1 | 65.1 | 0.585 | 0.585 | 76.5 | 76.5 | 1016 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 5.7 | 15.6 | 15.6 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.3 | 5.2 | 8.1 | 8.1 | 0 |
| `POST /auth/login` | 1 | 200×1 | 82.9 | 82.9 | 82.9 | 82.9 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.9 | 3.9 | 3.9 | 3.9 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.2 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.2 | 5.2 | 5.2 | 5.2 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 14.9 | 14.9 | 14.9 | 14.9 | 0 |
| `GET /organizer/stats/live` | 68 | 200×68 | 86.2 | 304.0 | 396.5 | 396.5 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 84.4 | 302.2 | 396.2 | 396.2 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 16.1 | 19.0 | 19.0 | 19.0 | 0 |
| `POST /auth/login` | 300 | 200×300 | 423.5 | 572.0 | 609.1 | 676.1 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 499.6 | 605.3 | 932.4 | 1350.7 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 5.5 | 8.0 | 8.0 | 8.0 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 9.6 | 15.5 | 15.5 | 15.5 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 13.3 | 13.3 | 13.3 | 13.3 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 13.6 | 13.6 | 13.6 | 13.6 | 0 |
| `POST /teams` | 100 | 201×100 | 22.3 | 55.3 | 190.0 | 258.6 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 24.3 | 57.8 | 186.4 | 257.7 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.1 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.0 | 3.7 | 3.7 | 3.7 | 0 |
| `GET /sse` | 400 | 200×400 | 2.4 | 3.6 | 8.4 | 25.0 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 70 | 200×70 | 3.7 | 79.1 | 137.3 | 137.3 | 0 |
| `GET /organizer/stats/process` | 70 | 200×70 | 3.7 | 75.6 | 86.6 | 86.6 | 0 |
| `POST /submissions` | 300 | 201×300 | 15701.9 | 21093.4 | 27667.4 | 29978.5 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 2.2 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /ranking` | 5 | 200×5 | 6.0 | 6.5 | 6.5 | 6.5 | 0 |
| `GET /rounds/:id/ranking` | 5 | 200×5 | 8.5 | 10.2 | 10.2 | 10.2 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 259.2 | 273.4 | 273.4 | 273.4 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 251.5 | 276.6 | 276.6 | 276.6 | 0 |
| `GET /ranking` | 3 | 200×3 | 590.1 | 1023.8 | 1023.8 | 1023.8 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 764.9 | 1024.2 | 1024.2 | 1024.2 | 0 |
| `GET /sse` | 400 | 200×400 | 267.2 | 482.6 | 494.0 | 496.6 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 6.3 | 6.3 | 6.3 | 6.3 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 41.2 | 41.2 | 41.2 | 41.2 | 0 |

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
| correct | 270 | 15607.5 | 19761.6 | 21368.4 | 21775.9 |
| memory | 15 | 15933.9 | 20927.4 | 20927.4 | 20927.4 |
| loop | 15 | 25341.3 | 29978.6 | 29978.6 | 29978.6 |

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
| all | queue | 300 | 15113.4 | 18301.3 | 19893.8 | 20504.4 |
| all | spawn | 300 | 309.3 | 418.9 | 496.6 | 604.1 |
| all | exec | 300 | 14.2 | 390.6 | 10084.9 | 10086.1 |
| all | total | 300 | 15507.4 | 20283.2 | 26797.8 | 28702.0 |
| passed | queue | 270 | 15113.4 | 18301.3 | 20101.1 | 20504.4 |
| passed | spawn | 270 | 310.5 | 418.9 | 496.6 | 576.7 |
| passed | exec | 270 | 9.8 | 107.3 | 180.7 | 214.6 |
| passed | total | 270 | 15416.2 | 18695.0 | 20505.7 | 20977.9 |
| runtime_error | queue | 15 | 15209.9 | 19491.3 | 19491.3 | 19491.3 |
| runtime_error | spawn | 15 | 303.5 | 414.1 | 414.1 | 414.1 |
| runtime_error | exec | 15 | 237.2 | 390.6 | 390.6 | 390.6 |
| runtime_error | total | 15 | 15780.8 | 20102.8 | 20102.8 | 20102.8 |
| timeout | queue | 15 | 14906.8 | 18381.6 | 18381.6 | 18381.6 |
| timeout | spawn | 15 | 306.4 | 604.1 | 604.1 | 604.1 |
| timeout | exec | 15 | 10076.8 | 10086.1 | 10086.1 | 10086.1 |
| timeout | total | 15 | 25279.6 | 28702.0 | 28702.0 | 28702.0 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 994.7 | 997.1 |
| 25 | 2897.4 | 2481.7 |
| 50 | 6486.7 | 6084.8 |
| 75 | 14983.0 | 14087.6 |
| 100 | 20504.4 | 19491.1 |

First k whose p95 queue wait passes 5000 ms: 43.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| payloads validated (distinct / reused) | 1651 / 57501 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 1420.9 / 1421.1 / 1421.2 / 1421.3 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 1000.1 / 1072.2 / 1420.5 / 1421.3 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 73 | 76.9 | 81 |
| ranking.updated | 65 | 65 | 65 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 31952 | 60 | 60 | 60 |
| ranking.updated | 26400 | 28022 | 82021 | 91642 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.96 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.02 / 0.03 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 74 | 0 | 0.00 / 0.01 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 369 | 0.76 / 1.39 / 1.39 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 72 | 400 | 1.67 / 2.67 / 3.28 | — / — / — | — / — / — | — / — / — |
| load | ranking | 63 | 400 | 1.88 / 64.01 / 77.44 | 1.92 / 16.23 / 93.17 | 14.27 / 86.32 / 91.42 | 4.33 / 71.43 / 72.69 |
| settle | heartbeat | 1 | 400 | 1.33 / 1.33 / 1.33 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 1.52 / 1.52 / 1.52 | 7.30 / 7.30 / 7.30 | 3.85 / 3.85 / 3.85 | 2.99 / 2.99 / 2.99 |
| storm | heartbeat | 3 | 400 | 1.29 / 1.84 / 1.84 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.9 / 1.2 / 1.6 / 3.6 | 5.5 / 7.7 / 9.8 / 12.1 | 6.6 / 9.2 / 11.5 / 13.1 | 2 |
| load | 1 | 0.9 / 0.9 / 0.9 / 0.9 | 5.4 / 5.4 / 5.4 / 5.4 | 6.4 / 6.4 / 6.4 / 6.4 | 1 |
| storm | 400 | 101.8 / 158.5 / 159.9 / 160.2 | 1525.4 / 1649.9 / 1668.0 / 1670.4 | 1683.0 / 1745.9 / 1759.4 / 1761.2 | 400 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 1068 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 267.2 / 482.6 / 494.0 / 496.6 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 426.7 / 577.7 / 584.8 / 586.4 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 1994.4 / 2491.9 / 2532.5 / 2541.2 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2315 ms) |

