# kata-feedback

Reports about the **kata framework itself** (`~/Projetos/kata`), gathered
while working on kumite — not kumite bugs, not kumite feature requests.

## When to write a report (and when not to)

Write a report **only when one of these is true**:

- kata was genuinely **in frame**: the task touched a kata API surface
  (`defineRoute`/`defineMiddleware`/DI, the JWT or error envelopes, `kata
  verify` rules, the hurl conventions, `hc<AppType>` typing) and you learned
  something about it — a bug, a gap, a doc that was wrong or missing, or a
  "does it do the obvious thing?" question that you had to answer by reading
  source;
- there was **friction** attributable to kata: a false positive from `kata
  verify`, a rule that blocked an approved plan, a hurl trap, a type that
  lied, a slow or hung command.

Do **not** write a report to say that kata was out of frame, that `kata
verify` ran and passed, that the kata-docs MCP was not consulted or not
available, or that a front-only task paid the gate ladder. That used to be
the rule and it produced 103 near-identical files (see `v2/TRIAGE.md`).
For those sessions, append **one line** to `LEDGER.csv` instead — the
metrics stay aggregatable and the folder stays readable:

```
date,task,phase,kata_in_frame,docs_lookups,verify_runs,verify_findings,friction_turns,note
2026-09-17,#287,implementing,yes,0,6,0,0,app-level bodyLimit + 503 on /health (report filed)
2026-09-18,#283,implementing,no,0,3,0,0,
```

`phase` is `planning` / `implementing` / `reviewing`; `kata_in_frame` is
`yes`/`no`; `verify_findings` counts real findings (not runs);
`friction_turns` is how many turns kata cost you beyond the task itself.
Leave `note` empty when there is nothing to say.

The kata-docs MCP server is **optional** in this repo: when it is enabled in
your session, prefer it for kata questions; when it is not, read
`~/Projetos/kata/docs` and the bundled `.d.ts` directly. Its absence is not
a finding.

## Format of a report

One file per finding: `<short-slug>.md`, e.g. `strict-coverage-false-positive.md`.
Multiple small entries from one session can share a file if they're
clearly related; otherwise prefer separate files.

```markdown
# <short title>

**Found while**: <task/issue that surfaced this>
**Where in kata**: <module/file/command, if known>

## What

<the bug, gap, improvement idea, or observation>

## Why it matters

<impact on kumite, or on any kata consumer>

## Metrics (optional, include what you have)

<e.g. kata-docs queries made / docs read and their rough token cost vs. the
task's total; extra turns or round-trips caused by looking things up;
whether kata-docs MCP or `kata verify` measurably helped vs. guessing or
reading kata's source directly>

## Suggested fix (optional)

<if you have a concrete idea>
```

Nothing here is auto-filed into kata's own repo/issue tracker — a human
reviews this folder and decides what to act on.

## Archives

- `v1/` — the first batch (2026-08-28 to 2026-09-01), triaged in its
  `TRIAGE.md` and consumed by a human.
- `v2/` — the second batch (2026-09-01 to 2026-09-17, 157 reports), indexed
  by theme in its `TRIAGE.md`; 103 of them are the "out of frame" noise the
  rule above now prevents.

New reports go directly in this folder, never into an archive; archives are
read-only history and agents should not read them for context on new
findings.
