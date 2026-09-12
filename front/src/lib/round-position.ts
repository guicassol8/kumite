const ALPHABET_SIZE = 26

/** A, B, C… for the first 26 positions in a round; the 1-based position
 * number past Z, since #220's scoreboard columns need the same rule. */
export function positionLabel(position: number): string {
  if (position < ALPHABET_SIZE) {
    return String.fromCharCode('A'.charCodeAt(0) + position)
  }
  return String(position + 1)
}
