# Front-only identity change and strict verification

**Found while**: kumite #222 — home and Teams visual identity
**Where in kata**: `kata verify --strict-coverage`

## What

Strict verification passed unchanged for this front-only task: 65 backend files checked, no problems found. Existing typed RPC responses supplied the event rules, rosters, round history and rankings without a framework lookup or backend change.

## Why it matters

The shared gate remains usable for a front-only task and confirms that the backend layout still satisfies the framework rules. It does not validate the visual acceptance criteria; those required Vitest and Playwright checks of the actual screens.

## Metrics

- kata-docs queries: 0; documentation reads: 0. No framework API guessing was needed.
- First completed `kata verify` run: 65 files checked, no findings.
- Resource friction happened in concurrent TypeScript/browser checks on a machine using swap, before kata verification. The checks were resumed in sequence; this was not a kata diagnostic or failure.

- Hook/test friction: setting `VITEST_MAX_WORKERS=2` globally overrides the backend's `fileParallelism: false` worker count in Vitest 4.1.11, causing shared-database races (100 failed tests despite the earlier serial run passing). The setting was corrected to one worker; no test, hook or repository config was bypassed. This is a Vitest invocation issue, not a kata finding.

- Corrected serial pre-commit run passed all 1,365 tests. Hook timings: typecheck 38.09 s; kata verify 1.17 s; tests 207.82 s. The deterministic framework check was a small part of the total gate time and produced no findings.
