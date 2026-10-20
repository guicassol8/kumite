// Blockly queues its events and fires them (filling the undo stack and calling
// the change listeners) from `fireInternal` in `core/events/utils.ts`, which
// schedules `requestAnimationFrame(() => setTimeout(fireNow, 0))`. Under
// vitest, jsdom runs requestAnimationFrame on its own ~16 ms interval, so a
// bare `setTimeout(0)` only lands after that fire when the frame happens to
// come first — under load it does not (#477). `fireNow` itself is not public.
//
// Waiting one frame and then a `setTimeout(0)` is deterministic: jsdom runs
// frame callbacks in the order they were registered, and the two
// `setTimeout(0)` land in Node's timer list in FIFO order; if Blockly's frame
// already ran, ours is a later frame, after its `fireNow`.
//
// A plain Promise: a test that renders React wraps it in `act`. It does not
// work under `vi.useFakeTimers()` (the frame and the timeout never run).
export function flushBlocklyEvents(): Promise<void> {
  return new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
}
