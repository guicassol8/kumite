# Load report: burst `muxcuefh`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3442 |
| started | 2026-10-07T00:13:57.777Z |
| ended | 2026-10-07T00:18:01.765Z |
| node | v24.21.0 |
| commit | 3c8f3d0 |
| harness loadavg (1/5/15 min) at start | 1.61 / 3.03 / 1.96 |
| harness loadavg (1/5/15 min) at end | 3.32 / 3.15 / 2.22 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/442/R0p/raw |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muxcuefh (c24f3244-c716-4796-8add-ed5589a23755) |
| problem | baecbd55-27e0-4bcb-a1cd-c85b2a6f02ca |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.1 | 2.1 | 279.2 | 66.1 | 3.0 | 3.0 | 0.008 | 0 | 0 | 30 |
| setup | 90.7 | 127.8 | 154.3 | 481.9 | 100.2 | 89.0 | 89.0 | 0.066 | 0 | 0 | 75 |
| sse-ramp | 8.0 | 45.3 | 69.8 | 314.0 | 110.6 | 21.2 | 21.2 | 0.413 | 0 | 378 | 8 |
| load | 110.7 | 190.2 | 206.9 | 553.6 | 161.2 | 192.6 | 291.3 | 0.180 | 95 | 400 | 11 |
| settle | 0.7 | 111.1 | 111.1 | 334.1 | 74.0 | — | — | — | 0 | 400 | 1 |
| storm | 3.6 | 110.7 | 141.4 | 531.9 | 219.6 | 30.7 | 30.7 | 0.740 | 0 | 400 | 3 |
| teardown | 0.1 | 36.0 | 36.0 | 531.9 | 198.4 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.7 | 6.4 | 15.9 | 15.9 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.6 | 6.0 | 9.2 | 9.2 | 0 |
| `POST /auth/login` | 1 | 200×1 | 88.9 | 88.9 | 88.9 | 88.9 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.2 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.6 | 4.6 | 4.6 | 4.6 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 7.6 | 7.6 | 7.6 | 7.6 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 4.7 | 4.7 | 4.7 | 4.7 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.9 | 15.9 | 15.9 | 15.9 | 0 |
| `GET /organizer/stats/live` | 75 | 200×75 | 85.2 | 276.2 | 9644.3 | 9644.3 | 0 |
| `GET /organizer/stats/process` | 75 | 200×75 | 84.6 | 209.5 | 384.6 | 384.6 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.7 | 15.0 | 15.0 | 15.0 | 0 |
| `POST /auth/login` | 300 | 200×300 | 491.5 | 600.5 | 677.1 | 797.9 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 506.2 | 688.9 | 10094.6 | 11173.9 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.4 | 4.7 | 4.7 | 4.7 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.7 | 7.5 | 7.5 | 7.5 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 10.2 | 10.2 | 10.2 | 10.2 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 10.3 | 10.3 | 10.3 | 10.3 | 0 |
| `POST /teams` | 100 | 201×100 | 8.8 | 15.6 | 20.2 | 20.2 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 12.0 | 16.6 | 21.0 | 24.3 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 4.0 | 6.1 | 6.1 | 6.1 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 4.3 | 6.0 | 6.0 | 6.0 | 0 |
| `GET /sse` | 400 | 200×400 | 3.1 | 5.3 | 18.4 | 24.1 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 11 | 200×11 | 535.6 | 31489.9 | 31489.9 | 31489.9 | 0 |
| `GET /organizer/stats/process` | 11 | 200×11 | 537.1 | 31490.4 | 31490.4 | 31490.4 | 0 |
| `POST /submissions` | 300 | 201×300 | 28382.4 | 49448.4 | 50691.3 | 58351.2 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 14.6 | 48.9 | 48.9 | 48.9 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 44.3 | 48.7 | 48.7 | 48.7 | 0 |
| `GET /ranking` | 3 | 200×3 | 36.8 | 52.4 | 52.4 | 52.4 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 37.4 | 52.9 | 52.9 | 52.9 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 107.9 | 327.0 | 327.0 | 327.0 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 107.4 | 327.6 | 327.6 | 327.6 | 0 |
| `GET /ranking` | 3 | 200×3 | 760.9 | 1255.1 | 1255.1 | 1255.1 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 988.1 | 1255.7 | 1255.7 | 1255.7 | 0 |
| `GET /sse` | 400 | 200×400 | 426.7 | 710.9 | 733.0 | 738.8 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.7 | 6.7 | 6.7 | 6.7 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 7.0 | 7.0 | 7.0 | 7.0 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 40.7 | 40.7 | 40.7 | 40.7 | 0 |

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
| correct | 270 | 28381.3 | 49447.9 | 50691.1 | 52202.2 |
| memory | 15 | 23867.0 | 49449.8 | 49449.8 | 49449.8 |
| loop | 15 | 36681.4 | 58351.3 | 58351.3 | 58351.3 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×270, runtime_error×15, timeout×15 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.89 / 0.99 / 1.00 |
| workers spawned / exited / alive at the end | 300 / 300 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 6596.7 | 22302.9 | 24723.8 | 25399.2 |
| all | spawn | 300 | 497.9 | 705.4 | 872.6 | 895.4 |
| all | exec | 300 | 80.6 | 518.2 | 10090.1 | 10112.1 |
| all | total | 300 | 7691.2 | 23098.2 | 30817.2 | 34192.8 |
| passed | queue | 270 | 6596.7 | 22302.6 | 24723.8 | 25199.7 |
| passed | spawn | 270 | 497.9 | 714.7 | 872.6 | 895.4 |
| passed | exec | 270 | 76.6 | 186.9 | 212.9 | 220.3 |
| passed | total | 270 | 7001.8 | 22988.0 | 25201.4 | 25715.9 |
| runtime_error | queue | 15 | 7206.6 | 25399.2 | 25399.2 | 25399.2 |
| runtime_error | spawn | 15 | 482.8 | 597.7 | 597.7 | 597.7 |
| runtime_error | exec | 15 | 308.3 | 518.2 | 518.2 | 518.2 |
| runtime_error | total | 15 | 7896.5 | 26196.9 | 26196.9 | 26196.9 |
| timeout | queue | 15 | 5780.5 | 23589.1 | 23589.1 | 23589.1 |
| timeout | spawn | 15 | 582.8 | 893.7 | 893.7 | 893.7 |
| timeout | exec | 15 | 10012.1 | 10112.1 | 10112.1 | 10112.1 |
| timeout | total | 15 | 16390.0 | 34192.8 | 34192.8 | 34192.8 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1411.0 | 1412.3 |
| 25 | 4399.7 | 3903.8 |
| 50 | 10522.3 | 9716.2 |
| 75 | 19202.0 | 18403.7 |
| 100 | 25399.2 | 24119.5 |

