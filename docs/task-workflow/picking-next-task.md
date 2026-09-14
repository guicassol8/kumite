# Picking the next task

Compute "ready work" the way beads' `bd ready` does: unblocked ∩ highest
priority, tie-broken by unblocking value then isolation. Rules in
`docs/workflow.md`.

**Not for:** creating issues (creating tasks), planning (planning a task),
implementing (implementing a task).

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

If nothing survives, say so and offer creating tasks or unblocking work.

## Step 2 — Rank

Apply the READY definition and priority → unblocking-value → isolation
ranking from `docs/workflow.md` § Ready work to the issues gathered above.
Two notes not covered there:
- an issue with no P-label is treated as P2 — flag it so it gets fixed;
- if nothing survives Step 1, that is the answer — say so rather than
  forcing a pick.

## Step 3 — Report and confirm

Present: the pick (`#N — title`, priority, stack), what it unblocks (count +
issue numbers), WHY it won the isolation tie-break, and the runner-up in one
line. Ask the user to confirm (or pick the runner-up). On confirmation:

```bash
gh issue edit <N> --add-assignee @me
```

## Step 4 — Handoff (MANDATORY)

The next step runs in a **fresh session**, so the very last thing you print is
a plain, ready-to-open line for that session:

```
Next: plan issue #12.
```

Substitute the real number of the confirmed pick. Never end with a prose
suggestion alone — end with the literal handoff line.
