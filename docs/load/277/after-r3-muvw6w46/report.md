# Load report: burst `muvw6w46`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3277 |
| started | 2026-10-05T23:40:00.922Z |
| ended | 2026-10-05T23:43:49.913Z |
| node | v24.21.0 |
| commit | c443ec8 |
| harness loadavg (1/5/15 min) at start | 0.96 / 1.58 / 1.55 |
| harness loadavg (1/5/15 min) at end | 3.72 / 2.53 / 1.93 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | burst |
| url | http://localhost:3277 |
| teams | 100 |
| members | 3 |
| sse | 0 |
| submissions | 300 |
| badFraction | 0.3 |
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
| out | /home/guilherme/code/kumite/.claude/worktrees/agent-a9d23f5e257db0a02/load-results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvw6w46 (e5ccc523-95e3-4616-a517-070fb8bc7563) |
| problem | a47b4631-9e1d-45fb-84c3-75235bb06047 |
| problems in the round | 5 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 1.0 | 1.7 | 279.4 | 66.8 | 3.6 | 3.6 | 0.007 | 0 | 0 | 30 |
| setup | 73.1 | 128.3 | 148.5 | 473.8 | 100.0 | 88.5 | 88.5 | 0.066 | 0 | 0 | 68 |
| sse-ramp | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| load | 125.7 | 194.5 | 203.7 | 496.6 | 110.8 | 73.9 | 75.0 | 0.043 | 96 | 0 | 101 |
| settle | 0.0 | — | — | — | — | — | — | — | — | — | 0 |
| storm | 0.0 | 100.1 | 100.1 | 337.0 | 52.8 | — | — | — | 0 | 0 | 1 |
| teardown | 0.0 | 67.6 | 67.6 | 337.0 | 53.5 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 6.1 | 16.6 | 16.6 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.3 | 6.3 | 8.5 | 8.5 | 0 |
| `POST /auth/login` | 1 | 200×1 | 82.8 | 82.8 | 82.8 | 82.8 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.9 | 3.9 | 3.9 | 3.9 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.4 | 4.4 | 4.4 | 4.4 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/problems/:id` | 1 | 200×1 | 5.5 | 5.5 | 5.5 | 5.5 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 52.7 | 52.7 | 52.7 | 52.7 | 0 |
| `GET /organizer/stats/live` | 68 | 200×68 | 76.5 | 300.0 | 399.1 | 399.1 | 0 |
| `GET /organizer/stats/process` | 68 | 200×68 | 76.3 | 299.5 | 398.4 | 398.4 | 0 |
| `PATCH /organizer/problems/:id` | 4 | 200×4 | 19.9 | 21.0 | 21.0 | 21.0 | 0 |
| `POST /auth/login` | 300 | 200×300 | 466.2 | 573.5 | 589.6 | 658.9 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 499.3 | 700.9 | 937.8 | 1137.7 | 0 |
| `POST /organizer/problems` | 4 | 201×4 | 3.8 | 5.1 | 5.1 | 5.1 | 0 |
| `POST /organizer/problems/:id/publish` | 4 | 200×4 | 16.2 | 16.6 | 16.6 | 16.6 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 8.9 | 8.9 | 8.9 | 8.9 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 16.3 | 16.3 | 16.3 | 16.3 | 0 |
| `POST /teams` | 100 | 201×100 | 16.4 | 40.5 | 48.2 | 48.7 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 18.0 | 33.7 | 35.6 | 51.7 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 101 | 200×101 | 3.0 | 58.8 | 7098.7 | 15820.8 | 0 |
| `GET /organizer/stats/process` | 101 | 200×101 | 2.9 | 59.3 | 7098.6 | 15819.4 | 0 |
| `POST /submissions` | 300 | 201×300 | 35644.0 | 51715.9 | 60187.9 | 61868.8 | 0 |

### settle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.1 | 2.1 | 2.1 | 2.1 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /ranking` | 1 | 200×1 | 7.7 | 7.7 | 7.7 | 7.7 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 9.9 | 9.9 | 9.9 | 9.9 | 0 |

### storm

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 13.9 | 13.9 | 13.9 | 13.9 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 13.7 | 13.7 | 13.7 | 13.7 | 0 |
| `GET /ranking` | 1 | 200×1 | 10.0 | 10.0 | 10.0 | 10.0 | 0 |
| `GET /rounds/:id/ranking` | 1 | 200×1 | 8.8 | 8.8 | 8.8 | 8.8 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 7.6 | 7.6 | 7.6 | 7.6 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

## Verdicts

