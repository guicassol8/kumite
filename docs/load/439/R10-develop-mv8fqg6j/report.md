# Load report: burst `mv8fqg6j`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3440 |
| started | 2026-10-14T18:20:20.208Z |
| ended | 2026-10-14T18:24:02.791Z |
| node | v24.21.0 |
| commit | a5050fc |
| harness loadavg (1/5/15 min) at start | 0.93 / 2.00 / 2.00 |
| harness loadavg (1/5/15 min) at end | 2.50 / 2.53 / 2.22 |
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
| pastRounds | 3 |
| resendStale | false |
| restSeconds | 30 |
| durationSeconds | 600 |
| setupConcurrency | 4 |
| sseRamp | 50 |
| sampleIntervalMs | 1000 |
| requestTimeoutMs | 290000 |
| cooldownMs | 5000 |
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3cbb33f2-aa81-414a-834c-d64a0a6449ee/scratchpad/t439-a798/runs/R10/results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-mv8fqg6j (f6eb379b-df49-4b5b-82be-9ac25a09d536) |
| problem | a1269c20-124f-4a5b-a095-995b87d02fd7 |
| problems in the round | 5 |
| past rounds | load-mv8fqg6j-r0, load-mv8fqg6j-r1, load-mv8fqg6j-r2 |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.8 | 1.5 | 278.4 | 66.6 | 3.5 | 3.5 | 0.006 | 0 | 0 | 30 |
| setup | 110.5 | 156.0 | 209.1 | 482.1 | 137.9 | 86.2 | 87.1 | 0.120 | 84 | 0 | 102 |
| sse-ramp | 8.0 | 62.3 | 160.0 | 477.5 | 138.4 | 67.7 | 67.7 | 0.365 | 0 | 361 | 8 |
| load | 69.2 | 192.6 | 206.2 | 639.6 | 197.9 | 165.0 | 165.0 | 0.141 | 88 | 400 | 68 |
| settle | 0.6 | 98.9 | 98.9 | 543.4 | 195.0 | — | — | — | 0 | 400 | 1 |
| storm | 4.1 | 114.6 | 140.1 | 720.0 | 210.6 | 31.9 | 31.9 | 0.811 | 0 | 400 | 3 |
| teardown | 0.1 | 16.6 | 16.6 | 721.8 | 185.6 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.7 | 9.1 | 0.003 | 0.024 | 10.7 | 12.8 | 1007 | 30 | — |
| setup | 2.3 | 32.0 | 0.016 | 0.210 | 14.2 | 23.8 | 1896 | 110 | — |
| sse-ramp | 21.4 | 28.9 | 0.161 | 0.185 | 13.0 | 14.2 | 1005 | 8 | — |
| load | 12.0 | 26.9 | 0.073 | 0.140 | 39.4 | 70.7 | 1087 | 69 | — |
| settle | 2.3 | 2.3 | 0.019 | 0.019 | 10.4 | 10.7 | 1007 | 1 | — |
| storm | 51.7 | 110.2 | 0.456 | 1 | 545.8 | 545.8 | 2010 | 4 | — |
| teardown | 37.2 | 37.2 | 0.285 | 0.285 | 66.2 | 66.2 | 415 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up; a slow answer from the back widens it too, so it points at the harness only next to a high ELU or lag). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 5.4 | 14.5 | 14.5 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.1 | 5.0 | 7.7 | 7.7 | 0 |
| `POST /auth/login` | 1 | 200×1 | 82.5 | 82.5 | 82.5 | 82.5 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.1 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.8 | 4.8 | 4.8 | 4.8 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 18.8 | 18.8 | 18.8 | 18.8 | 0 |
| `GET /organizer/stats/live` | 102 | 200×102 | 9.9 | 296.1 | 391.5 | 895.8 | 0 |
| `GET /organizer/stats/process` | 102 | 200×102 | 9.6 | 285.1 | 386.0 | 391.5 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.8 | 11.1 | 11.1 | 11.1 | 0 |
| `POST /auth/login` | 300 | 200×300 | 486.4 | 576.3 | 598.2 | 677.5 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 493.7 | 587.5 | 599.7 | 693.4 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.1 | 4.7 | 4.7 | 4.7 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.2 | 7.7 | 7.7 | 7.7 | 0 |
| `POST /organizer/rounds` | 4 | 201×4 | 8.7 | 10.2 | 10.2 | 10.2 | 0 |
| `POST /organizer/rounds/:id/close` | 3 | 200×3 | 7.5 | 7.8 | 7.8 | 7.8 | 0 |
| `POST /organizer/rounds/:id/open` | 4 | 200×4 | 7.4 | 8.0 | 8.0 | 8.0 | 0 |
| `POST /submissions` | 382 | 201×300, 429:submission_throttled×82 | 3970.0 | 11724.2 | 13911.8 | 14035.5 | 0 |
| `POST /teams` | 100 | 201×100 | 7.7 | 11.0 | 14.7 | 15.0 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.4 | 14.5 | 21.1 | 22.7 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.2 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.2 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /sse` | 400 | 200×400 | 2.3 | 3.1 | 7.7 | 18.1 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 68 | 200×68 | 3.3 | 71.1 | 86.0 | 86.0 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 3.4 | 71.1 | 86.4 | 86.4 | 0 |
| `POST /submissions` | 300 | 201×300 | 15423.0 | 19282.1 | 25500.1 | 27461.2 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 2.4 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 2.5 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /ranking` | 3 | 200×3 | 13.1 | 14.0 | 14.0 | 14.0 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 7.4 | 7.9 | 7.9 | 7.9 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 186.9 | 812.5 | 812.5 | 812.5 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 188.1 | 812.2 | 812.2 | 812.2 | 0 |
| `GET /ranking` | 3 | 200×3 | 1484.5 | 1565.6 | 1565.6 | 1565.6 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 802.6 | 1484.4 | 1484.4 | 1484.4 | 0 |
| `GET /sse` | 400 | 200×400 | 254.1 | 430.5 | 444.2 | 446.9 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.2 | 6.2 | 6.2 | 6.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 6.0 | 6.0 | 6.0 | 6.0 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 45.9 | 45.9 | 45.9 | 45.9 | 0 |

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
| correct | 270 | 15318.0 | 16979.0 | 19282.2 | 19967.4 |
| memory | 15 | 15722.8 | 19586.4 | 19586.4 | 19586.4 |
| loop | 15 | 25174.7 | 27461.3 | 27461.3 | 27461.3 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.98 / 0.99 |
| workers spawned / exited / alive at the end | 600 / 600 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 14988.6 | 16495.3 | 18479.4 | 19014.8 |
| all | spawn | 300 | 301.4 | 400.7 | 479.5 | 493.0 |
| all | exec | 300 | 9.8 | 413.4 | 10012.0 | 10102.2 |
| all | total | 300 | 15330.2 | 18788.6 | 25486.8 | 26908.7 |
| passed | queue | 270 | 14989.9 | 16490.9 | 18479.4 | 19014.8 |
| passed | spawn | 270 | 301.4 | 400.7 | 479.5 | 493.0 |
| passed | exec | 270 | 9.0 | 93.9 | 109.8 | 190.7 |
| passed | total | 270 | 15284.5 | 16817.3 | 18788.6 | 19322.8 |
| runtime_error | queue | 15 | 15097.3 | 18491.2 | 18491.2 | 18491.2 |
| runtime_error | spawn | 15 | 299.9 | 387.5 | 387.5 | 387.5 |
| runtime_error | exec | 15 | 288.8 | 413.4 | 413.4 | 413.4 |
| runtime_error | total | 15 | 15698.3 | 19088.5 | 19088.5 | 19088.5 |
| timeout | queue | 15 | 14789.0 | 16600.3 | 16600.3 | 16600.3 |
| timeout | spawn | 15 | 302.3 | 483.4 | 483.4 | 483.4 |
| timeout | exec | 15 | 10009.2 | 10102.2 | 10102.2 | 10102.2 |
| timeout | total | 15 | 25106.3 | 26908.7 | 26908.7 | 26908.7 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1021.6 | 1021.6 |
| 25 | 3003.0 | 2828.6 |
| 50 | 6906.1 | 6521.2 |
| 75 | 13705.4 | 12813.2 |
| 100 | 19014.8 | 18095.4 |

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
| payloads validated (distinct / reused) | 1643 / 56774 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 1086.3 / 1088.8 / 1088.9 / 1089.0 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 1000.2 / 1008.5 / 1085.5 / 1089.0 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 70 | 74.0 | 78 |
| ranking.updated | 65 | 65.1 | 66 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 31192 | 60 | 60 | 60 |
| ranking.updated | 26425 | 67446 | 121121 | 130541 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 49.80 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 110 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| setup | ranking | 38 | 0 | 0.00 / 0.00 / 0.00 | 1.17 / 53.59 / 201.74 | 4.83 / 231.67 / 590.67 | 10.07 / 83.29 / 87.15 |
| sse-ramp | heartbeat | 8 | 374 | 0.92 / 1.72 / 1.72 | — / — / — | — / — / — | — / — / — |
| sse-ramp | ranking | 1 | 25 | 0.39 / 0.39 / 0.39 | 0.78 / 0.78 / 0.78 | 4.01 / 4.01 / 4.01 | 11.28 / 11.28 / 11.28 |
| load | heartbeat | 69 | 400 | 1.86 / 3.52 / 5.70 | — / — / — | — / — / — | — / — / — |
| load | ranking | 63 | 400 | 1.87 / 4.68 / 78.03 | 7.54 / 13.82 / 22.76 | 8.82 / 18.72 / 72.40 | 11.05 / 88.13 / 90.33 |
| settle | heartbeat | 1 | 400 | 1.42 / 1.42 / 1.42 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 1.63 / 1.63 / 1.63 | 7.29 / 7.29 / 7.29 | 3.90 / 3.90 / 3.90 | 10.16 / 10.16 / 10.16 |
| storm | heartbeat | 4 | 400 | 0.12 / 1.26 / 1.26 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — the frame encoded once, in the first subscriber (#439), plus N writes of it queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.0 / 1.4 / 5.3 | 9.6 / 12.0 / 13.5 / 18.7 | 10.8 / 13.2 / 15.7 / 20.2 | 2 |
| load | 1 | 0.8 / 0.8 / 0.8 / 0.8 | 11.2 / 11.2 / 11.2 / 11.2 | 12.4 / 12.4 / 12.4 / 12.4 | 1 |
| storm | 400 | 100.6 / 121.3 / 121.8 / 122.7 | 2397.4 / 2589.3 / 2612.2 / 2614.7 | 2519.6 / 2686.0 / 2703.5 / 2707.2 | 400 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 558 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 254.1 / 430.5 / 444.2 / 446.9 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 375.7 / 526.8 / 536.0 / 537.5 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2999.0 / 3696.5 / 3754.0 / 3769.3 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 3594 ms) |

