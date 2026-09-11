import type { WorkspaceState } from '../toolbox'

// Built from code points rather than written literally: CARRIAGE RETURN, LINE
// SEPARATOR (U+2028) and PARAGRAPH SEPARATOR (U+2029) are invisible in an
// editor and some tools normalize them away on save — and their presence is
// the whole point of the fixture.
const CR = String.fromCharCode(0x0d)
const LINE_SEPARATOR = String.fromCharCode(0x2028)
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029)

/**
 * Adversarial fixture for #181 (finding #14): a block comment carrying the line
 * terminators JS honours beyond `\n`.
 *
 * Blockly copies comment text verbatim into `// ...` lines, so each of those
 * characters ended the comment and promoted whatever followed it to real code,
 * sitting *above* `solve` in module scope. The allowlist never saw it: it only
 * inspects `block.type`.
 *
 * The text is deliberately short. Past Blockly's comment wrap width (~57
 * characters) `stringUtils.wrap` re-flows the text and flattens these
 * separators into spaces on its own — so a long comment is *not* the vulnerable
 * shape, and a fixture built from one would pass without the fix.
 *
 * The payload is `throw` rather than an assignment: if any of it escapes the
 * comment, instantiating the source throws instead of quietly polluting the
 * global object, and the test says so.
 */
export const comentarioComQuebra: WorkspaceState = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'kumite_solve',
        id: 'raiz',
        x: 40,
        y: 40,
        icons: {
          comment: {
            text: `sol${CR}throw 1${LINE_SEPARATOR}throw 2${PARAGRAPH_SEPARATOR}throw 3`,
            pinned: false,
            height: 80,
            width: 160,
          },
        },
        inputs: {
          RETURN: { block: { type: 'math_number', id: 'resposta', fields: { NUM: 7 } } },
        },
      },
    ],
  },
}
