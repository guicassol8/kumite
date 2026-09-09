// jsdom ships no layout engine, but `Blockly.inject` measures text and boxes
// the moment a workspace mounts. These are the smallest shims that let a REAL
// Blockly workspace be injected under vitest — nothing here fakes Blockly.

// Injecting a workspace also preloads Blockly's four sound files with `fetch`.
// A browser resolves those root-relative URLs against the page origin; the
// global fetch under vitest is Node's, which has no base URL and rejects them
// as ERR_INVALID_URL — dozens of unhandled rejections that fail the run with
// every test still passing. Answer them with empty audio here: no assertion
// depends on a sound decoding, and this keeps the suite off the network.
const realFetch = globalThis.fetch
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
  if (url.startsWith('/blockly-media/')) return Promise.resolve(new Response(new ArrayBuffer(0)))
  return realFetch(input, init)
}) as typeof fetch

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Roughly monospace metrics: enough for Blockly's renderer to lay blocks out
// with non-zero sizes, which is all the assertions depend on.
const CHAR_WIDTH = 8
const LINE_HEIGHT = 16

function textLength(node: SVGElement): number {
  return (node.textContent?.length ?? 0) * CHAR_WIDTH
}

const svgProto = SVGElement.prototype as unknown as Record<string, unknown>

svgProto.getBBox = function getBBox(this: SVGElement) {
  return { x: 0, y: 0, width: textLength(this), height: LINE_HEIGHT }
}
svgProto.getComputedTextLength = function getComputedTextLength(this: SVGElement) {
  return textLength(this)
}
svgProto.getExtentOfChar = function getExtentOfChar() {
  return { x: 0, y: 0, width: CHAR_WIDTH, height: LINE_HEIGHT }
}
svgProto.getScreenCTM = function getScreenCTM() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
}

HTMLCanvasElement.prototype.getContext = function getContext() {
  return {
    font: '',
    measureText: (text: string) => ({ width: text.length * CHAR_WIDTH }),
  }
} as unknown as HTMLCanvasElement['getContext']
