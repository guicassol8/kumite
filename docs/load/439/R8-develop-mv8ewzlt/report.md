# Load report: burst `mv8ewzlt`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3440 |
| started | 2026-10-14T17:57:25.701Z |
| ended | 2026-10-14T18:00:28.898Z |
| node | v24.21.0 |
| commit | a5050fc |
| harness loadavg (1/5/15 min) at start | 0.95 / 1.99 / 1.95 |
| harness loadavg (1/5/15 min) at end | 1.85 / 2.13 / 2.03 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3cbb33f2-aa81-414a-834c-d64a0a6449ee/scratchpad/t439-a798/runs/R8/results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-mv8ewzlt (a5c390e3-10cb-4bf7-8c84-e25b481795c1) |
| problem | caae604d-0332-4b0c-84a4-54840891e75e |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.6 | 300.2 | 67.1 | 1.3 | 1.3 | 0.006 | 0 | 0 | 30 |
| setup | 71.6 | 132.9 | 146.7 | 504.4 | 100.7 | 87.2 | 87.2 | 0.080 | 0 | 0 | 66 |
| sse-ramp | 8.0 | 37.8 | 83.5 | 321.6 | 114.0 | 25.5 | 25.5 | 0.270 | 0 | 369 | 8 |
| load | 69.5 | 193.1 | 206.4 | 578.2 | 142.9 | 90.0 | 90.0 | 0.134 | 96 | 400 | 68 |
| settle | 1.1 | 82.3 | 82.3 | 452.0 | 98.6 | 0.7 | 0.7 | 0.044 | 0 | 400 | 1 |
| storm | 2.9 | 77.4 | 132.4 | 621.3 | 131.7 | 7.9 | 7.9 | 0.928 | 0 | 400 | 2 |
| teardown | 0.1 | 15.4 | 15.4 | 621.4 | 144.7 | 10.3 | 10.3 | 0.454 | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.7 | 9.2 | 0.003 | 0.025 | 11.2 | 12.5 | 1006 | 30 | — |
| setup | 2.5 | 9.7 | 0.018 | 0.044 | 13.3 | 15.6 | 1312 | 71 | — |
| sse-ramp | 17.2 | 26.3 | 0.121 | 0.177 | 11.3 | 11.6 | 1023 | 8 | — |
| load | 10.1 | 22.2 | 0.056 | 0.128 | 23.5 | 47.4 | 1448 | 70 | — |
| settle | 3.7 | 3.7 | 0.033 | 0.033 | 10.9 | 11.8 | 1003 | 1 | — |
| storm | 60.2 | 82.2 | 0.507 | 0.802 | 236.1 | 236.1 | 2198 | 3 | — |
| teardown | 77.8 | 77.8 | 0.600 | 0.600 | 71.1 | 71.1 | 345 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up; a slow answer from the back widens it too, so it points at the harness only next to a high ELU or lag). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 5.1 | 14.6 | 14.6 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.3 | 5.0 | 8.0 | 8.0 | 0 |
| `POST /auth/login` | 1 | 200×1 | 82.3 | 82.3 | 82.3 | 82.3 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.6 | 3.6 | 3.6 | 3.6 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.1 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 14.9 | 14.9 | 14.9 | 14.9 | 0 |
| `GET /organizer/stats/live` | 66 | 200×66 | 84.4 | 219.6 | 310.7 | 310.7 | 0 |
| `GET /organizer/stats/process` | 66 | 200×66 | 84.4 | 220.3 | 311.5 | 311.5 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.4 | 11.4 | 11.4 | 11.4 | 0 |
| `POST /auth/login` | 300 | 200×300 | 480.7 | 512.8 | 580.4 | 589.3 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 498.1 | 588.6 | 600.0 | 686.8 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.6 | 5.3 | 5.3 | 5.3 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.1 | 7.1 | 7.1 | 7.1 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 10.0 | 10.0 | 10.0 | 10.0 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 7.8 | 7.8 | 7.8 | 7.8 | 0 |
| `POST /teams` | 100 | 201×100 | 7.7 | 10.1 | 13.3 | 13.6 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.5 | 14.5 | 19.4 | 21.3 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.7 | 21.9 | 21.9 | 21.9 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.5 | 21.7 | 21.7 | 21.7 | 0 |
| `GET /sse` | 400 | 200×400 | 2.3 | 3.0 | 9.7 | 38.2 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 68 | 200×68 | 3.5 | 70.3 | 446.7 | 446.7 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 3.4 | 71.0 | 447.3 | 447.3 | 0 |
| `POST /submissions` | 300 | 201×300 | 15229.9 | 19621.2 | 26099.3 | 29622.4 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 2.9 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 2.6 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /ranking` | 5 | 200×5 | 6.1 | 6.4 | 6.4 | 6.4 | 0 |
| `GET /rounds/:id/ranking` | 5 | 200×5 | 8.1 | 8.5 | 8.5 | 8.5 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 167.5 | 1196.1 | 1196.1 | 1196.1 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 77.3 | 167.2 | 167.2 | 167.2 | 0 |
| `GET /ranking` | 3 | 200×3 | 608.4 | 882.4 | 882.4 | 882.4 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 823.6 | 882.8 | 882.8 | 882.8 | 0 |
| `GET /sse` | 400 | 200×400 | 287.7 | 482.3 | 494.8 | 497.7 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.0 | 6.0 | 6.0 | 6.0 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 37.8 | 37.8 | 37.8 | 37.8 | 0 |

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
| correct | 270 | 15197.5 | 18124.7 | 19621.3 | 20135.3 |
| memory | 15 | 15507.2 | 19824.2 | 19824.2 | 19824.2 |
| loop | 15 | 24923.0 | 29622.5 | 29622.5 | 29622.5 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.98 / 0.99 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 14796.7 | 17491.1 | 18474.8 | 18997.3 |
| all | spawn | 300 | 300.7 | 398.8 | 475.9 | 487.7 |
| all | exec | 300 | 11.7 | 416.3 | 10081.9 | 10089.9 |
| all | total | 300 | 15189.8 | 18873.0 | 26084.8 | 28876.1 |
| passed | queue | 270 | 14804.3 | 17491.1 | 18474.8 | 18997.3 |
| passed | spawn | 270 | 300.3 | 404.6 | 481.5 | 487.7 |
| passed | exec | 270 | 9.6 | 96.8 | 116.4 | 192.1 |
| passed | total | 270 | 15107.1 | 17799.3 | 18873.0 | 19309.9 |
| runtime_error | queue | 15 | 14900.9 | 18473.1 | 18473.1 | 18473.1 |
| runtime_error | spawn | 15 | 301.8 | 394.8 | 394.8 | 394.8 |
| runtime_error | exec | 15 | 228.6 | 416.3 | 416.3 | 416.3 |
| runtime_error | total | 15 | 15422.3 | 19078.7 | 19078.7 | 19078.7 |
| timeout | queue | 15 | 14584.8 | 18475.4 | 18475.4 | 18475.4 |
| timeout | spawn | 15 | 306.9 | 400.8 | 400.8 | 400.8 |
| timeout | exec | 15 | 10010.7 | 10089.9 | 10089.9 | 10089.9 |
| timeout | total | 15 | 24908.8 | 28876.1 | 28876.1 | 28876.1 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 957.2 | 957.9 |
| 25 | 2871.7 | 2793.2 |
| 50 | 6303.3 | 5924.5 |
| 75 | 15321.1 | 14804.3 |
| 100 | 18997.3 | 18088.5 |

First k whose p95 queue wait passes 5000 ms: 46.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| payloads validated (distinct / reused) | 1649 / 55519 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 1388.4 / 1389.1 / 1389.1 / 1389.2 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 1000.0 / 1004.6 / 1388.4 / 1389.2 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 71 | 74.9 | 79 |
| ranking.updated | 63 | 63 | 63 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 30768 | 60 | 60 | 60 |
| ranking.updated | 25600 | 28022 | 82341 | 91643 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.96 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 71 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 371 | 0.82 / 1.39 / 1.39 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 70 | 400 | 1.48 / 2.49 / 2.71 | — / — / — | — / — / — | — / — / — |
| load | ranking | 61 | 400 | 1.62 / 2.75 / 65.03 | 1.10 / 12.00 / 86.28 | 11.18 / 86.82 / 87.67 | 4.23 / 73.42 / 77.32 |
| settle | heartbeat | 1 | 400 | 1.41 / 1.41 / 1.41 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 1.29 / 1.29 / 1.29 | 0.87 / 0.87 / 0.87 | 9.75 / 9.75 / 9.75 | 2.96 / 2.96 / 2.96 |
| storm | heartbeat | 2 | 400 | 0.11 / 1.12 / 1.12 | — / — / — | — / — / — | — / — / — |
| teardown | heartbeat | 1 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — the frame encoded once, in the first subscriber (#439), plus N writes of it queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.0 / 1.6 / 3.5 | 5.3 / 6.5 / 8.5 / 10.1 | 6.2 / 7.9 / 10.3 / 11.0 | 3 |
| load | 1 | 1.1 / 1.1 / 1.1 / 1.1 | 5.1 / 5.1 / 5.1 / 5.1 | 6.4 / 6.4 / 6.4 / 6.4 | 1 |
| storm | 400 | 103.5 / 127.5 / 130.2 / 132.3 | 1441.7 / 1599.3 / 1614.4 / 1618.8 | 1567.8 / 1690.9 / 1698.9 / 1704.8 | 400 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 1064 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 287.7 / 482.3 / 494.8 / 497.7 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 416.3 / 573.0 / 580.7 / 582.2 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 1943.5 / 2439.0 / 2478.2 / 2490.1 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2257 ms) |

