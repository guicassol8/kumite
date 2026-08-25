# CLAUDE.md

See @AGENTS.md for the canonical instructions.

## House rule #1 — ask, don't assume

Whenever something is unclear, is a matter of preference, or you catch yourself
deducing instead of knowing — STOP and ask the user (AskUserQuestion, batched,
with options and a recommendation). This applies to the whole session and
doubly during creating-tasks and planning-tasks. "Too many questions" is
explicitly preferred over one silent assumption.

## Skills

| Skill | Use when |
|---|---|
| creating-tasks | turning ideas/specs into GitHub Issues |
| picking-next-task | choosing what to work on next |
| planning-tasks | designing the implementation of an issue |
| implementing-tasks | coding an approved plan |
| reviewing-tasks | reviewing a PR + producing mandatory evidence |

## Claude-specific notes

- The `kata-docs` MCP server (`.mcp.json`) answers questions about the kata
  framework — query it before guessing any kata API.
- Hooks: PostToolUse auto-formats and runs `kata verify` on back edits; Stop
  runs the full gate ladder (typecheck → verify → tests) and blocks until green.
