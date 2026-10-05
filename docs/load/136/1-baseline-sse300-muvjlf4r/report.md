# Load report: baseline `muvjlf4r`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3136 |
| started | 2026-10-05T17:47:23.743Z |
| ended | 2026-10-05T17:51:42.958Z |
| node | v24.21.0 |
| commit | 3c03ce3 |
| harness loadavg (1/5/15 min) at start | 1.60 / 3.80 / 3.93 |
| harness loadavg (1/5/15 min) at end | 0.72 / 2.50 / 3.37 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | baseline |
| url | http://localhost:3136 |
| teams | 100 |
| members | 3 |
| sse | 300 |
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
| rest | 60.1 | 1.0 | 7.5 | 280.6 | 98.6 | 10.6 | 10.6 | 0.007 | 0 | 0 | 60 |
| setup | 73.1 | 134.3 | 147.8 | 356.0 | 62.5 | 87.8 | 87.8 | 0.076 | 0 | 0 | 66 |
| sse-ramp | 6.0 | 33.1 | 95.1 | 235.3 | 81.4 | 14.5 | 14.5 | 0.246 | 0 | 253 | 6 |
| sse-idle | 120.0 | 1.8 | 17.1 | 264.8 | 112.8 | 6.9 | 14.4 | 0.013 | 0 | 300 | 120 |
| teardown | 0.1 | 10.7 | 10.7 | 166.4 | 64.8 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 60 | 200×60 | 3.4 | 5.4 | 17.3 | 17.3 | 0 |
| `GET /organizer/stats/process` | 60 | 200×60 | 3.3 | 4.6 | 8.7 | 8.7 | 0 |
| `POST /auth/login` | 1 | 200×1 | 84.2 | 84.2 | 84.2 | 84.2 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.5 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.1 | 4.1 | 4.1 | 4.1 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 14.0 | 14.0 | 14.0 | 14.0 | 0 |
| `GET /organizer/stats/live` | 66 | 200×66 | 81.2 | 301.6 | 473.5 | 473.5 | 0 |
| `GET /organizer/stats/process` | 66 | 200×66 | 80.9 | 302.6 | 472.9 | 472.9 | 0 |
| `POST /auth/login` | 300 | 200×300 | 490.1 | 580.5 | 593.7 | 596.7 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 496.2 | 589.3 | 600.1 | 608.6 | 0 |
| `POST /teams` | 100 | 201×100 | 9.3 | 15.2 | 18.6 | 40.4 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 12.6 | 19.1 | 66.9 | 67.5 | 0 |

### sse-ramp

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 6 | 200×6 | 3.0 | 3.6 | 3.6 | 3.6 | 0 |
| `GET /organizer/stats/process` | 6 | 200×6 | 3.0 | 3.5 | 3.5 | 3.5 | 0 |
| `GET /sse` | 300 | 200×300 | 2.5 | 3.0 | 16.6 | 20.5 | 0 |

### sse-idle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 120 | 200×120 | 2.7 | 3.3 | 4.4 | 11.1 | 0 |
| `GET /organizer/stats/process` | 120 | 200×120 | 2.7 | 3.3 | 4.6 | 11.5 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 35.2 | 35.2 | 35.2 | 35.2 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 34.9 | 34.9 | 34.9 | 34.9 | 0 |

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
| requested | 300 |
| opened | 300 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 300 |
| invalid payloads | 0 |
| heartbeat interval ms (p50 / p95 / p99 / max) | 1000.2 / 1001.9 / 1004.0 / 1010.9 |

| event | per connection min | mean | max |
| --- | --- | --- | --- |
| heartbeat | 120 | 122.8 | 126 |
| ranking.updated | 1 | 1 | 1 |
| state.sync | 1 | 1 | 1 |

