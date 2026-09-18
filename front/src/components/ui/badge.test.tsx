import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Badge } from './badge'

afterEach(cleanup)

describe('Badge', () => {
  it('renders the brand variant as a solid fill with white text', () => {
    const { getByText } = render(<Badge variant="brand">Seu time</Badge>)
    const badge = getByText('Seu time')
    expect(badge.className).toContain('bg-brand')
    expect(badge.className).toContain('text-white')
  })

  it('renders the destructive variant as a crimson outline, never a filled plate', () => {
    // Identity § 3 makes error an outline and § 5 lists "Difícil" among the
    // outlined difficulty badges. #216 did this to the button; the badge was
    // left behind by the epic.
    const { getByText } = render(<Badge variant="destructive">Difícil</Badge>)
    const badge = getByText('Difícil')
    expect(badge.className).toContain('border-destructive')
    expect(badge.className).toContain('text-destructive')
    expect(badge.className).toContain('bg-transparent')
    expect(badge.className).not.toContain('bg-destructive')
    expect(badge.className).not.toContain('text-white')
  })

  it('keeps the outlined difficulty trio distinct', () => {
    const { getByText: easy } = render(<Badge variant="success">Fácil</Badge>)
    expect(easy('Fácil').className).toContain('text-success')
    const { getByText: medium } = render(<Badge variant="warning">Médio</Badge>)
    // --warning is 2,0:1 and may never carry text; --warning-text is the
    // readable amber.
    expect(medium('Médio').className).toContain('text-warning-text')
  })
})
