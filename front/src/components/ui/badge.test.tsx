import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Badge } from './badge'

describe('Badge', () => {
  it('renders the brand variant as a solid fill with white text', () => {
    const { getByText } = render(<Badge variant="brand">Seu time</Badge>)
    const badge = getByText('Seu time')
    expect(badge.className).toContain('bg-brand')
    expect(badge.className).toContain('text-white')
  })
})
