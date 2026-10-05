# Load report: baseline `muvjr86z`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3136 |
| started | 2026-10-05T17:51:54.687Z |
| ended | 2026-10-05T17:56:14.794Z |
| node | v24.21.0 |
| commit | 3c03ce3 |
| harness loadavg (1/5/15 min) at start | 0.69 / 2.43 / 3.34 |
| harness loadavg (1/5/15 min) at end | 0.16 / 1.14 / 2.57 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | baseline |
| url | http://localhost:3136 |
| teams | 100 |
| members | 3 |
| sse | 400 |
| submissions | 0 |
| badFraction | 0 |
| restSeconds | 60 |
| durationSeconds | 120 |
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
| teams | 100 |
| participants | 300 |
| members per team | 3 (maxTeamSize 3) |
| already in the database before setup | 0 participant(s), 0 team(s) |
| round | — |
| problem | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 60.1 | 0.9 | 1.5 | 280.1 | 86.7 | 1.2 | 1.2 | 0.007 | 0 | 0 | 60 |
| setup | 71.9 | 133.4 | 147.4 | 475.0 | 99.8 | 86.5 | 86.5 | 0.084 | 0 | 0 | 66 |
| sse-ramp | 8.0 | 22.1 | 35.6 | 286.6 | 104.9 | 14.1 | 14.1 | 0.176 | 0 | 394 | 8 |
| sse-idle | 120 | 1.6 | 9.7 | 290.0 | 123.6 | 8.4 | 8.8 | 0.013 | 0 | 400 | 119 |
| teardown | 0.1 | 10.9 | 10.9 | 290.0 | 75.2 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 60 | 200×60 | 3.3 | 4.8 | 15.4 | 15.4 | 0 |
| `GET /organizer/stats/process` | 60 | 200×60 | 3.2 | 4.6 | 8.4 | 8.4 | 0 |
| `POST /auth/login` | 1 | 200×1 | 80.5 | 80.5 | 80.5 | 80.5 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.8 | 3.8 | 3.8 | 3.8 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.3 | 4.3 | 4.3 | 4.3 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 18.3 | 18.3 | 18.3 | 18.3 | 0 |
| `GET /organizer/stats/live` | 66 | 200×66 | 87.3 | 295.1 | 382.4 | 382.4 | 0 |
| `GET /organizer/stats/process` | 66 | 200×66 | 87.6 | 275.6 | 383.6 | 383.6 | 0 |
| `POST /auth/login` | 300 | 200×300 | 488.9 | 580.6 | 597.3 | 667.3 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 491.9 | 587.0 | 600.8 | 688.1 | 0 |
| `POST /teams` | 100 | 201×100 | 7.9 | 12.9 | 18.1 | 19.3 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 10.8 | 13.8 | 20.7 | 21.4 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 8 | 200×8 | 3.2 | 20.8 | 20.8 | 20.8 | 0 |
| `GET /organizer/stats/process` | 8 | 200×8 | 3.1 | 21.9 | 21.9 | 21.9 | 0 |
| `GET /sse` | 400 | 200×400 | 2.4 | 3.0 | 9.9 | 22.9 | 0 |

### sse-idle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 119 | 200×119 | 2.6 | 3.1 | 4.8 | 6.4 | 0 |
| `GET /organizer/stats/process` | 119 | 200×119 | 2.7 | 3.2 | 4.5 | 6.4 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 40.7 | 40.7 | 40.7 | 40.7 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 40.5 | 40.5 | 40.5 | 40.5 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Verdicts

No submissions.

## Actions

| action | started | completed |
| --- | --- | --- |
| signup | 300 | 300 |
| login | 300 | 300 |
| create-team | 100 | 100 |
| join-team | 200 | 200 |

## SSE

| field | value |
| --- | --- |
| requested | 400 |
| opened | 400 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 400 |
| invalid payloads | 0 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 1000.3 / 1002.3 / 1005.4 / 1009.7 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 120 | 123.8 | 128 |
| ranking.updated | 1 | 1 | 1 |
| state.sync | 1 | 1 | 1 |

