---
name: implementing-tasks
description: Implements an approved GitHub Issue plan on a task branch with TDD, runs every gate, and opens a PR linked to the issue. Triggers: "implementa a #N", "bora implementar", "codar a task", "faz a task", "implement #N", "work on #N", "build it".
---

# Implementing a task

@docs/task-workflow/implementing-tasks.md

## Claude Code specifics

- Prefer EnterWorktree over the manual worktree commands in Preconditions —
  but EnterWorktree branches from `origin/main`, and this repo integrates on
  `develop`. Right after entering, with a clean tree:
  `git fetch origin && git reset --hard origin/develop`, then rename the
  branch to `task/<N>-<slug>` (`git branch -m`). Skipping this bases the
  task on the last release instead of on develop.
- Use AskUserQuestion for missing decisions under the House rules.
- Gates (`CLAUDE.md` § Claude-specific notes): PostToolUse verifies each
  edit, Stop runs the ladder on uncommitted changes, and the pre-push runs
  it on every push that carries code — run `git push` in the foreground
  with `timeout: 600000`.
- Handoff (MANDATORY): the review runs in a **fresh chat**, so the very last
  thing you print is the command to paste there — alone in a fenced block,
  nothing after it:

  ```
  /reviewing-tasks #34
  ```

  That number is the **PR**, not the issue — print the PR number you just
  opened, and its URL in the line above. Never end with "agora é só revisar"
  or a prose suggestion — end with the command itself.
