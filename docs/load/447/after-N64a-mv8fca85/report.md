# Load report: baseline `mv8fca85`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3447 |
| started | 2026-10-14T18:09:19.305Z |
| ended | 2026-10-14T18:10:58.760Z |
| node | v24.21.0 |
| commit | fe0ed59 |
| harness loadavg (1/5/15 min) at start | 1.75 / 1.84 / 1.88 |
| harness loadavg (1/5/15 min) at end | 3.96 / 2.20 / 1.97 |
| harness available parallelism | 12 |

## Config

| option | value |
| --- | --- |
| scenario | baseline |
| url | http://localhost:3447 |
| teams | 100 |
| members | 3 |
| sse | 0 |
| submissions | 0 |
| badFraction | 0 |
| memoryShare | 0 |
| problems | 1 |
| untilDone | false |
| storm | false |
| stormWindowSeconds | 0 |
| pastRounds | 0 |
| resendStale | false |
| restSeconds | 30 |
| durationSeconds | 1 |
| setupConcurrency | 64 |
| sseRamp | 50 |
| sampleIntervalMs | 1000 |
| requestTimeoutMs | 60000 |
| cooldownMs | 5000 |
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3cbb33f2-aa81-414a-834c-d64a0a6449ee/scratchpad/runs/N64a |
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
| problems in the round | 0 |
| past rounds | — |
| leftover rounds closed | — |

## Phases (back process)

| phase | duration s | CPU % mean | CPU % max | RSS max MiB | heap max MiB | lag p99 ms | lag max ms | ELU mean | judge waiting max | SSE (server) max | samples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 30.1 | 0.9 | 1.7 | 294.7 | 66.8 | 3.1 | 3.1 | 0.006 | 0 | 0 | 30 |
| setup | 68.4 | 124.1 | 137.8 | 490.0 | 100.9 | 86.0 | 86.0 | 0.073 | 0 | 0 | 67 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| sse-idle | 1 | 20.9 | 20.9 | 298.6 | 88.7 | 0.9 | 0.9 | 0.295 | 0 | 0 | 1 |
| teardown | 0.0 | 1.4 | 1.4 | 298.6 | 89.3 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.7 | 8.9 | 0.003 | 0.024 | 10.9 | 13.4 | 1007 | 30 | — |
| setup | 2.5 | 12.2 | 0.019 | 0.086 | 17.4 | 22.2 | 1217 | 68 | — |
| sse-ramp | — | — | — | — | — | — | — | 0 | — |
| sse-idle | 11.3 | 11.3 | 0.094 | 0.094 | 11.1 | 11.2 | 1003 | 1 | — |
| teardown | 0.7 | 0.7 | 0.006 | 0.006 | 10.3 | 10.3 | 173 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up; a slow answer from the back widens it too, so it points at the harness only next to a high ELU or lag). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.4 | 5.5 | 15.2 | 15.2 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 5.2 | 7.8 | 7.8 | 0 |
| `POST /auth/login` | 1 | 200×1 | 83.5 | 83.5 | 83.5 | 83.5 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 3.6 | 3.6 | 3.6 | 3.6 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.2 | 4.2 | 4.2 | 4.2 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 14.5 | 14.5 | 14.5 | 14.5 | 0 |
| `GET /organizer/stats/live` | 67 | 200×67 | 7.8 | 85.2 | 215.8 | 215.8 | 0 |
| `GET /organizer/stats/process` | 67 | 200×67 | 7.3 | 84.6 | 210.4 | 210.4 | 0 |
| `POST /auth/login` | 300 | 200×300 | 7192.8 | 7387.3 | 7479.6 | 7492.8 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 7199.2 | 7404.6 | 7487.1 | 7584.4 | 0 |
| `POST /teams` | 100 | 201×100 | 74.8 | 116.2 | 127.5 | 127.8 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 131.1 | 178.8 | 183.4 | 186.3 | 0 |

### sse-idle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.4 | 2.4 | 2.4 | 2.4 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.3 | 2.3 | 2.3 | 2.3 | 0 |

Latency is until the end of the body; for `GET /sse`, until the headers.

## Retries

None.

A submission is sent again once, and only once, when the back closed a reused keep-alive socket before any byte of a response. Each retry is also a network error in the table above.

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
| requested | 0 |
| opened | 0 |
| failed to open | 0 |
| dropped | 0 |
| closed by the harness | 0 |
| invalid payloads | 0 |
| payloads validated (distinct / reused) | 0 / 0 |
| largest heartbeat gap per connection ms (p50 / p95 / p99 / max) | — / — / — / — |
| heartbeat interval ms (p50 / p95 / p99 / max) | — / — / — / — |

| event | per connection min | mean | max |
| --- | --- | --- | --- |

### Emissions (back)

| phase | kind | count | subscribers max | publish ms p50 / p95 / max | open round ms p50 / p95 / max | round ranking ms p50 / p95 / max | event ranking ms p50 / p95 / max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| rest | heartbeat | 30 | 0 | 0.00 / 0.00 / 0.02 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 68 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-idle | heartbeat | 1 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

