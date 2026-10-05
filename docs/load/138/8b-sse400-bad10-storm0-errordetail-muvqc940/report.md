# Load report: burst `muvqc940`

**FAIL**

## Failures

- 1× network error on GET /organizer/stats/live (load), 0 of them timeouts: {"UND_ERR_SOCKET · request · reused":1}
- 28× network error on POST /submissions (load), 0 of them timeouts: {"UND_ERR_SOCKET · request · reused":28}
- submission: 300 started, 272 completed (28 never finished)

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T20:56:13.349Z |
| ended | 2026-10-05T20:59:26.704Z |
| node | v24.21.0 |
| commit | b5f7bf9 |
| harness loadavg (1/5/15 min) at start | 0.28 / 0.84 / 1.28 |
| harness loadavg (1/5/15 min) at end | 2.45 / 1.75 / 1.55 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3137 |
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
| restSeconds | 30 |
| durationSeconds | 600 |
| setupConcurrency | 4 |
| sseRamp | 50 |
| sampleIntervalMs | 1000 |
| requestTimeoutMs | 290000 |
| cooldownMs | 5000 |
| out | /home/guilherme/code/kumite/.claude/worktrees/agent-a431c3203c10c40c0/load-results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvqc940 (a7d19859-7fe8-4e33-8fd7-89b9b7815625) |
| problem | 1567a1cb-c3cb-46b6-b347-b3be58f62cd3 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 1.9 | 280.7 | 67.2 | 27.2 | 27.2 | 0.008 | 0 | 0 | 30 |
| setup | 72.6 | 134.0 | 149.7 | 475.2 | 100.9 | 88.0 | 88.0 | 0.088 | 0 | 0 | 66 |
| sse-ramp | 8.0 | 39.5 | 95.7 | 301.2 | 132.4 | 11.4 | 11.4 | 0.288 | 0 | 361 | 8 |
| load | 78.5 | 184.2 | 205.2 | 689.1 | 201.8 | 588.0 | 588.0 | 0.372 | 92 | 400 | 17 |
| settle | 1.0 | 77.6 | 77.6 | 638.2 | 125.2 | 110.1 | 110.1 | 0.137 | 0 | 400 | 1 |
| storm | 2.9 | 104.2 | 142.1 | 666.9 | 142.8 | 13.0 | 13.0 | 0.781 | 0 | 400 | 2 |
| teardown | 0.1 | 39.2 | 39.2 | 667.3 | 157.1 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 6.3 | 17.6 | 17.6 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.1 | 5.9 | 9.5 | 9.5 | 0 |
| `POST /auth/login` | 1 | 200×1 | 127.2 | 127.2 | 127.2 | 127.2 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.6 | 3.6 | 3.6 | 3.6 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.1 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.4 | 5.4 | 5.4 | 5.4 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 14.9 | 14.9 | 14.9 | 14.9 | 0 |
| `GET /organizer/stats/live` | 66 | 200×66 | 84.1 | 285.3 | 398.8 | 398.8 | 0 |
| `GET /organizer/stats/process` | 66 | 200×66 | 84.0 | 286.0 | 398.1 | 398.1 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.0 | 11.4 | 11.4 | 11.4 | 0 |
| `POST /auth/login` | 300 | 200×300 | 491.3 | 583.1 | 595.9 | 803.7 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 493.7 | 591.5 | 601.5 | 676.4 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 4.0 | 4.9 | 4.9 | 4.9 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.1 | 9.6 | 9.6 | 9.6 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.6 | 9.6 | 9.6 | 9.6 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.1 | 8.1 | 8.1 | 8.1 | 0 |
| `POST /teams` | 100 | 201×100 | 7.7 | 12.7 | 14.7 | 14.7 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.5 | 16.8 | 37.5 | 38.2 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.2 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.2 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /sse` | 400 | 200×400 | 2.4 | 3.0 | 14.1 | 22.9 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 17 | 200×16, network×1 | 842.2 | 23767.9 | 23767.9 | 23767.9 | 1 (0 timeouts) |
| `GET /organizer/stats/process` | 17 | 200×17 | 842.1 | 23767.8 | 23767.8 | 23767.8 | 0 |
| `POST /submissions` | 300 | 201×272, network×28 | 20970.5 | 28219.3 | 35166.9 | 37698.4 | 28 (0 timeouts) |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 1010.1 | 1505.9 | 1505.9 | 1505.9 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 1006.8 | 1506.5 | 1506.5 | 1506.5 | 0 |
| `GET /ranking` | 1 | 200×1 | 8.3 | 8.3 | 8.3 | 8.3 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 10.4 | 10.4 | 10.4 | 10.4 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 94.5 | 309.9 | 309.9 | 309.9 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 93.0 | 303.3 | 303.3 | 303.3 | 0 |
| `GET /ranking` | 3 | 200×3 | 598.0 | 798.3 | 798.3 | 798.3 | 0 |
| `GET /rounds/:id/ranking` | 3 | 200×3 | 781.5 | 798.7 | 798.7 | 798.7 | 0 |
| `GET /sse` | 400 | 200×400 | 407.2 | 695.8 | 710.7 | 713.8 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 5.5 | 5.5 | 5.5 | 5.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 5.2 | 5.2 | 5.2 | 5.2 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 35.6 | 35.6 | 35.6 | 35.6 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 245 | 0 | 0 |
| memory | 0 | 14 | 0 |
| loop | 0 | 0 | 13 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |
| submission | 300 | 272 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 245 | 20620.6 | 28206.5 | 28421.4 | 29287.7 |
| memory | 14 | 20458.8 | 29287.8 | 29287.8 | 29287.8 |
| loop | 13 | 30298.6 | 37698.4 | 37698.4 | 37698.4 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 272 |
| by outcome | passed×245, runtime_error×14, timeout×13 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 1.00 |
| workers spawned / exited / alive at the end | 272 / 272 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 272 | 8296.2 | 19316.9 | 21188.3 | 21739.7 |
| all | spawn | 272 | 383.8 | 639.9 | 774.9 | 799.7 |
| all | exec | 272 | 12.9 | 604.9 | 10182.8 | 10401.3 |
| all | total | 272 | 10305.0 | 20479.8 | 27890.4 | 29383.9 |
| passed | queue | 245 | 8508.0 | 19316.9 | 20798.7 | 21739.7 |
| passed | spawn | 245 | 387.1 | 639.9 | 774.9 | 799.7 |
| passed | exec | 245 | 10.4 | 190.8 | 316.9 | 378.1 |
| passed | total | 245 | 9198.0 | 19814.1 | 21274.9 | 22027.1 |
| runtime_error | queue | 14 | 7298.1 | 21188.3 | 21188.3 | 21188.3 |
| runtime_error | spawn | 14 | 373.3 | 706.2 | 706.2 | 706.2 |
| runtime_error | exec | 14 | 294.1 | 604.9 | 604.9 | 604.9 |
| runtime_error | total | 14 | 8027.5 | 21885.4 | 21885.4 | 21885.4 |
| timeout | queue | 13 | 8296.2 | 18978.3 | 18978.3 | 18978.3 |
| timeout | spawn | 13 | 348.6 | 497.8 | 497.8 | 497.8 |
| timeout | exec | 13 | 10087.0 | 10401.3 | 10401.3 | 10401.3 |
| timeout | total | 13 | 19019.7 | 29383.9 | 29383.9 | 29383.9 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1100.5 | 1101.1 |
| 25 | 3186.5 | 3095.9 |
| 50 | 7403.4 | 7009.3 |
| 75 | 15412.3 | 14300.6 |
| 100 | 21739.7 | 20478.0 |

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
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 9669.2 / 12993.8 / 16802.6 / 16875.7 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 374.5 / 4518.8 / 9254.1 / 16875.7 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 80 | 83.7 | 88 |
| ranking.updated | 68 | 68 | 68 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 34672 | 60 | 60 | 60 |
| ranking.updated | 27600 | 28022 | 81277 | 91628 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.95 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 72 | 0 | 0.00 / 0.01 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 359 | 0.39 / 0.70 / 0.70 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 79 | 400 | 1.19 / 1.42 / 1.71 | — / — / — | — / — / — | — / — / — |
| load | ranking | 67 | 400 | 195.33 / 304.87 / 393.49 | 1.21 / 82.38 / 94.30 | 20.20 / 94.46 / 184.21 | 5.54 / 77.19 / 164.21 |
| settle | heartbeat | 1 | 400 | 0.67 / 0.67 / 0.67 | — / — / — | — / — / — | — / — / — |
| storm | heartbeat | 3 | 400 | 0.41 / 0.72 / 0.72 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.8 / 1.0 / 1.6 / 3.9 | 5.4 / 7.1 / 11.4 / 16.9 | 6.4 / 8.7 / 12.4 / 18.1 | 2 |
| load | 1 | 1.0 / 1.0 / 1.0 / 1.0 | 5.7 / 5.7 / 5.7 / 5.7 | 6.9 / 6.9 / 6.9 / 6.9 | 1 |
| storm | 400 | 113.1 / 178.9 / 189.0 / 189.8 | 1407.2 / 1459.4 / 1462.9 / 1467.2 | 1551.9 / 1583.0 / 1596.3 / 1599.2 | 387 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 1010 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 16 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 0 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 407.2 / 695.8 / 710.7 / 713.8 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 576.0 / 804.9 / 824.0 / 829.2 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 2019.0 / 2508.1 / 2546.9 / 2556.2 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 2107 ms) |

