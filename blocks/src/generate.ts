import * as Blockly from 'blockly'
import { javascriptGenerator } from 'blockly/javascript'

import { defineKumiteBlocks, ROOT_BLOCK_TYPE } from './blocks'
import { BlocksError } from './errors'
import { type BlockLocale, DEFAULT_LOCALE, messagesFor } from './messages'
import { allowedBlockTypes, type WorkspaceState } from './toolbox'

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

    const root = roots[0] as Blockly.Block
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
