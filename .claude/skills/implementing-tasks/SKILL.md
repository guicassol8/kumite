---
name: implementing-tasks
description: Implements an approved GitHub Issue plan on a task branch with TDD, runs every gate, and opens a PR linked to the issue. Triggers: "implementa a #N", "bora implementar", "codar a task", "faz a task", "implement #N", "work on #N", "build it".
---

# Implementing a task

@docs/task-workflow/implementing-tasks.md

## Claude Code specifics

- Prefer EnterWorktree over the manual worktree commands in Preconditions.
- Use AskUserQuestion for missing decisions under the House rules.
- Claude Code's hooks (PostToolUse/Stop, documented in `CLAUDE.md`
  § Claude-specific notes) already run the Gates loop automatically — the
  generic doc's "run these yourself" clause is belt-and-suspenders here, not
  a contradiction.
- Handoff (MANDATORY): the review runs in a **fresh chat**, so the very last
  thing you print is the command to paste there — alone in a fenced block,
  nothing after it:

  ```
  /reviewing-tasks #34
  ```

  That number is the **PR**, not the issue — print the PR number you just
  opened, and its URL in the line above. Never end with "agora é só revisar"
  or a prose suggestion — end with the command itself.
