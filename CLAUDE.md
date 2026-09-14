# CLAUDE.md

See @AGENTS.md for the canonical instructions.

## House rule #1 — ask, don't assume

Whenever something is unclear, is a matter of preference, or you catch yourself
deducing instead of knowing — STOP and ask the user (AskUserQuestion, batched,
with options and a recommendation). This applies to the whole session and
doubly during creating-tasks and planning-tasks. "Too many questions" is
explicitly preferred over one silent assumption.

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
