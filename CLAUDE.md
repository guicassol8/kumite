# CLAUDE.md

See @AGENTS.md for the canonical instructions.

## Clarification

Reuse the user's prior answers and authorization. Ask focused questions
(AskUserQuestion, batched, with options where useful) for missing product
decisions or constraints that materially affect the task. Resolve routine
implementation details from repository conventions and code evidence; state
material assumptions. A complete request does not need another question round.

## Skills

These are Claude Code's slash-command shortcut over the agent-agnostic
process in `docs/task-workflow/` (see `AGENTS.md` § Map) — use them when
running inside Claude Code; the docs are the source of truth.

| Skill | Use when |
|---|---|
| creating-tasks | turning ideas/specs into GitHub Issues |
| picking-next-task | choosing what to work on next |
| planning-tasks | designing the implementation of an issue |
| implementing-tasks | coding an approved plan |
| reviewing-tasks | reviewing a PR + producing mandatory evidence |

Each step is its own chat: every skill ends by printing the next step's command,
ready to paste into a new session. The full chain is in `docs/workflow.md`
§ One step, one session.

## Claude-specific notes

- The `kata-docs` MCP server (`.mcp.json`) answers questions about the kata
  framework — query it before guessing any kata API.
- Any task touching kata (kata-docs MCP, `kata verify`, hurl, DI/JWT/error
  surfaces)? Attempt a report in `kata-feedback/` at the repo root — bugs,
  gaps, improvement ideas, plain observations, and metrics (tokens/turns
  spent on kata-docs lookups, whether they paid off) all count, no fix
  required. See `AGENTS.md` § Kata framework feedback. Never fix kata itself
  as a side effect of a kumite task.
- Hooks: PostToolUse auto-formats and runs `kata verify` on back edits; Stop
  runs the full gate ladder (typecheck → verify → tests) and blocks until green.
- Worktrees: prefer the harness's own isolation — `EnterWorktree` for this
  session's task work, `isolation: "worktree"` when spawning subagents that
  edit files. Manual fallback:
  `git worktree add .worktrees/task-<N>-<slug> -b task/<N>-<slug> develop`
  then `pnpm install` inside it (node_modules are not shared).
