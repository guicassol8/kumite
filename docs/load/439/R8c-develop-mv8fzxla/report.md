# Load report: burst `mv8fzxla`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3440 |
| started | 2026-10-14T18:27:42.674Z |
| ended | 2026-10-14T18:30:46.976Z |
| node | v24.21.0 |
| commit | a5050fc |
| harness loadavg (1/5/15 min) at start | 0.85 / 2.06 / 2.12 |
| harness loadavg (1/5/15 min) at end | 2.26 / 2.49 / 2.30 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3cbb33f2-aa81-414a-834c-d64a0a6449ee/scratchpad/t439-a798/runs/R8c/results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-mv8fzxla (37539c29-ba93-4d4d-bf29-11a3018d8f04) |
| problem | a928be47-eed6-4f16-a44c-959cad6f7716 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.1 | 1.7 | 278.5 | 66.6 | 6.1 | 6.1 | 0.008 | 0 | 0 | 30 |
| setup | 72.7 | 134.4 | 147.9 | 480.9 | 99.5 | 85.2 | 85.2 | 0.081 | 0 | 0 | 67 |
| sse-ramp | 8.0 | 33.0 | 46.8 | 329.4 | 132.1 | 7.7 | 7.7 | 0.268 | 0 | 384 | 8 |
| load | 70.3 | 193.0 | 205.8 | 575.5 | 164.7 | 92.9 | 92.9 | 0.137 | 96 | 400 | 69 |
| settle | 0.3 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 2.9 | 97.9 | 141.7 | 628.6 | 213.5 | 13.3 | 13.3 | 0.764 | 0 | 400 | 3 |
| teardown | 0.1 | 84.1 | 84.1 | 628.7 | 191.6 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.8 | 9.2 | 0.004 | 0.024 | 11.2 | 12.1 | 1006 | 30 | — |
| setup | 2.5 | 11.1 | 0.019 | 0.058 | 18.0 | 20.2 | 1381 | 72 | — |
| sse-ramp | 16.4 | 25.5 | 0.121 | 0.172 | 11.5 | 14.5 | 1025 | 8 | — |
| load | 9.6 | 22.1 | 0.056 | 0.145 | 21.1 | 43.3 | 1155 | 71 | — |
| settle | — | — | — | — | — | — | — | 0 | — |
| storm | 61.5 | 92.4 | 0.522 | 0.904 | 224.1 | 224.1 | 1520 | 3 | — |
| teardown | 51.7 | 51.7 | 0.389 | 0.389 | 76.2 | 76.2 | 122 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up; a slow answer from the back widens it too, so it points at the harness only next to a high ELU or lag). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.6 | 5.3 | 15.1 | 15.1 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.4 | 5.0 | 8.0 | 8.0 | 0 |
| `POST /auth/login` | 1 | 200×1 | 81.1 | 81.1 | 81.1 | 81.1 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.5 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 6.2 | 6.2 | 6.2 | 6.2 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.2 | 5.2 | 5.2 | 5.2 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.4 | 3.4 | 3.4 | 3.4 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 17.3 | 17.3 | 17.3 | 17.3 | 0 |
| `GET /organizer/stats/live` | 67 | 200×67 | 85.9 | 281.5 | 380.7 | 380.7 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 84.8 | 281.2 | 378.5 | 378.5 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 13.3 | 15.3 | 15.3 | 15.3 | 0 |
| `POST /auth/login` | 300 | 200×300 | 491.7 | 582.7 | 599.2 | 602.6 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 493.7 | 588.6 | 597.3 | 604.7 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.9 | 8.4 | 8.4 | 8.4 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 7.1 | 8.1 | 8.1 | 8.1 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 10.9 | 10.9 | 10.9 | 10.9 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.1 | 8.1 | 8.1 | 8.1 | 0 |
| `POST /teams` | 100 | 201×100 | 8.1 | 14.1 | 39.5 | 41.2 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.7 | 17.8 | 33.0 | 42.4 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.2 | 24.3 | 24.3 | 24.3 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.1 | 24.2 | 24.2 | 24.2 | 0 |
| `GET /sse` | 400 | 200×400 | 2.4 | 3.0 | 11.1 | 40.4 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 69 | 200×69 | 3.1 | 69.8 | 153.3 | 153.3 | 0 |
| `GET /organizer/stats/process` | 69 | 200×69 | 3.2 | 70.1 | 153.2 | 153.2 | 0 |
| `POST /submissions` | 300 | 201×300 | 15604.2 | 19647.7 | 25775.5 | 28950.5 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.1 | 2.1 | 2.1 | 2.1 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `GET /ranking` | 2 | 200×2 | 6.5 | 7.6 | 7.6 | 7.6 | 0 |
| `GET /rounds/:id/ranking` | 2 | 200×2 | 6.9 | 9.3 | 9.3 | 9.3 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 177.3 | 506.2 | 506.2 | 506.2 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 177.1 | 507.4 | 507.4 | 507.4 | 0 |
| `GET /ranking` | 3 | 200×3 | 569.4 | 1055.8 | 1055.8 | 1055.8 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 749.6 | 1056.4 | 1056.4 | 1056.4 | 0 |
| `GET /sse` | 400 | 200×400 | 267.1 | 445.2 | 459.3 | 461.8 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 5.6 | 5.6 | 5.6 | 5.6 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 5.9 | 5.9 | 5.9 | 5.9 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 40.2 | 40.2 | 40.2 | 40.2 | 0 |

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
| correct | 270 | 15578.3 | 18030.6 | 19647.8 | 20413.4 |
| memory | 15 | 15806.9 | 20219.0 | 20219.0 | 20219.0 |
| loop | 15 | 25284.6 | 28950.7 | 28950.7 | 28950.7 |

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
| all | queue | 300 | 15122.6 | 17397.9 | 18497.2 | 19186.7 |
| all | spawn | 300 | 304.9 | 402.1 | 485.1 | 576.9 |
| all | exec | 300 | 11.1 | 306.4 | 10013.8 | 10087.2 |
| all | total | 300 | 15520.7 | 18812.5 | 25708.4 | 28123.9 |
| passed | queue | 270 | 15189.7 | 17381.6 | 18497.2 | 19186.7 |
| passed | spawn | 270 | 304.9 | 403.5 | 485.1 | 496.9 |
| passed | exec | 270 | 9.6 | 102.1 | 187.9 | 217.6 |
| passed | total | 270 | 15497.6 | 17726.6 | 18812.5 | 19490.5 |
| runtime_error | queue | 15 | 15082.3 | 18806.9 | 18806.9 | 18806.9 |
| runtime_error | spawn | 15 | 300.7 | 401.0 | 401.0 | 401.0 |
| runtime_error | exec | 15 | 217.3 | 306.4 | 306.4 | 306.4 |
| runtime_error | total | 15 | 15602.3 | 19388.3 | 19388.3 | 19388.3 |
| timeout | queue | 15 | 14898.7 | 17719.9 | 17719.9 | 17719.9 |
| timeout | spawn | 15 | 373.5 | 576.9 | 576.9 | 576.9 |
| timeout | exec | 15 | 10009.7 | 10087.2 | 10087.2 | 10087.2 |
| timeout | total | 15 | 25209.5 | 28123.9 | 28123.9 | 28123.9 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1020.3 | 1022.4 |
| 25 | 2975.7 | 2609.2 |
| 50 | 6698.3 | 6321.7 |
| 75 | 14922.2 | 14523.6 |
| 100 | 19186.7 | 18116.3 |

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
| payloads validated (distinct / reused) | 1652 / 56684 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 1497.7 / 1497.8 / 1497.9 / 1497.9 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 1000.3 / 1068.8 / 1497.7 / 1497.9 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 71 | 74.8 | 79 |
| ranking.updated | 65 | 65 | 65 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 31136 | 60 | 60 | 60 |
| ranking.updated | 26400 | 28022 | 82026 | 91646 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.96 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 72 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 367 | 0.74 / 1.52 / 1.52 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 70 | 400 | 1.57 / 2.80 / 72.94 | — / — / — | — / — / — | — / — / — |
| load | ranking | 63 | 400 | 1.72 / 2.76 / 64.71 | 1.38 / 13.87 / 83.10 | 15.45 / 87.13 / 93.09 | 4.17 / 69.28 / 71.80 |
| settle | heartbeat | 1 | 400 | 1.36 / 1.36 / 1.36 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 1.39 / 1.39 / 1.39 | 7.40 / 7.40 / 7.40 | 4.00 / 4.00 / 4.00 | 3.35 / 3.35 / 3.35 |
| storm | heartbeat | 3 | 400 | 0.93 / 1.25 / 1.25 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — the frame encoded once, in the first subscriber (#439), plus N writes of it queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.0 / 1.2 / 1.6 | 5.2 / 7.9 / 10.0 / 14.1 | 6.2 / 9.1 / 11.1 / 15.1 | 3 |
| load | 1 | 0.9 / 0.9 / 0.9 / 0.9 | 5.6 / 5.6 / 5.6 / 5.6 | 6.7 / 6.7 / 6.7 / 6.7 | 1 |
| storm | 400 | 103.7 / 122.5 / 127.5 / 128.1 | 1511.3 / 1657.7 / 1668.1 / 1672.5 | 1635.3 / 1749.0 / 1755.3 / 1758.2 | 400 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 279 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 267.1 / 445.2 / 459.3 / 461.8 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 386.4 / 536.3 / 544.5 / 546.7 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 1969.9 / 2471.9 / 2512.5 / 2525.0 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2328 ms) |