| sent | accepted | runtime_error | timeout |
| --- | --- | --- | --- |
| correct | 210 | 0 | 0 |
| memory | 0 | 45 | 0 |
| loop | 0 | 0 | 45 |

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
| correct | 210 | 35536.5 | 51082.9 | 59877.3 | 60016.8 |
| memory | 45 | 35296.3 | 51547.4 | 60080.4 | 60080.4 |
| loop | 45 | 41809.6 | 60869.1 | 61868.9 | 61868.9 |

HTTP latency of the `POST /submissions` that answered 201, until its last byte.

## Judge (load phase)

| field | value |
| --- | --- |
| runs that arrived during the load | 300 |
| by outcome | passed×210, runtime_error×45, timeout×45 |
| largest queue at an arrival (itself included) | 96 |
| spawn share of passed runs, spawn ÷ (spawn + exec) (p50 / p95 / max) | 0 / 0.98 / 0.98 |
| workers spawned / exited / alive / idle at the end | 48 / 45 / 3 / 3 |
| judge config (concurrency · timeout ms · memory MB) | 4 · 2000 · 64 |

| outcome | stage | count | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- |
| all | queue | 300 | 29784.6 | 36181.1 | 36727.4 | 37002.5 |
| all | spawn | 300 | 0 | 285.0 | 412.7 | 500.1 |
| all | exec | 300 | 5.7 | 10005.8 | 10010.0 | 10077.0 |
| all | total | 300 | 31225.9 | 45500.4 | 45908.2 | 46572.8 |
| passed | queue | 210 | 29999.9 | 36210.3 | 36727.4 | 37002.5 |
| passed | spawn | 210 | 0 | 289.1 | 412.7 | 421.4 |
| passed | exec | 210 | 3.9 | 77.1 | 174.9 | 186.0 |
| passed | total | 210 | 30290.6 | 36279.2 | 36984.4 | 37007.8 |
| runtime_error | queue | 45 | 30623.0 | 36034.0 | 36832.6 | 36832.6 |
| runtime_error | spawn | 45 | 0 | 0 | 500.1 | 500.1 |
| runtime_error | exec | 45 | 186.2 | 227.0 | 282.5 | 282.5 |
| runtime_error | total | 45 | 30807.9 | 36213.4 | 37031.5 | 37031.5 |
| timeout | queue | 45 | 28407.6 | 35988.7 | 36568.0 | 36568.0 |
| timeout | spawn | 45 | 0 | 0 | 363.5 | 363.5 |
| timeout | exec | 45 | 10005.4 | 10010.3 | 10077.0 | 10077.0 |
| timeout | total | 45 | 38413.3 | 45994.9 | 46572.8 | 46572.8 |

queue: arrival to a judge slot. spawn: slot to the worker’s `ready` (QuickJS loaded). exec: `ready` to the last case’s reply. total: their sum.

### First wave

| k-th arrival | its queue wait ms | p95 queue wait of the first k ms |
| --- | --- | --- |
| 10 | 0.0 | 589.7 |
| 25 | 813.1 | 708.4 |
| 50 | 11803.4 | 11502.4 |
| 75 | 21881.8 | 21696.0 |
| 100 | 31889.2 | 31219.1 |

First k whose p95 queue wait passes 5000 ms: 31.

## SSE

| field | value |
| --- | --- |
| requested | 0 |
| opened | 0 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 0 |
| invalid payloads | 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | — / — / — / — |
| heartbeat interval ms (p50 / p95 / p99 / max) | — / — / — / — |

| event | per connection min | mean | max |
| --- | --- | --- | --- |

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 73 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| load | heartbeat | 125 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |
| load | ranking | 35 | 0 | 0.00 / 0.00 / 0.00 | 0.98 / 61.66 / 16715.94 | 3.98 / 8.37 / 352.82 | 3.66 / 7.21 / 73.19 |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

## Settle

| check | result |
| --- | --- |
| judge drained | yes after 3 ms (in flight 0, waiting 0, workers alive 3, idle 3) |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 18 ms) |

## Storm

| field | value |
| --- | --- |
| reopened | 0 over 0 s |
| opened | 0 |
| failed to open | 0 |
| dropped | 0 |
| to headers ms (p50 / p95 / p99 / max) | — / — / — / — |
| to the first state.sync ms (p50 / p95 / p99 / max) | — / — / — / — |
| to the first ranking.updated ms (p50 / p95 / p99 / max) | — / — / — / — |
| ranking consistency | 0 compared, 0 without a ranking, 0 distinct digest(s): nothing to compare (after 15 ms) |

