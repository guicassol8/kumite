---
name: creating-tasks
description: Turns a feature idea or spec into well-formed GitHub Issues with priority, stack and type labels, EARS acceptance criteria and explicit dependencies, clarifying missing requirements. Use when the user wants to create tasks, issues, epics or backlog items. Triggers: "cria task", "criar tasks", "nova task", "cria as issues", "monta o backlog", "abre uma issue", "create tasks", "new issue", "spec this out".
---

# Creating tasks

@docs/task-workflow/creating-tasks.md

## Claude Code specifics

- Use AskUserQuestion for the Step 1 clarifications when needed — batched, with options
  and a recommendation.
- Handoff (MANDATORY): the next step runs in a **fresh chat**, so the very
  last thing you print is the command to paste there — alone in a fenced
  block, nothing after it.

  One issue created, and it is the thing to do now:

  ```
  /planning-tasks #12
  ```

  A backlog or an epic (several issues, no obvious next one):

  ```
  /picking-next-task
  ```

  Always substitute the real number. Never end with "agora é só planejar" or
  a prose suggestion — end with the command itself.
