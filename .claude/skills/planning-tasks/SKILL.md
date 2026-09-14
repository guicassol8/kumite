---
name: planning-tasks
description: Produces a spec-driven implementation plan for a GitHub Issue, interrogating the user about every ambiguity, and posts it on the issue for approval before any code is written. Triggers: "planeja a task", "planejar a #N", "faz o plano", "plano da issue", "plan task", "plan #N", "how should we build".
---

# Planning a task

@docs/task-workflow/planning-tasks.md

## Claude Code specifics

- Use AskUserQuestion for the Step 2 interrogation — batched, with options
  and a recommendation.
- Prefer EnterWorktree over the manual worktree commands in Step 1 when
  running or trying scratch code.
- Handoff (MANDATORY): the next step runs in a **fresh chat**, so the very
  last thing you print is the command to paste there — alone in a fenced
  block, nothing after it:

  ```
  /implementing-tasks #12
  ```

  Substitute the real number. Say in one line above the block that the plan
  must be approved first (a comment on the issue, or "aprovado" at the top of
  the new chat) — the fresh session cannot see this conversation's approval.
  Never end with a prose suggestion — end with the command itself.
