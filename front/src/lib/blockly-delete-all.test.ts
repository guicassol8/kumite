import * as Blockly from 'blockly'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deletableBlocks,
  deleteAllDeletable,
  installDeleteAllConfirm,
  setDeleteAllHandler,
} from '@/lib/blockly-delete-all'

const ITEM_ID = 'workspaceDelete'

let host: HTMLDivElement
let workspace: Blockly.WorkspaceSvg
let confirm: ReturnType<typeof vi.fn<typeof Blockly.dialog.confirm>>

// A root that cannot be deleted (the editor's "resolver") holding three
// deletable blocks: a number in its input, and a print with its text.
const rootWithChildren = {
  type: 'controls_repeat_ext',
  id: 'root',
  x: 20,
  y: 20,
  inputs: {
    TIMES: { block: { type: 'math_number', id: 'times', fields: { NUM: 3 } } },
    DO: {
      block: {
        type: 'text_print',
        id: 'print',
        inputs: { TEXT: { block: { type: 'text', id: 'text', fields: { TEXT: 'oi' } } } },
      },
    },
  },
}

function seed(...blocks: object[]) {
  Blockly.serialization.workspaces.load(
    { blocks: { languageVersion: 0, blocks: blocks } },
    workspace,
  )
  workspace.getBlockById('root')?.setDeletable(false)
}

type ActionItem = Exclude<Blockly.ContextMenuRegistry.RegistryItem, { separator: true }>

function item(): ActionItem {
  const found = Blockly.ContextMenuRegistry.registry.getItem(ITEM_ID)
  if (!found || found.separator) throw new Error('workspaceDelete is not registered')
  return found
}

// What the context menu does on a click on "Delete N blocks".
function choose() {
  item().callback(
    { workspace } as Blockly.ContextMenuRegistry.Scope,
    new Event('contextmenu'),
    new Event('click'),
    new Blockly.utils.Coordinate(0, 0),
  )
}

const ids = () =>
  workspace
    .getAllBlocks(false)
    .map((block) => block.id)
    .sort()

// Blockly queues its events and fires them (and fills the undo stack) on a
// macrotask.
const flushEvents = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  installDeleteAllConfirm()
  host = document.createElement('div')
  document.body.appendChild(host)
  workspace = Blockly.inject(host, { media: '/blockly-media/', trashcan: false })
  confirm = vi.fn<typeof Blockly.dialog.confirm>()
  Blockly.dialog.setConfirm(confirm)
})

afterEach(() => {
  // No argument: back to Blockly's own confirm.
  Blockly.dialog.setConfirm()
  workspace.dispose()
  host.remove()
  vi.useRealTimers()
})

describe('installDeleteAllConfirm (#445)', () => {
  it('keeps the item where Blockly put it, and installs it only once', () => {
    const before = item()
    installDeleteAllConfirm()

    const after = item()
    expect(after).toBe(before)
    expect(after.id).toBe(ITEM_ID)
    expect(after.weight).toBe(6)
    expect(after.scopeType).toBe(Blockly.ContextMenuRegistry.ScopeType.WORKSPACE)
  })

  it("hands two or more deletable blocks to the workspace's handler, deleting nothing", () => {
    seed(rootWithChildren)
    const handler = vi.fn()
    setDeleteAllHandler(workspace, handler)

    choose()

    expect(handler).toHaveBeenCalledExactlyOnceWith({ workspace, blocks: 3 })
    expect(confirm).not.toHaveBeenCalled()
    expect(ids()).toEqual(['print', 'root', 'text', 'times'])
  })

  it('deletes a lone deletable block at once, with no question, like Blockly', () => {
    vi.useFakeTimers()
    seed({ type: 'math_number', id: 'lone', x: 20, y: 20 })
    const handler = vi.fn()
    setDeleteAllHandler(workspace, handler)

    choose()
    vi.runAllTimers()

    expect(handler).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    expect(ids()).toEqual([])
  })

  it("falls back to Blockly's confirm on a workspace with no handler", () => {
    seed(rootWithChildren)

    choose()

    expect(confirm).toHaveBeenCalledOnce()
    expect(ids()).toEqual(['print', 'root', 'text', 'times'])
  })
})

describe('deletableBlocks (#445)', () => {
  it("counts what Blockly's menu item counts: everything but the root", () => {
    seed(rootWithChildren, { type: 'math_number', id: 'loose', x: 300, y: 20 })

    expect(
      deletableBlocks(workspace)
        .map((block) => block.id)
        .sort(),
    ).toEqual(['loose', 'print', 'text', 'times'])
  })
})

describe('deleteAllDeletable (#445)', () => {
  it('keeps only the root, and one undo brings every block back', async () => {
    seed(rootWithChildren, { type: 'math_number', id: 'loose', x: 300, y: 20 })
    await flushEvents()
    workspace.clearUndo()

    deleteAllDeletable(workspace)
    await flushEvents()

    expect(ids()).toEqual(['root'])

    workspace.undo(false)
    await flushEvents()

    expect(ids()).toEqual(['loose', 'print', 'root', 'text', 'times'])
  })
})
