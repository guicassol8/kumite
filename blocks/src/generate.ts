import * as Blockly from 'blockly'
import { javascriptGenerator } from 'blockly/javascript'

import { defineKumiteBlocks, ROOT_BLOCK_TYPE } from './blocks'
import { SOLUTION_FUNCTION_NAME, SOLUTION_PARAM_NAME } from './contract'
import { deniedFieldValues } from './denied'
import { BlocksError } from './errors'
import { type BlockLocale, type BlockMessages, DEFAULT_LOCALE, messagesFor } from './messages'
import { allowedBlockTypes, type WorkspaceState } from './toolbox'

/**
 * The line terminators JS honours that are *not* `\n`. Blockly copies comment
 * text verbatim into `// ...` lines, so any of these ends the comment and
 * promotes the rest of the text to real code — the allowlist never sees it,
 * because it only inspects `block.type` (#181, finding #14).
 *
 * `\n` is deliberately absent: Blockly's own `prefixLines` already splits on it
 * and prefixes every resulting line with `// `, so a multi-line comment stays a
 * comment.
 */
const COMMENT_LINE_TERMINATORS = new RegExp(`[${String.fromCharCode(0x0d, 0x2028, 0x2029)}]`, 'g')

/**
 * The exact line the root block's generator emits. Anchored to the start of a
 * line, which is what makes the check worth anything: every comment is a
 * `// ...` line by the time this runs, so no text a participant typed can
 * satisfy it.
 */
const SOLVE_SIGNATURE = new RegExp(
  `^function ${SOLUTION_FUNCTION_NAME}\\(${SOLUTION_PARAM_NAME}\\) \\{$`,
  'm',
)

/**
 * Rewrites every block comment so it cannot break out of its `// ` prefix.
 * Neutralizing, not stripping: the participant keeps their comment, it just
 * becomes one line.
 *
 * Mutates blocks of the throwaway workspace `generateSolution` builds and
 * disposes, so nothing here reaches the participant's saved state.
 */
