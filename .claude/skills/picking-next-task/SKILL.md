---
name: picking-next-task
description: Selects the next GitHub Issue to work on — open, unblocked, highest priority, and the most isolated from other open work. Use when the user asks what to do next or wants the next task. Triggers: "próxima task", "o que fazer agora", "pega a próxima", "qual a próxima", "next task", "what's next", "ready work".
---

# Picking the next task

Compute "ready work" the way beads' `bd ready` does: unblocked ∩ highest
priority, tie-broken by isolation. Rules in @docs/workflow.md.

**Not for:** creating issues (`creating-tasks`), planning (`planning-tasks`),
implementing (`implementing-tasks`).

## Step 1 — Compute READY

```bash
gh issue list --state open --json number,title,labels,body,assignees --limit 200
gh pr list --state open --json number,title,headRefName,body
```

Drop every issue that is:
- labeled `epic` or `blocked`;
- listed in an open PR's `Fixes #N` / branch name (already in progress);
- blocked: its `## Blocked by` section references an issue that is still open
  (verify each with `gh issue view <n> --json state`).

If nothing survives, say so and offer `creating-tasks` or unblocking work.

## Step 2 — Rank

1. **Priority**: P0 → P4 (an issue with no P-label is treated as P2 — flag it
   so it gets fixed).
2. **Isolation tie-break** (the user's rule: least chance of colliding with
   another task's scope): prefer the issue whose stack labels and mentioned
   modules/screens overlap least with other READY issues and open PRs.
3. **Unblocking value**: among equally isolated issues, prefer the one that
   more open issues list under "Blocked by".

## Step 3 — Report and confirm

Present: the pick (`#N — title`, priority, stack), WHY it is the most isolated,
what it unblocks, and the runner-up in one line. Ask the user to confirm
(or pick the runner-up). On confirmation:

```bash
gh issue edit <N> --add-assignee @me
```

## Step 4 — Handoff (MANDATORY)

The next step runs in a **fresh chat**, so the very last thing you print is the
command to paste there — alone in a fenced block, nothing after it:

```
/planning-tasks #12
```

Substitute the real number of the confirmed pick. Never end with a prose
suggestion — end with the command itself.
