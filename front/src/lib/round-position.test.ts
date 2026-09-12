import { describe, expect, it } from 'vitest'

import { positionLabel } from './round-position'

describe('positionLabel', () => {
  it('labels the first position A', () => {
    expect(positionLabel(0)).toBe('A')
  })

  it('labels the third position C', () => {
    expect(positionLabel(2)).toBe('C')
  })

  it('labels the 26th position Z', () => {
    expect(positionLabel(25)).toBe('Z')
  })

  it('falls back to the 1-based position number past Z', () => {
    expect(positionLabel(26)).toBe('27')
  })

  it('keeps using the 1-based position number further past Z', () => {
    expect(positionLabel(40)).toBe('41')
  })
})
