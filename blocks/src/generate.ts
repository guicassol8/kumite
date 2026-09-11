import * as Blockly from 'blockly'
import { javascriptGenerator } from 'blockly/javascript'

import { defineKumiteBlocks, ROOT_BLOCK_TYPE } from './blocks'
import { BlocksError } from './errors'
import { type BlockLocale, DEFAULT_LOCALE, messagesFor } from './messages'
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
    return javascriptGenerator.finish(code)
  } finally {
    workspace.dispose()
  }
}
