import * as Blockly from 'blockly'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { flushBlocklyEvents } from '@/test/blockly-events'

let host: HTMLDivElement
let workspace: Blockly.WorkspaceSvg

beforeEach(async () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  workspace = Blockly.inject(host, { media: '/blockly-media/', trashcan: false })
  // Whatever the injection queued fires here, so the queue starts empty.
  await flushBlocklyEvents()
})

afterEach(() => {
  vi.restoreAllMocks()
  workspace.dispose()
  host.remove()
})

// #477: jsdom's requestAnimationFrame is its own ~16 ms interval, so under
// load a frame can land after a bare setTimeout(0). A slow frame makes that
// ordering deterministic: Blockly's next fire goes through it, and the flush
// has to wait for it.
it('waits until the events Blockly queued have fired', async () => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
    window.setTimeout(() => callback(performance.now()), 50),
  )
  const fired: string[] = []
  workspace.addChangeListener((event) => fired.push(event.type))

  Blockly.serialization.blocks.append({ type: 'math_number', id: 'n' }, workspace)
  await flushBlocklyEvents()

  expect(fired).toContain(Blockly.Events.BLOCK_CREATE)
})
