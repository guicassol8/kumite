# Load report: burst `muxcgjyv`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3442 |
| started | 2026-10-07T00:03:11.772Z |
| ended | 2026-10-07T00:07:33.258Z |
| node | v24.21.0 |
| commit | 3c8f3d0 |
| harness loadavg (1/5/15 min) at start | 1.52 / 0.65 / 0.33 |
| harness loadavg (1/5/15 min) at end | 8.14 / 3.78 / 1.59 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/442/R0/raw |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muxcgjyv (db1c7226-dbb0-44b9-a903-4cf30dddac7c) |
| problem | f3f5981b-9480-4420-9392-e776c70356fa |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.3 | 2.2 | 278.9 | 66.2 | 1.0 | 1.0 | 0.010 | 0 | 0 | 30 |
| setup | 95.3 | 105.2 | 154.3 | 489.0 | 99.4 | 86.8 | 86.8 | 0.065 | 0 | 0 | 90 |
| sse-ramp | 8.0 | 31.4 | 37.7 | 306.4 | 113.9 | 11.4 | 11.4 | 0.255 | 0 | 370 | 8 |
| load | 116.2 | 191.2 | 208.3 | 471.4 | 145.1 | 223.4 | 282.4 | 0.147 | 92 | 400 | 19 |
| settle | 8.0 | 9.0 | 17.9 | 409.1 | 108.5 | 10.9 | 10.9 | 0.026 | 0 | 400 | 3 |
| storm | 3.8 | 110.9 | 142.8 | 543.7 | 233.7 | 12.1 | 12.1 | 0.787 | 0 | 400 | 3 |
| teardown | 0.2 | 40.0 | 40.0 | 543.7 | 246.3 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.9 | 7.0 | 20.5 | 20.5 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.7 | 7.0 | 9.6 | 9.6 | 0 |
| `POST /auth/login` | 1 | 200×1 | 97.4 | 97.4 | 97.4 | 97.4 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.9 | 3.9 | 3.9 | 3.9 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.9 | 4.9 | 4.9 | 4.9 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.5 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.4 | 3.4 | 3.4 | 3.4 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 19.6 | 19.6 | 19.6 | 19.6 | 0 |
| `GET /organizer/stats/live` | 90 | 200×90 | 9.0 | 278.5 | 303.9 | 303.9 | 0 |
| `GET /organizer/stats/process` | 90 | 200×90 | 8.7 | 279.6 | 310.6 | 310.6 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 45.8 | 90.9 | 90.9 | 90.9 | 0 |
| `POST /auth/login` | 300 | 200×300 | 489.0 | 590.5 | 668.4 | 691.1 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 503.5 | 824.0 | 6276.4 | 9255.9 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.4 | 79.9 | 79.9 | 79.9 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 37.4 | 41.5 | 41.5 | 41.5 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 45.3 | 45.3 | 45.3 | 45.3 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.7 | 8.7 | 8.7 | 8.7 | 0 |
| `POST /teams` | 100 | 201×100 | 40.2 | 116.8 | 141.4 | 141.5 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 40.9 | 80.4 | 85.7 | 110.9 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.3 | 3.9 | 3.9 | 3.9 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.4 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /sse` | 400 | 200×400 | 2.4 | 3.3 | 12.6 | 22.5 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 19 | 200×19 | 65.6 | 31233.0 | 31233.0 | 31233.0 | 0 |
| `GET /organizer/stats/process` | 19 | 200×19 | 66.8 | 31232.8 | 31232.8 | 31232.8 | 0 |
| `POST /submissions` | 300 | 201×300 | 23348.6 | 51059.2 | 51061.6 | 66321.5 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 4 | 200×4 | 3.8 | 4527.1 | 4527.1 | 4527.1 | 0 |
| `GET /organizer/stats/process` | 4 | 200×4 | 3.7 | 4526.9 | 4526.9 | 4526.9 | 0 |
| `GET /ranking` | 9 | 200×9 | 7.1 | 3224.4 | 3224.4 | 3224.4 | 0 |
| `GET /rounds/:id/ranking` | 9 | 200×9 | 9.7 | 3224.9 | 3224.9 | 3224.9 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 94.9 | 398.4 | 398.4 | 398.4 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 94.1 | 398.1 | 398.1 | 398.1 | 0 |
| `GET /ranking` | 3 | 200×3 | 792.7 | 1510.9 | 1510.9 | 1510.9 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 1009.5 | 1511.5 | 1511.5 | 1511.5 | 0 |
| `GET /sse` | 400 | 200×400 | 379.3 | 646.1 | 663.3 | 667.8 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 9.0 | 9.0 | 9.0 | 9.0 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 8.7 | 8.7 | 8.7 | 8.7 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 65.6 | 65.6 | 65.6 | 65.6 | 0 |

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
| correct | 270 | 23303.8 | 51059.3 | 51061.5 | 51061.9 |
| memory | 15 | 24593.2 | 51060.0 | 51060.0 | 51060.0 |
| loop | 15 | 39729.3 | 66321.6 | 66321.6 | 66321.6 |

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
| all | queue | 300 | 9001.0 | 16713.7 | 18795.8 | 19285.4 |
| all | spawn | 300 | 393.6 | 753.5 | 889.8 | 975.3 |
| all | exec | 300 | 23.8 | 673.0 | 10127.3 | 10382.3 |
| all | total | 300 | 10403.7 | 18491.7 | 24712.3 | 27802.1 |
| passed | queue | 270 | 9001.0 | 16713.7 | 18795.8 | 19285.4 |
| passed | spawn | 270 | 393.6 | 753.5 | 889.8 | 975.3 |
| passed | exec | 270 | 15.7 | 118.9 | 199.6 | 300.3 |
| passed | total | 270 | 9626.6 | 17088.5 | 19112.5 | 19604.5 |
| runtime_error | queue | 15 | 7299.9 | 19109.7 | 19109.7 | 19109.7 |
| runtime_error | spawn | 15 | 375.2 | 694.3 | 694.3 | 694.3 |
| runtime_error | exec | 15 | 296.7 | 673.0 | 673.0 | 673.0 |
| runtime_error | total | 15 | 8193.7 | 19722.4 | 19722.4 | 19722.4 |
| timeout | queue | 15 | 9895.4 | 17311.8 | 17311.8 | 17311.8 |
| timeout | spawn | 15 | 400.0 | 904.1 | 904.1 | 904.1 |
| timeout | exec | 15 | 10037.0 | 10382.3 | 10382.3 | 10382.3 |
| timeout | total | 15 | 20414.4 | 27802.1 | 27802.1 | 27802.1 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1061.9 | 1063.4 |
| 25 | 3182.7 | 2694.1 |
| 50 | 8304.1 | 7601.6 |
| 75 | 14711.2 | 14012.5 |
| 100 | 19285.4 | 18490.6 |

First k whose p95 queue wait passes 5000 ms: 38.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 25268.1 / 27430.8 / 28551.1 / 28844.4 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 3.4 / 4457.6 / 19152.0 / 28844.4 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 124 | 127.7 | 132 |
| ranking.updated | 76 | 76 | 76 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 52438 | 60 | 60 | 60 |
| ranking.updated | 30800 | 28022 | 82579 | 91769 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 35.01 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.02 / 0.03 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 95 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 362 | 0.89 / 1.41 / 1.41 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 116 | 400 | 2.45 / 7.59 / 77.07 | — / — / — | — / — / — | — / — / — |
| load | ranking | 75 | 400 | 2.76 / 65.45 / 74.73 | 7.04 / 90.53 / 203.09 | 19.65 / 103.63 / 189.48 | 6.72 / 76.19 / 96.08 |
| settle | heartbeat | 8 | 400 | 1.58 / 2.36 / 2.36 | — / — / — | — / — / — | — / — / — |
| storm | heartbeat | 4 | 400 | 0.10 / 1.89 / 1.89 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.1 / 1.2 / 2.2 | 5.6 / 7.0 / 8.9 / 9.6 | 6.6 / 8.2 / 10.1 / 12.9 | 2 |
| load | 1 | 0.7 / 0.7 / 0.7 / 0.7 | 6.4 / 6.4 / 6.4 / 6.4 | 7.3 / 7.3 / 7.3 / 7.3 | 1 |
| storm | 400 | 136.6 / 177.8 / 184.0 / 185.2 | 2087.3 / 2271.5 / 2294.2 / 2295.6 | 2265.7 / 2394.4 / 2409.7 / 2412.5 | 400 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 2602 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 5365 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 379.3 / 646.1 / 663.3 / 667.8 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 559.4 / 766.5 / 778.5 / 783.5 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2727.5 / 3375.4 / 3432.0 / 3445.0 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 3050 ms) |