function neutralizeCommentTerminators(blocks: Blockly.Block[]): void {
  for (const block of blocks) {
    const text = block.getCommentText()
    if (text === null) continue
    const safe = text.replace(COMMENT_LINE_TERMINATORS, ' ')
    if (safe !== text) block.setCommentText(safe)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Refuses a workspace that still carries one of the dropdown values the
 * curated toolbox subtracts (`deniedFieldValues`) — today, the `RANDOM` mode
 * of `lists_getIndex`, whose generated code draws a different item on every
 * run (#182).
 *
 * Reads the **serialized state**, not the loaded workspace, and that is the
 * whole trick: with the option gone from the dropdown, Blockly loads
 * `WHERE: "RANDOM"` as the field's default without a word, so a workspace
 * inspected after loading would never show it. Only the raw state still has
 * it, and the raw state is what a direct POST to the API sends.
 *
 * The walk is defensive — anything that is not an object is skipped. A truly
 * malformed state was already refused by `malformed-workspace` on load, which
 * gives the participant a better message than this one would.
 */
function assertNoDeniedFieldValues(state: WorkspaceState, messages: BlockMessages): void {
  function visit(node: unknown): void {
    if (!isRecord(node)) return

    const type = node.type
    const denied = typeof type === 'string' ? deniedFieldValues[type] : undefined
    if (denied && isRecord(node.fields)) {
      const fields = node.fields
      for (const [name, values] of Object.entries(denied)) {
        const value = fields[name]
        if (typeof value === 'string' && values.includes(value)) {
          throw new BlocksError(
            'field-value-not-allowed',
            messages.errorFieldValueNotAllowed.replace('{type}', type as string),
            { blockType: type as string },
          )
        }
      }
    }

    if (isRecord(node.inputs)) {
      for (const input of Object.values(node.inputs)) {
        if (!isRecord(input)) continue
        visit(input.block)
        visit(input.shadow)
      }
    }
    if (isRecord(node.next)) {
      visit(node.next.block)
      visit(node.next.shadow)
    }
  }

  const container = (state as Record<string, unknown>).blocks
  if (!isRecord(container) || !Array.isArray(container.blocks)) return
  for (const block of container.blocks) visit(block)
}

/**
 * Proves the emitted source is a *callable* `solve`, not just text that reads
 * like one. The signature check above matches characters; this one asks the
 * engine, which is the only thing that settles it.
 *
 * `new Function` compiles the body and stops there — nothing the participant
 * wrote executes here, on the judge's process or in the editor. It is the
 * cheap way to hold the line without an AST parser or a new dependency.
 *
 * The vector that made this necessary: Blockly's `quote_` escapes `\`, `\n`
 * and `'`, but not U+000D, which JS honours as a line terminator. A text field
 * carrying one emits `return 'a<CR>b';` — signature intact, `SyntaxError` on
 * instantiation, every case back as a runtime error with no cause named.
 */
function assertParses(source: string, message: string): void {
  try {
    new Function(source)
  } catch (cause) {
    throw new BlocksError('invalid-generated-code', message, { cause })
  }
}

/**
 * Turns a serialized workspace into the JS source of `solve(input)`.
 *
 * Runs headless, so it is the same call on the editor and on the judge. The
 * validation is the trust boundary: a workspace arriving from a client is only
 * generated once it holds exactly one root and nothing outside the curated
 * allowlist.
 *
 * Variable declarations land above `solve`, so a caller that needs runs to be
 * independent instantiates the source once per run — that is #20's job.
 */
export function generateSolution(
  state: WorkspaceState,
  locale: BlockLocale = DEFAULT_LOCALE,
): string {
  defineKumiteBlocks(locale)
  const messages = messagesFor(locale)
  const workspace = new Blockly.Workspace()

  try {
    try {
      Blockly.serialization.workspaces.load(state, workspace)
    } catch (cause) {
      throw new BlocksError('malformed-workspace', messages.errorMalformedWorkspace, { cause })
    }

    const blocks = workspace.getAllBlocks(false)
    const roots = blocks.filter((block) => block.type === ROOT_BLOCK_TYPE)
    if (roots.length === 0) {
      throw new BlocksError('missing-root', messages.errorMissingRoot)
    }
    if (roots.length > 1) {
      throw new BlocksError('duplicate-root', messages.errorDuplicateRoot)
    }

    for (const block of blocks) {
      if (!allowedBlockTypes.includes(block.type)) {
        throw new BlocksError(
          'block-not-allowed',
          messages.errorBlockNotAllowed.replace('{type}', block.type),
          { blockType: block.type },
        )
      }
    }

    assertNoDeniedFieldValues(state, messages)

    neutralizeCommentTerminators(blocks)

    const root = roots[0] as Blockly.Block

    // A disabled block generates nothing at all, so the root being off used to
    // come back as a successful `"\n\n\n"` — no `solve`, every case failing
    // with `solve is not defined` and no hint why (#181, finding #15).
    // `getDescendants` includes the root itself, so one call covers the root
    // and everything hanging off it. Blocks loose on the canvas stay out of
    // scope: Blockly disables some of them on its own, and `thisOnly` below
    // already keeps them out of the generated source.
    if (root.getDescendants(false).some((block) => !block.isEnabled())) {
      throw new BlocksError('disabled-block', messages.errorDisabledBlock)
    }

    javascriptGenerator.init(workspace)
    // `thisOnly` keeps generation anchored on the root: a stray top-level block
    // never leaks code into the solution.
    const generated = javascriptGenerator.blockToCode(root, true)
    const code = typeof generated === 'string' ? generated : generated[0]
    const source = javascriptGenerator.finish(code)

    // Last line of defence: a "successful" generation must actually define the
    // function the contract promises. With the guard above in place this is
    // unreachable through any known path — it exists for the next empty-success
    // path nobody saw coming, so that it surfaces as a refusal instead of as
    // `solve is not defined` on every case.
    if (!SOLVE_SIGNATURE.test(source)) {
      throw new BlocksError('invalid-generated-code', messages.errorInvalidGeneratedCode)
    }
    assertParses(source, messages.errorInvalidGeneratedCode)
    return source
  } finally {
    workspace.dispose()
  }
}
