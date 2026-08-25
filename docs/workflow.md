# kumite — task workflow

Tasks are **GitHub Issues** in this repo, driven by the five skills in
`.claude/skills/`: creating-tasks → picking-next-task → planning-tasks →
implementing-tasks → reviewing-tasks.

## Labels

| Group | Labels | Meaning |
|---|---|---|
| Priority | `P0` `P1` `P2` `P3` `P4` | P0 = drop everything · P2 = default · P4 = someday |
| Stack | `stack:front` `stack:back` `stack:fullstack` `stack:infra` `stack:harness` | where the work happens |
| Type | `type:feature` `type:bug` `type:chore` `type:spike` | nature of the work |
| Structure | `epic` | umbrella issue that only tracks sub-issues |
| State | `blocked` | explicitly parked (independent of "Blocked by") |

Every non-epic issue carries exactly one priority, one type, and at least one stack label.

## Issue body format

```markdown
## Contexto
Why this exists, 2–5 lines. If it belongs to an epic: "Part of #E".
If found mid-task: "Discovered from #N".

## Spec
What must be true when this is done — concrete, testable statements.

## Acceptance
- WHEN <condition> THE SYSTEM SHALL <behavior>
- WHEN <error condition> THE SYSTEM SHALL <error behavior>

## Blocked by
- #12
(omit the section when nothing blocks)
```

Epics: body is Contexto + a task list (`- [ ] #N`) of sub-issues; no Acceptance
of their own.

## Ready work — how the next task is chosen

An issue is **READY** when: open · not `epic` · not `blocked` · every "Blocked
by" reference is closed · not already linked to an open PR.

Pick = READY ∩ highest priority, tie-broken by **isolation**: prefer the issue
whose scope (stack, modules, screens) overlaps least with other open issues and
in-progress work. Among equally isolated issues, prefer the one that unblocks
the most others.

## Branches, commits, PRs

- Branch `task/<issue>-<slug>` off up-to-date `main`.
- Conventional commits: `feat:` `fix:` `chore:` `test:` `docs:` `refactor:`.
- PR body starts with `Fixes #N` and ends with an `## Evidence` section.
- **Evidence is mandatory** (reviewing-tasks):
  - front → Playwright walkthrough screenshots committed under
    `front/e2e/evidence/<issue>/`, referenced step by step in the PR body;
  - back → trimmed `pnpm -r test` + `pnpm --filter @kumite/back hurl` output.

## Discovered work

Mid-task discoveries never expand the current scope: open a new issue
("Discovered from #N") and keep the task on rails.
