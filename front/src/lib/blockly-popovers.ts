import * as Blockly from 'blockly'

/**
 * Blockly's popovers on <body> instead of inside the canvas (#367).
 *
 * With no container set, Blockly ≥ 12 hangs the WidgetDiv (context menus,
 * inline editors), the DropDownDiv (field dropdowns) and the tooltip inside
 * the main workspace's `.injectionDiv` — which its own CSS gives
 * `overflow: hidden`, inside panels that clip too — while it positions them
 * against the *window*. A menu that fit the window below a block near the
 * bottom of the canvas was drawn there and cut at the canvas edge. On <body>
 * nothing but the viewport clips them, which is what their positioning
 * already measures, and they paint above the page like any overlay.
 *
 * Moving them is not enough on its own in Blockly 13 (13.3.0 and main
 * alike): `setMainWorkspace` keeps pointing the popover *focus* root at the
 * injectionDiv, and a popover closes when focus leaves that root for
 * somewhere outside it. With the popovers outside it, that goes wrong both
 * ways, and the two listeners below put it back:
 *
 * - focus moving from the canvas into a popover read as a loss, and a field
 *   dropdown (which starts listening before it takes the focus) closed as it
 *   opened — `keepCanvasFocusIntoPopovers`;
 * - focus leaving a popover for the page went unseen, where it used to close
 *   it — `forwardPopoverFocusLoss`, which replays it on the root for
 *   Blockly's own handler, so the popover closes exactly as it did when it
 *   lived in the canvas.
 */

const POPOVERS = '.blocklyWidgetDiv, .blocklyDropDownDiv'

function inPopover(node: EventTarget | null): boolean {
  return node instanceof Element && node.closest(POPOVERS) !== null
}

/** Where Blockly listens for its popovers losing focus: the main workspace's injectionDiv. */
function popoverFocusRoot(): HTMLElement | null {
  const main = Blockly.common.getMainWorkspace() as Blockly.WorkspaceSvg | undefined
  return main?.rendered ? main.getInjectionDiv() : null
}

function forwardPopoverFocusLoss(event: FocusEvent) {
  if (!inPopover(event.target) || inPopover(event.relatedTarget)) return
  const root = popoverFocusRoot()
  const to = event.relatedTarget
  if (!root || (to instanceof Node && root.contains(to))) return
  // Not bubbling: only the root's own listener — Blockly's — hears it.
  root.dispatchEvent(new FocusEvent('focusout', { relatedTarget: to }))
}

let installed = false

/**
 * Sets <body> as Blockly's popover container and starts forwarding focus
 * leaving a popover. Once per page, before the first `Blockly.inject` —
 * which is why `blockly-workspace.tsx`, the one place the app injects,
 * calls it at module load.
 */
export function installBodyPopovers(): void {
  if (installed) return
  installed = true
  Blockly.common.setParentContainer(document.body)
  document.addEventListener('focusout', forwardPopoverFocusLoss, true)
}

/**
 * Keeps focus moving from this canvas into a popover from reaching Blockly's
 * focus-loss listener on the injectionDiv. `host` is the element Blockly was
 * injected into: its capture phase runs before the injectionDiv's listener.
 * Returns the cleanup.
 */
export function keepCanvasFocusIntoPopovers(host: HTMLElement): () => void {
  const listener = (event: FocusEvent) => {
    if (inPopover(event.relatedTarget)) event.stopPropagation()
  }
  host.addEventListener('focusout', listener, true)
  return () => host.removeEventListener('focusout', listener, true)
}
