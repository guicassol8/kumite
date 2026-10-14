# Load report: burst `muxdra8u`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3442 |
| started | 2026-10-07T00:39:32.003Z |
| ended | 2026-10-07T00:42:46.789Z |
| node | v24.21.0 |
| commit | 3c8f3d0 |
| harness loadavg (1/5/15 min) at start | 1.73 / 3.47 / 3.61 |
| harness loadavg (1/5/15 min) at end | 2.73 / 2.77 / 3.27 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3210b158-b9d5-45cb-a9bc-211e0876da65/scratchpad/runs/442/R0-2/raw |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muxdra8u (4d86c352-dc9b-489c-8604-6adfe82e8ae9) |
| problem | c6b03348-5703-4c3b-a28c-d45b217605f1 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.2 | 2.2 | 279.2 | 66.1 | 1.2 | 1.2 | 0.009 | 0 | 0 | 30 |
| setup | 74.3 | 134.5 | 150.9 | 476.0 | 100.6 | 87.8 | 87.8 | 0.079 | 0 | 0 | 68 |
| sse-ramp | 8.0 | 39.0 | 86.1 | 313.6 | 126.4 | 27.9 | 27.9 | 0.294 | 0 | 367 | 8 |
| load | 77.2 | 192.6 | 204.9 | 492.6 | 177.3 | 99.3 | 99.3 | 0.159 | 96 | 400 | 22 |
| settle | 1.9 | 30.4 | 30.4 | 456.8 | 99.0 | 11.5 | 11.5 | 0.023 | 0 | 400 | 1 |
| storm | 3.2 | 105.5 | 136.4 | 571.9 | 237.8 | 10.0 | 10.0 | 0.775 | 0 | 400 | 3 |
| teardown | 0.1 | 50.5 | 50.5 | 571.9 | 162.9 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 7.2 | 15.4 | 15.4 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.5 | 6.8 | 8.2 | 8.2 | 0 |
| `POST /auth/login` | 1 | 200×1 | 86.4 | 86.4 | 86.4 | 86.4 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.6 | 4.6 | 4.6 | 4.6 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 5.1 | 5.1 | 5.1 | 5.1 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.8 | 4.8 | 4.8 | 4.8 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 19.8 | 19.8 | 19.8 | 19.8 | 0 |
| `GET /organizer/stats/live` | 68 | 200×68 | 84.3 | 280.9 | 309.6 | 309.6 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 84.2 | 268.6 | 310.2 | 310.2 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 10.4 | 11.7 | 11.7 | 11.7 | 0 |
| `POST /auth/login` | 300 | 200×300 | 492.7 | 588.1 | 599.2 | 601.7 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 499.8 | 597.9 | 607.0 | 680.8 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.1 | 4.8 | 4.8 | 4.8 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.2 | 7.9 | 7.9 | 7.9 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 10.4 | 10.4 | 10.4 | 10.4 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.0 | 8.0 | 8.0 | 8.0 | 0 |
| `POST /teams` | 100 | 201×100 | 7.9 | 11.5 | 15.5 | 15.6 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.6 | 14.6 | 21.2 | 24.5 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.3 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.3 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /sse` | 400 | 200×400 | 2.6 | 4.0 | 11.6 | 30.6 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 22 | 200×22 | 27.9 | 9328.2 | 19498.3 | 19498.3 | 0 |
| `GET /organizer/stats/process` | 22 | 200×22 | 29.4 | 9328.8 | 19498.7 | 19498.7 | 0 |
| `POST /submissions` | 300 | 201×300 | 19105.8 | 25172.1 | 34924.7 | 38539.1 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 75.5 | 574.1 | 574.1 | 574.1 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 75.2 | 573.7 | 573.7 | 573.7 | 0 |
| `GET /ranking` | 2 | 200×2 | 6.7 | 1098.9 | 1098.9 | 1098.9 | 0 |
| `GET /rounds/:id/ranking` | 2 | 200×2 | 9.3 | 1099.3 | 1099.3 | 1099.3 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 3 | 200×3 | 82.9 | 209.1 | 209.1 | 209.1 | 0 |
| `GET /organizer/stats/process` | 3 | 200×3 | 82.5 | 209.1 | 209.1 | 209.1 | 0 |
| `GET /ranking` | 3 | 200×3 | 670.9 | 1109.2 | 1109.2 | 1109.2 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 864.6 | 1109.7 | 1109.7 | 1109.7 | 0 |
| `GET /sse` | 400 | 200×400 | 324.0 | 557.8 | 571.0 | 574.0 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.7 | 6.7 | 6.7 | 6.7 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 7.0 | 7.0 | 7.0 | 7.0 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 36.9 | 36.9 | 36.9 | 36.9 | 0 |

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
| correct | 270 | 18501.2 | 24988.0 | 26920.2 | 27028.0 |
| memory | 15 | 20007.5 | 25172.2 | 25172.2 | 25172.2 |
| loop | 15 | 28733.2 | 38539.2 | 38539.2 | 38539.2 |

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
| all | queue | 300 | 7996.0 | 17990.3 | 19408.1 | 20097.4 |
| all | spawn | 300 | 378.6 | 439.2 | 494.2 | 503.1 |
| all | exec | 300 | 14.6 | 383.9 | 10084.5 | 10168.1 |
| all | total | 300 | 8810.5 | 19005.4 | 24997.9 | 28912.1 |
| passed | queue | 270 | 7618.1 | 17990.3 | 19712.2 | 20097.4 |
| passed | spawn | 270 | 379.1 | 481.5 | 498.3 | 503.1 |
| passed | exec | 270 | 11.7 | 105.8 | 120.3 | 185.2 |
| passed | total | 270 | 8014.4 | 18310.5 | 20101.1 | 20404.0 |
| runtime_error | queue | 15 | 6900.5 | 18792.3 | 18792.3 | 18792.3 |
| runtime_error | spawn | 15 | 323.9 | 404.7 | 404.7 | 404.7 |
| runtime_error | exec | 15 | 298.2 | 383.9 | 383.9 | 383.9 |
| runtime_error | total | 15 | 7588.5 | 19412.2 | 19412.2 | 19412.2 |
| timeout | queue | 15 | 8787.4 | 18497.6 | 18497.6 | 18497.6 |
| timeout | spawn | 15 | 318.0 | 491.1 | 491.1 | 491.1 |
| timeout | exec | 15 | 10018.3 | 10168.1 | 10168.1 | 10168.1 |
| timeout | total | 15 | 19273.4 | 28912.1 | 28912.1 | 28912.1 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1026.0 | 1029.1 |
| 25 | 3098.9 | 2797.0 |
| 50 | 7308.9 | 6769.6 |
| 75 | 15502.6 | 14996.6 |
| 100 | 20097.4 | 19003.3 |

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
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 7683.4 / 12340.4 / 14285.8 / 14301.9 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 5.4 / 5270.2 / 7702.8 / 14301.9 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 79 | 82.7 | 87 |
| ranking.updated | 66 | 66 | 66 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 34318 | 60 | 60 | 60 |
| ranking.updated | 26800 | 28022 | 81722 | 91723 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.99 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.01 / 0.04 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 74 | 0 | 0.00 / 0.01 / 0.02 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 360 | 1.06 / 1.50 / 1.50 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 77 | 400 | 1.94 / 2.96 / 76.62 | — / — / — | — / — / — | — / — / — |
| load | ranking | 64 | 400 | 1.91 / 64.32 / 80.85 | 6.76 / 83.87 / 87.30 | 13.67 / 90.81 / 121.83 | 4.42 / 77.89 / 96.52 |
| settle | heartbeat | 2 | 400 | 1.38 / 1.46 / 1.46 | — / — / — | — / — / — | — / — / — |
| settle | ranking | 1 | 400 | 1.71 / 1.71 / 1.71 | 0.90 / 0.90 / 0.90 | 10.90 / 10.90 / 10.90 | 4.01 / 4.01 / 4.01 |
| storm | heartbeat | 4 | 400 | 0.13 / 1.45 / 1.45 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.1 / 1.4 / 2.6 | 5.6 / 6.9 / 8.7 / 9.2 | 6.6 / 8.1 / 10.1 / 11.8 | 2 |
| load | 1 | 0.9 / 0.9 / 0.9 / 0.9 | 5.7 / 5.7 / 5.7 / 5.7 | 6.8 / 6.8 / 6.8 / 6.8 | 1 |
| storm | 400 | 130.3 / 160.9 / 166.7 / 168.7 | 1677.9 / 1798.6 / 1811.0 / 1816.2 | 1821.8 / 1915.4 / 1922.3 / 1926.9 | 400 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 574 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 1369 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 324.0 / 557.8 / 571.0 / 574.0 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 470.9 / 673.1 / 681.8 / 684.2 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2227.9 / 2754.2 / 2796.6 / 2806.7 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2498 ms) |

