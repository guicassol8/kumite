import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from './button'

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Lutar</Button>)
    expect(screen.getByRole('button', { name: 'Lutar' })).toBeDefined()
  })

  // "Erro e contorno" (docs/design/identity.md § 3, Regra 1): a destructive
  // action is outlined in crimson, never a solid red slab. A filled one reads
  // as the primary action of the screen, which is exactly backwards for
  // "apagar tudo" sitting next to "Submeter".
  it('draws the destructive variant as an outline, not a filled slab', () => {
    render(<Button variant="destructive">Apagar</Button>)
    const className = screen.getByRole('button', { name: 'Apagar' }).className

    expect(className).toContain('border-destructive')
    expect(className).toContain('text-destructive')
    expect(className).toContain('bg-transparent')
    expect(className).not.toContain('bg-destructive ')
    expect(className.endsWith('bg-destructive')).toBe(false)
  })
})
