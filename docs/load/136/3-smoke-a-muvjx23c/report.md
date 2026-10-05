# Load report: smoke `muvjx23c`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3136 |
| started | 2026-10-05T17:56:26.716Z |
| ended | 2026-10-05T17:58:11.963Z |
| node | v24.21.0 |
| commit | 3c03ce3 |
| harness loadavg (1/5/15 min) at start | 0.49 / 1.16 / 2.55 |
| harness loadavg (1/5/15 min) at end | 0.26 / 0.92 / 2.31 |
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
| round | load-muvjx23c (a00b78ca-0ee7-4045-9969-78dfe508495c) |
| problem | b45a8591-e6ed-4648-b14d-cef9ae43222d |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 10.1 | 1.0 | 1.4 | 279.5 | 54.9 | 1.1 | 1.1 | 0.009 | 0 | 0 | 10 |
| setup | 4.7 | 110.6 | 133.8 | 472.1 | 70.0 | 80.7 | 80.7 | 0.074 | 0 | 0 | 5 |
| sse-ramp | 0.4 | — | — | — | — | — | — | — | — | — | 0 |
| load | 90.0 | 40.1 | 199.9 | 401.7 | 107.3 | 68.8 | 68.8 | 0.014 | 6 | 20 | 90 |
| teardown | 0.0 | 11.4 | 11.4 | 326.9 | 60.1 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 10 | 200×10 | 3.8 | 16.4 | 16.4 | 16.4 | 0 |
| `GET /organizer/stats/process` | 10 | 200×10 | 3.6 | 8.0 | 8.0 | 8.0 | 0 |
| `POST /auth/login` | 1 | 200×1 | 79.0 | 79.0 | 79.0 | 79.0 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.0 | 4.0 | 4.0 | 4.0 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.5 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /organizer/problems` | 1 | 200×1 | 4.0 | 4.0 | 4.0 | 4.0 | 0 |
| `GET /organizer/rounds` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 19.2 | 19.2 | 19.2 | 19.2 | 0 |
| `GET /organizer/stats/live` | 5 | 200×5 | 82.1 | 325.2 | 325.2 | 325.2 | 0 |
| `GET /organizer/stats/process` | 5 | 200×5 | 81.6 | 323.3 | 323.3 | 323.3 | 0 |
| `POST /auth/login` | 20 | 200×20 | 476.7 | 588.0 | 591.5 | 591.5 | 0 |
| `POST /auth/signup` | 20 | 201×20 | 419.5 | 507.9 | 596.7 | 596.7 | 0 |
| `POST /organizer/rounds` | 1 | 201×1 | 11.1 | 11.1 | 11.1 | 11.1 | 0 |
| `POST /organizer/rounds/:id/open` | 1 | 200×1 | 9.7 | 9.7 | 9.7 | 9.7 | 0 |
| `POST /teams` | 10 | 201×10 | 12.8 | 46.1 | 46.1 | 46.1 | 0 |
| `POST /teams/:id/join` | 10 | 200×10 | 15.0 | 63.2 | 63.2 | 63.2 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /sse` | 20 | 200×20 | 2.9 | 4.1 | 4.5 | 4.5 | 0 |

### load

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 90 | 200×90 | 3.0 | 3.7 | 63.7 | 63.7 | 0 |
| `GET /organizer/stats/process` | 90 | 200×90 | 2.9 | 3.6 | 63.3 | 63.3 | 0 |
| `POST /submissions` | 30 | 201×30 | 489.6 | 10219.1 | 10952.5 | 10952.5 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 3.6 | 3.6 | 3.6 | 3.6 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 3.3 | 3.3 | 3.3 | 3.3 | 0 |
| `POST /organizer/rounds/:id/close` | 1 | 200×1 | 14.7 | 14.7 | 14.7 | 14.7 | 0 |

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
| heartbeat interval ms (p50 / p95 / p99 / max) | 1000.2 / 1001.0 / 1001.9 / 1002.3 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 90 | 90 | 90 |
| ranking.updated | 11 | 11 | 11 |
| state.sync | 1 | 1 | 1 |

