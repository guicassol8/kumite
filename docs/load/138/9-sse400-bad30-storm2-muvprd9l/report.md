# Load report: burst `muvprd9l`

**FAIL**

## Failures

- 1× network error on GET /organizer/stats/live (load), 0 of them timeouts
- 2× network error on GET /organizer/stats/process (load), 0 of them timeouts
- 18× network error on POST /submissions (load), 0 of them timeouts
- submission: 300 started, 282 completed (18 never finished)

## Run

| field | value |
| --- | --- |
| target | http://localhost:3137 |
| started | 2026-10-05T20:39:58.957Z |
| ended | 2026-10-05T20:44:19.528Z |
| node | v24.21.0 |
| commit | ed48fe6 |
| harness loadavg (1/5/15 min) at start | 0.90 / 1.38 / 1.41 |
| harness loadavg (1/5/15 min) at end | 2.73 / 1.79 / 1.54 |
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
| badFraction | 0.3 |
| memoryShare | 0.5 |
| problems | 5 |
| untilDone | true |
| storm | true |
| stormWindowSeconds | 2 |
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
| round | load-muvprd9l (46c59ffb-de64-4dd5-b4e7-47502dcabc52) |
| problem | ceb228c3-2aa4-492e-b756-0591b307b64f |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 2.5 | 279.6 | 67.2 | 8.1 | 8.1 | 0.008 | 0 | 0 | 30 |
| setup | 72.5 | 133.8 | 149.7 | 474.9 | 100.8 | 86.6 | 86.6 | 0.067 | 0 | 0 | 67 |
| sse-ramp | 8.0 | 31.9 | 36.7 | 309.2 | 123.2 | 48.8 | 48.8 | 0.320 | 0 | 399 | 8 |
| load | 146.8 | 199.5 | 205.7 | 666.3 | 205.1 | 561.5 | 565.5 | 0.335 | 95 | 400 | 35 |
| settle | 0.6 | 186.8 | 186.8 | 671.0 | 171.5 | 6.6 | 6.6 | 0.015 | 0 | 400 | 1 |
| storm | 2.5 | 96.0 | 116.8 | 676.9 | 278.7 | 4.0 | 4.0 | 0.847 | 0 | 392 | 2 |
| teardown | 0.1 | 100.2 | 100.2 | 677.0 | 114.9 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 6.6 | 24.1 | 24.1 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 6.2 | 9.1 | 9.1 | 0 |
| `POST /auth/login` | 1 | 200×1 | 85.2 | 85.2 | 85.2 | 85.2 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.7 | 3.7 | 3.7 | 3.7 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.3 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 4.5 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.6 | 15.6 | 15.6 | 15.6 | 0 |
| `GET /organizer/stats/live` | 67 | 200×67 | 85.0 | 290.4 | 304.6 | 304.6 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 86.0 | 289.4 | 304.4 | 304.4 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 9.6 | 12.3 | 12.3 | 12.3 | 0 |
| `POST /auth/login` | 300 | 200×300 | 490.4 | 581.5 | 595.7 | 605.5 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 494.4 | 587.4 | 598.1 | 605.7 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.6 | 4.8 | 4.8 | 4.8 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 6.5 | 7.1 | 7.1 | 7.1 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 9.5 | 9.5 | 9.5 | 9.5 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 7.7 | 7.7 | 7.7 | 7.7 | 0 |
| `POST /teams` | 100 | 201×100 | 7.7 | 13.1 | 69.6 | 69.7 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.5 | 13.9 | 20.1 | 20.3 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.2 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.2 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /sse` | 400 | 200×400 | 2.4 | 3.3 | 12.4 | 25.3 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 35 | 200×34, network×1 | 13.2 | 15286.1 | 43724.3 | 43724.3 | 1 (0 timeouts) |
| `GET /organizer/stats/process` | 35 | 200×33, network×2 | 13.0 | 4690.3 | 43724.9 | 43724.9 | 2 (0 timeouts) |
| `POST /submissions` | 300 | 201×282, network×18 | 44687.5 | 59004.9 | 64484.6 | 68309.3 | 18 (0 timeouts) |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 542.7 | 6508.8 | 6508.8 | 6508.8 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 543.5 | 6508.5 | 6508.5 | 6508.5 | 0 |
| `GET /ranking` | 1 | 200×1 | 7.6 | 7.6 | 7.6 | 7.6 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 9.8 | 9.8 | 9.8 | 9.8 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 2 | 200×2 | 25.2 | 44.6 | 44.6 | 44.6 | 0 |
| `GET /organizer/stats/process` | 2 | 200×2 | 26.6 | 44.2 | 44.2 | 44.2 | 0 |
| `GET /ranking` | 2 | 200×2 | 6.8 | 163.7 | 163.7 | 163.7 | 0 |
| `GET /rounds/:id/ranking` | 2 | 200×2 | 9.4 | 183.7 | 183.7 | 183.7 | 0 |
| `GET /sse` | 400 | 200×400 | 28.4 | 42.2 | 45.6 | 48.4 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 6.3 | 6.3 | 6.3 | 6.3 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 6.6 | 6.6 | 6.6 | 6.6 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 38.6 | 38.6 | 38.6 | 38.6 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 196 | 0 | 0 |
| memory | 0 | 42 | 0 |
| loop | 0 | 0 | 44 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |
| submission | 300 | 282 |

## Submissions by kind

| sent | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- |
| correct | 196 | 43849.1 | 53979.7 | 58149.1 | 58149.1 |
| memory | 42 | 43482.3 | 53167.2 | 58148.4 | 58148.4 |
| loop | 44 | 54084.4 | 64484.7 | 68309.5 | 68309.5 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 282 |
| by outcome | passed×196, runtime_error×42, timeout×44 |
| largest queue at an arrival (itself included) | 95 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0.97 / 0.99 / 1.00 |
| workers spawned / exited / alive at the end | 282 / 282 / 0 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 282 | 26202.4 | 41927.0 | 43183.8 | 43914.0 |
| all | spawn | 282 | 306.4 | 608.7 | 782.7 | 784.5 |
| all | exec | 282 | 33.1 | 10074.6 | 10420.2 | 10494.8 |
| all | total | 282 | 27500.3 | 47304.7 | 52621.1 | 52878.7 |
| passed | queue | 196 | 26202.4 | 41927.0 | 43422.0 | 43914.0 |
| passed | spawn | 196 | 301.6 | 603.7 | 783.4 | 784.5 |
| passed | exec | 196 | 7.9 | 183.6 | 395.3 | 403.5 |
| passed | total | 196 | 26507.6 | 42597.9 | 43915.0 | 44207.9 |
| runtime_error | queue | 42 | 25190.5 | 42105.3 | 42919.8 | 42919.8 |
| runtime_error | spawn | 42 | 324.1 | 697.3 | 782.7 | 782.7 |
| runtime_error | exec | 42 | 212.8 | 518.4 | 599.0 | 599.0 |
| runtime_error | total | 42 | 25722.4 | 42708.2 | 43422.8 | 43422.8 |
| timeout | queue | 44 | 25887.8 | 41906.8 | 42508.0 | 42508.0 |
| timeout | spawn | 44 | 309.9 | 509.0 | 618.1 | 618.1 |
| timeout | exec | 44 | 10011.3 | 10420.2 | 10494.8 | 10494.8 |
| timeout | total | 44 | 36578.6 | 52621.1 | 52878.7 | 52878.7 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 1093.6 | 1093.6 |
| 25 | 5488.8 | 5202.2 |
| 50 | 23698.3 | 22879.3 |
| 75 | 30618.5 | 29091.7 |
| 100 | 43914.0 | 40909.1 |

First k whose p95 queue wait passes 5000 ms: 25.

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | 10108.8 / 16992.0 / 18738.5 / 18756.4 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 3.7 / 6174.3 / 9645.4 / 18756.4 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 147 | 150.9 | 155 |
| ranking.updated | 118 | 118 | 118 |
| state.sync | 1 | 1 | 1 |

### Payloads

| event | events | min bytes | mean bytes | max bytes |
| --- | --- | --- | --- | --- |
| heartbeat | 61018 | 60 | 60 | 60 |
| ranking.updated | 47600 | 28022 | 82061 | 91578 |
| state.sync | 800 | 179 | 179 | 179 |

Largest `ranking.updated` × connections opened: 34.93 MiB per emission. Bytes are the `data:` line, UTF-8.

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 72 | 0 | 0.00 / 0.01 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-ramp | heartbeat | 8 | 372 | 0.39 / 0.78 / 0.78 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 147 | 400 | 1.10 / 1.38 / 1.60 | — / — / — | — / — / — | — / — / — |
| load | ranking | 117 | 400 | 196.44 / 276.51 / 363.54 | 9.01 / 77.39 / 410.55 | 14.21 / 91.99 / 102.64 | 4.97 / 74.53 / 88.20 |
| storm | heartbeat | 3 | 400 | 0.56 / 0.72 / 0.72 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

### Connects (back)

| phase | count | state.sync ms | ranking ms | total ms | concurrent max |
| --- | --- | --- | --- | --- | --- |
| sse-ramp | 399 | 0.9 / 1.1 / 1.3 / 2.8 | 5.3 / 6.6 / 9.1 / 14.2 | 6.4 / 8.1 / 10.7 / 15.4 | 2 |
| load | 1 | 0.9 / 0.9 / 0.9 / 0.9 | 5.0 / 5.0 / 5.0 / 5.0 | 6.1 / 6.1 / 6.1 / 6.1 | 1 |
| storm | 400 | 23.9 / 37.8 / 41.7 / 45.6 | 248.1 / 344.6 / 357.2 / 359.2 | 274.2 / 381.2 / 389.6 / 391.1 | 77 |

p50 / p95 / p99 / max. total: from the handler’s start until the snapshot’s ranking frame was written; concurrent: snapshots being built at once.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 544 ms (in flight 0, waiting 0, workers alive 0) |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 16 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 400 over 2 s |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | 28.4 / 42.2 / 45.6 / 48.4 |
| to the first state.sync ms (p50 / p95 / p99 / max) | 52.5 / 77.7 / 82.8 / 84.5 |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | 308.6 / 421.3 / 427.8 / 432.5 |
| ranking consistency | 400 compared, 0 without a ranking, 1 distinct digest(s): matches the API (after 453 ms) |

