# kata-feedback

Reports about the **kata framework itself** (`~/Projetos/kata`), found while
working on kumite — not kumite bugs, not kumite feature requests.

Whenever any agent notices a bug, a missing capability, unclear/outdated
docs, or a possible improvement in kata while doing unrelated kumite work,
it writes a report here instead of silently ignoring it or expanding the
current task's scope. See `AGENTS.md` § Kata framework feedback for the
rule.

## Format

One file per finding: `<short-slug>.md`, e.g. `strict-coverage-false-positive.md`.

```markdown
# <short title>

**Found while**: <task/issue that surfaced this>
**Where in kata**: <module/file/command, if known>

## What

<the bug, gap, or improvement idea>

## Why it matters

<impact on kumite, or on any kata consumer>

## Suggested fix (optional)

<if you have a concrete idea>
```

Nothing here is auto-filed into kata's own repo/issue tracker — a human
reviews this folder and decides what to act on.
