# kata-feedback

Reports about the **kata framework itself** (`~/Projetos/kata`), gathered
while working on kumite — not kumite bugs, not kumite feature requests.

This folder isn't only for bugs. Any agent whose task touched kata (the
`kata-docs` MCP server, `kata verify`, hurl, DI/JWT/error surfaces, or
anything else under `~/Projetos/kata`) should attempt a report here — a
bug, a missing capability, unclear/outdated docs, an improvement idea, a
plain observation, or metrics with no suggestion attached. None of that
needs a fix proposal to be worth recording. See `AGENTS.md` § Kata
framework feedback for the rule.

## Format

One file per finding: `<short-slug>.md`, e.g. `strict-coverage-false-positive.md`.
Multiple small entries from one session can share a file if they're
clearly related; otherwise prefer separate files.

```markdown
# <short title>

**Found while**: <task/issue that surfaced this>
**Where in kata**: <module/file/command, if known>

## What

<the bug, gap, improvement idea, or plain observation>

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

`v1/` holds the first batch of reports (2026-08-28 to 2026-09-01) — already
triaged (see the batch's `TRIAGE.md`) and consumed by a human. New reports
go directly in this folder, not into `v1/` or any other archive; archives
are read-only history and agents should not read them for context on new
findings.
