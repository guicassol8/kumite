# @kumite/blocks — agent instructions

Shared Blockly layer: the root block, the curated toolbox and the JS
generators, consumed by `front/` (editor, browser) and `back/` (judge codegen,
Node headless). The one sanctioned runtime cross-package dependency
(approved 2026-08-25, #16).

## Rules

- **Block definitions and the toolbox live ONLY here.** Never redefine a custom
  block or rebuild the toolbox inside `front/` or `back/`.
- **Always `import * as Blockly from 'blockly'` — never `blockly/core`.** Under
  the `node` export condition the subpath resolves to CJS whose namespace import
  does not expose the named exports (`Blockly.common` comes back `undefined`).
  The failure is silent and only shows up headless.
- **One Blockly instance.** `blockly` is a `peerDependency` here and a real
  dependency of the consumers, so pnpm hoists a single copy. A peer warning from
  `pnpm install` is a real failure — two instances mean the generators register
  on a `javascriptGenerator` the editor never reads.
- **No build step.** `exports` points straight at `./src/index.ts`, same as
  `@kumite/back`; consumers compile the TS themselves.
- **Every user-visible string goes in `src/messages.ts`, in all three locales.**
  The parity test fails otherwise. The generated code, in contrast, is fixed:
  `solve(input)` regardless of locale.
- Tests run in Node (`environment: 'node'`) on purpose — a jsdom crutch here
  would hide a breakage that only the back would hit.

## Layout

| File | Holds |
|---|---|
| `src/contract.ts` | `solve` / `input` — the only import-free module, so a Web Worker can take it via `@kumite/blocks/contract` without dragging Blockly along |
| `src/messages.ts` | pt/es/en labels, category names, error texts |
| `src/blocks.ts` | `kumite_solve` / `kumite_input` + their JS generators |
| `src/toolbox.ts` | curated categories, derived `allowedBlockTypes`, empty workspace |
| `src/errors.ts` | `BlocksError` and its discriminating `code` |
| `src/generate.ts` | `generateSolution` — validate, then emit `solve(input)` |
| `src/fixtures/` | canonical workspaces shared with the front and the judge |
