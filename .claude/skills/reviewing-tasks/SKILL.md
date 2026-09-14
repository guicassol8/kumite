---
name: reviewing-tasks
description: Reviews a task PR in two stages (spec compliance, then code quality) and produces the mandatory evidence — a Playwright visual walkthrough with screenshots for front work, test and hurl output for back work. Triggers: "revisa a #N", "revisar o PR", "faz o review", "gera as evidências", "review #N", "review the PR".
---

# Reviewing a task

@docs/task-workflow/reviewing-tasks.md

## Claude Code specifics

Handoff (MANDATORY): the next step runs in a **fresh chat**, so the very last
thing you print is the command to paste there — alone in a fenced block,
nothing after it.

Approved and merged (the issue is closed; on to the next task):

```
/picking-next-task
```

Changes requested (the number is the **issue**, not the PR — the fix continues
that task):

```
/implementing-tasks #12
```

Still blocked on the user's go-ahead to merge? Say that in one line, and print
the `/picking-next-task` block anyway as the step after it. Never end with a
prose suggestion — end with the command itself.
