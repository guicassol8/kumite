# Load report: smoke `muvkkbyl`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3136 |
| started | 2026-10-05T18:14:32.593Z |
| ended | 2026-10-05T18:16:18.173Z |
| node | v24.21.0 |
| commit | 3c03ce3 |
| harness loadavg (1/5/15 min) at start | 0.35 / 0.28 / 0.10 |
| harness loadavg (1/5/15 min) at end | 0.29 / 0.33 / 0.15 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | smoke |
| url | http://localhost:3136 |
| teams | 10 |
| members | 2 |
| sse | 20 |
| submissions | 30 |
| badFraction | 0.1 |
| restSeconds | 10 |
| durationSeconds | 90 |
| setupConcurrency | 4 |
| sseRamp | 50 |
| sampleIntervalMs | 1000 |
| requestTimeoutMs | 60000 |
| cooldownMs | 5000 |
| out | /home/guilherme/code/kumite/.claude/worktrees/agent-a1296f95988d60b58/load-results |
| allowRemote | false |
| organizerEmail | organizer@edu.pucrs.br |

## World

| field | value |
| --- | --- |
| teams | 10 |
| participants | 20 |
| members per team | 2 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | load-muvkkbyl (73c73af5-5800-4427-bca5-4e624892c533) |
| problem | 251bf27b-14e8-4d40-87f9-a68e17e8e320 |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 10.1 | 1.1 | 1.6 | 297.2 | 55.8 | 0.8 | 0.8 | 0.009 | 0 | 0 | 10 |
| setup | 5.1 | 116.5 | 139.9 | 489.5 | 70.1 | 93.4 | 93.4 | 0.056 | 0 | 0 | 5 |
| sse-ramp | 0.4 | — | — | — | — | — | — | — | — | — | 0 |
| load | 90.0 | 40.0 | 202.0 | 423.6 | 104.8 | 70.3 | 70.3 | 0.015 | 6 | 20 | 90 |
| teardown | 0.0 | 6.9 | 6.9 | 343.9 | 58.2 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 10 | 200×10 | 3.8 | 15.1 | 15.1 | 15.1 | 0 |
| `GET /organizer/stats/process` | 10 | 200×10 | 3.6 | 7.4 | 7.4 | 7.4 | 0 |
| `POST /auth/login` | 1 | 200×1 | 91.1 | 91.1 | 91.1 | 91.1 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.2 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.3 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.7 | 3.7 | 3.7 | 3.7 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.4 | 3.4 | 3.4 | 3.4 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 20.2 | 20.2 | 20.2 | 20.2 | 0 |
| `GET /organizer/stats/live` | 5 | 200×5 | 78.5 | 377.2 | 377.2 | 377.2 | 0 |
| `GET /organizer/stats/process` | 5 | 200×5 | 79.7 | 376.4 | 376.4 | 376.4 | 0 |
| `POST /auth/login` | 20 | 200×20 | 427.1 | 503.2 | 518.3 | 518.3 | 0 |
| `POST /auth/signup` | 20 | 201×20 | 491.4 | 592.9 | 608.0 | 608.0 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 29.7 | 29.7 | 29.7 | 29.7 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 17.6 | 17.6 | 17.6 | 17.6 | 0 |
| `POST /teams` | 10 | 201×10 | 37.1 | 61.7 | 61.7 | 61.7 | 0 |
| `POST /teams/:id/join` | 10 | 200×10 | 38.4 | 64.8 | 64.8 | 64.8 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /sse` | 20 | 200×20 | 2.7 | 4.2 | 7.5 | 7.5 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 90 | 200×90 | 2.8 | 3.5 | 63.7 | 63.7 | 0 |
| `GET /organizer/stats/process` | 90 | 200×90 | 2.7 | 3.8 | 62.5 | 62.5 | 0 |
| `POST /submissions` | 30 | 201×30 | 482.5 | 10121.3 | 10914.5 | 10914.5 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.8 | 2.8 | 2.8 | 2.8 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 16.2 | 16.2 | 16.2 | 16.2 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Verdicts

| sent | accepted | timeout |
| --- | --- | --- |
| correct | 27 | 0 |
| loop | 0 | 3 |

Incoherent: 0

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 20 | 20 |
| login | 20 | 20 |
| create-team | 10 | 10 |
| join-team | 10 | 10 |
| submission | 30 | 30 |

## SSE

| field | value |
| --- | --- |
| requested | 20 |
| opened | 20 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 20 |
| invalid payloads | 0 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 1000.2 / 1001.1 / 1002.2 / 1002.8 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 90 | 90.7 | 91 |
| ranking.updated | 10 | 10 | 10 |
| state.sync | 1 | 1 | 1 |