First k whose p95 queue wait passes 5000 ms: 30.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 20404.7 / 21883.4 / 30008.9 / 30043.3 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 3.3 / 6109.1 / 15871.1 / 30043.3 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 111 | 115.1 | 119 |
| ranking.updated | 79 | 79 | 79 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 47364 | 60 | 60 | 60 |
| ranking.updated | 32000 | 28022 | 80661 | 91862 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 35.04 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.03 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 91 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 379 | 1.29 / 2.02 / 2.02 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 111 | 400 | 2.44 / 6.09 / 87.04 | — / — / — | — / — / — | — / — / — |
| load | ranking | 78 | 400 | 2.94 / 78.40 / 84.79 | 3.65 / 90.01 / 186.95 | 17.63 / 106.09 / 188.62 | 5.91 / 80.32 / 102.88 |
| storm | heartbeat | 4 | 400 | 0.15 / 1.75 / 1.75 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 1.0 / 1.5 / 3.0 / 5.5 | 6.8 / 10.0 / 12.5 / 14.3 | 8.1 / 11.6 / 15.1 / 16.0 | 2 |
| load | 1 | 1.2 / 1.2 / 1.2 / 1.2 | 7.0 / 7.0 / 7.0 / 7.0 | 8.4 / 8.4 / 8.4 / 8.4 | 1 |
| storm | 400 | 146.2 / 179.8 / 184.3 / 185.0 | 1866.0 / 1974.5 / 1985.4 / 1989.6 | 2039.8 / 2100.4 / 2106.4 / 2109.3 | 400 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 49 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 627 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 426.7 / 710.9 / 733.0 / 738.8 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 605.7 / 840.8 / 851.6 / 854.3 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2555.3 / 3178.7 / 3228.2 / 3240.3 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2772 ms) |

