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
// has to wait for it. Like jsdom's, the frame runs every callback registered
// before it in one go, in order, so a flush that resolves inside the frame
// (without the setTimeout(0) after it) also lands before Blockly's fire.
it('waits until the events Blockly queued have fired', async () => {
  let frame: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    if (frame.length === 0) {
      window.setTimeout(() => {
        const due = frame
        frame = []
        for (const run of due) run(performance.now())
      }, 50)
    }
    frame.push(callback)
    return frame.length
  })
  const fired: string[] = []
  workspace.addChangeListener((event) => fired.push(event.type))

  Blockly.serialization.blocks.append({ type: 'math_number', id: 'n' }, workspace)
  await flushBlocklyEvents()

  expect(fired).toContain(Blockly.Events.BLOCK_CREATE)
})
