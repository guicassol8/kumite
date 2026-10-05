# Load report: smoke `muvkmz7o`

**PASS**

## Warnings

- the database was not clean before setup: 20 participant(s), 10 team(s) already existed. Reset it (and restart the back) between runs you want to compare.

## Run

| field | value |
| --- | --- |
| target | http://localhost:3136 |
| started | 2026-10-05T18:16:36.041Z |
| ended | 2026-10-05T18:18:21.215Z |
| node | v24.21.0 |
| commit | 3c03ce3 |
| harness loadavg (1/5/15 min) at start | 0.22 / 0.31 / 0.14 |
| harness loadavg (1/5/15 min) at end | 0.38 / 0.39 / 0.19 |
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
| already in the database before setup | 20 participant(s), 10 team(s) |
| round | load-muvkmz7o (9f1a9ba2-0495-4bf8-bab4-2131feaf0dff) |
| problem | 251bf27b-14e8-4d40-87f9-a68e17e8e320 |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 10.1 | 1.2 | 1.8 | 213.8 | 51.2 | 1.6 | 1.6 | 0.007 | 0 | 0 | 10 |
| setup | 4.7 | 108.5 | 136.7 | 402.7 | 52.5 | 83.6 | 83.6 | 0.040 | 0 | 0 | 4 |
| sse-ramp | 0.4 | 84.3 | 84.3 | 218.9 | 55.3 | 74.8 | 74.8 | 0.194 | 0 | 14 | 1 |
| load | 90.0 | 40.2 | 201.4 | 313.6 | 63.1 | 67.6 | 67.6 | 0.013 | 0 | 20 | 89 |
| teardown | 0.0 | 2.0 | 2.0 | 247.0 | 53.7 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 10 | 200×10 | 3.7 | 7.1 | 7.1 | 7.1 | 0 |
| `GET /organizer/stats/process` | 10 | 200×10 | 3.4 | 6.8 | 6.8 | 6.8 | 0 |
| `POST /auth/login` | 1 | 200×1 | 71.9 | 71.9 | 71.9 | 71.9 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.1 | 3.1 | 3.1 | 3.1 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 3.6 | 3.6 | 3.6 | 3.6 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.4 | 3.4 | 3.4 | 3.4 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 6.3 | 6.3 | 6.3 | 6.3 | 0 |
| `GET /organizer/stats/live` | 4 | 200×4 | 189.9 | 360.3 | 360.3 | 360.3 | 0 |
| `GET /organizer/stats/process` | 4 | 200×4 | 190.7 | 359.0 | 359.0 | 359.0 | 0 |
| `POST /auth/login` | 20 | 200×20 | 478.0 | 504.8 | 586.3 | 586.3 | 0 |
| `POST /auth/signup` | 20 | 201×20 | 414.9 | 506.4 | 518.8 | 518.8 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 8.2 | 8.2 | 8.2 | 8.2 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 8.8 | 8.8 | 8.8 | 8.8 | 0 |
| `POST /teams` | 10 | 201×10 | 11.1 | 14.5 | 14.5 | 14.5 | 0 |
| `POST /teams/:id/join` | 10 | 200×10 | 14.0 | 29.0 | 29.0 | 29.0 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.2 | 3.2 | 3.2 | 3.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.0 | 3.0 | 3.0 | 3.0 | 0 |
| `GET /sse` | 20 | 200×20 | 2.7 | 3.8 | 6.5 | 6.5 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 89 | 200×89 | 3.0 | 4.0 | 36.4 | 36.4 | 0 |
| `GET /organizer/stats/process` | 89 | 200×89 | 2.8 | 4.0 | 30.4 | 30.4 | 0 |
| `POST /submissions` | 30 | 201×30 | 415.8 | 10202.3 | 10886.9 | 10886.9 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 38.1 | 38.1 | 38.1 | 38.1 | 0 |

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
| heartbeat interval ms (p50 / p95 / p99 / max) | 1000.2 / 1001.1 / 1002.3 / 1003.2 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 90 | 90.9 | 91 |
| ranking.updated | 11 | 11 | 11 |
| state.sync | 1 | 1 | 1 |

