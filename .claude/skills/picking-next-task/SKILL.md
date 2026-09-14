---
name: picking-next-task
description: Selects the next GitHub Issue to work on — open, unblocked, highest priority, most unblocking, and the most isolated from other open work. Use when the user asks what to do next or wants the next task. Triggers: "próxima task", "o que fazer agora", "pega a próxima", "qual a próxima", "next task", "what's next", "ready work".
---

# Picking the next task

@docs/task-workflow/picking-next-task.md

## Claude Code specifics

Handoff (MANDATORY): the next step runs in a **fresh chat**, so the very last
thing you print is the command to paste there — alone in a fenced block,
nothing after it:

```
/planning-tasks #12
```

Substitute the real number of the confirmed pick. Never end with a prose
suggestion — end with the command itself.
