# Load report: baseline `mv8f12vl`

**PASS**

## Run

| field | value |
| --- | --- |
| target | http://localhost:3447 |
| started | 2026-10-14T18:00:36.565Z |
| ended | 2026-10-14T18:02:19.633Z |
| node | v24.21.0 |
| commit | ea8f503 |
| harness loadavg (1/5/15 min) at start | 1.71 / 2.09 / 2.02 |
| harness loadavg (1/5/15 min) at end | 3.42 / 2.16 / 2.03 |
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
| out | /tmp/claude-1000/-home-guilherme-code-kumite/3cbb33f2-aa81-414a-834c-d64a0a6449ee/scratchpad/runs/P64 |
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
| rest | 30.1 | 0.9 | 1.8 | 296.2 | 66.8 | 1.6 | 1.6 | 0.007 | 0 | 0 | 30 |
| setup | 72.0 | 128.0 | 139.8 | 554.2 | 99.6 | 100.2 | 100.2 | 0.072 | 0 | 0 | 11 |
| sse-ramp | 0 | — | — | — | — | — | — | — | — | — | 0 |
| sse-idle | 1 | 98.0 | 98.0 | 298.8 | 69.6 | 1.0 | 1.0 | 0.270 | 0 | 0 | 1 |
| teardown | 0.0 | 0.7 | 0.7 | 298.8 | 70.5 | — | — | — | 0 | 0 | 1 |

CPU % is of one core (the judge threads count, so it can pass 100). Lag p99 is the 99th percentile of the per-second windows’ p99.

## Phases (harness process)

| phase | CPU % mean | CPU % max | ELU mean | ELU max | lag p99 ms | lag max ms | largest poll gap ms | samples | saturated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rest | 0.7 | 8.7 | 0.004 | 0.023 | 10.5 | 15.9 | 1007 | 30 | — |
| setup | 2.0 | 19.5 | 0.014 | 0.132 | 23.5 | 26.4 | 8305 | 72 | — |
| sse-ramp | — | — | — | — | — | — | — | 0 | — |
| sse-idle | 1.7 | 1.7 | 0.012 | 0.012 | 10.5 | 10.6 | 1003 | 1 | — |
| teardown | 3.0 | 3.0 | 0.028 | 0.028 | 10.2 | 10.2 | 859 | 1 | — |

The load harness’s own process: CPU % of one core, event-loop utilization and delay per sample window. Largest poll gap: the longest time between two answers of the back sampler (one poll per `--sample-interval` when the harness keeps up; a slow answer from the back widens it too, so it points at the harness only next to a high ELU or lag). A phase is saturated at a mean ELU ≥ 0.9 or a lag ≥ 1000 ms (the heartbeat’s period): its heartbeat gaps, poll gaps and latencies measure the harness, not the back. A warning, never a failure.

## HTTP by route

### rest

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 30 | 200×30 | 3.5 | 5.8 | 15.2 | 15.2 | 0 |
| `GET /organizer/stats/process` | 30 | 200×30 | 3.2 | 5.5 | 7.8 | 7.8 | 0 |
| `POST /auth/login` | 1 | 200×1 | 74.8 | 74.8 | 74.8 | 74.8 | 0 |

### setup

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/event-codes` | 1 | 200×1 | 4.5 | 4.5 | 4.5 | 4.5 | 0 |
| `GET /organizer/event-config` | 1 | 200×1 | 4.6 | 4.6 | 4.6 | 4.6 | 0 |
| `GET /organizer/stats` | 1 | 200×1 | 15.8 | 15.8 | 15.8 | 15.8 | 0 |
| `GET /organizer/stats/live` | 11 | 200×11 | 6004.4 | 7303.1 | 7303.1 | 7303.1 | 0 |
| `GET /organizer/stats/process` | 11 | 200×11 | 6086.3 | 7303.3 | 7303.3 | 7303.3 | 0 |
| `POST /auth/login` | 300 | 200×300 | 9818.2 | 13801.2 | 14306.8 | 14603.0 | 0 |
| `POST /auth/signup` | 300 | 201×300 | 4381.9 | 7768.9 | 13811.4 | 14293.2 | 0 |
| `POST /teams` | 100 | 201×100 | 82.9 | 125.7 | 133.8 | 135.4 | 0 |
| `POST /teams/:id/join` | 200 | 200×200 | 128.3 | 140.1 | 143.4 | 143.8 | 0 |

### sse-idle

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.9 | 2.9 | 2.9 | 2.9 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.7 | 2.7 | 2.7 | 2.7 | 0 |

### teardown

| route | count | statuses | p50 ms | p95 ms | p99 ms | max ms | network errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /organizer/stats/live` | 1 | 200×1 | 2.6 | 2.6 | 2.6 | 2.6 | 0 |
| `GET /organizer/stats/process` | 1 | 200×1 | 2.5 | 2.5 | 2.5 | 2.5 | 0 |

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
| rest | heartbeat | 31 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| setup | heartbeat | 71 | 0 | 0.00 / 0.00 / 0.01 | — / — / — | — / — / — | — / — / — |
| sse-idle | heartbeat | 1 | 0 | 0.00 / 0.00 / 0.00 | — / — / — | — / — / — | — / — / — |

publish: the synchronous `bus.publish` — one `JSON.stringify` per subscriber and the write queued, not the socket write.

