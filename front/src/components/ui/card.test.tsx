import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Card } from './card'

afterEach(cleanup)

/** Tokens whose utility (after the last variant `:`) is a shadow, as in `control-rest-shadow.test.tsx`. */
function shadowTokens(element: Element): string[] {
  return [...element.classList].filter((token) => {
    const utility = token.slice(token.lastIndexOf(':') + 1)
    return utility.startsWith('shadow-')
  })
}

/**
 * `docs/design/identity.md` § 5: "Hairlines de 1 px, sem sombra além do anel de
 * foco", and the board draws `.card` without one (`common.py:92`). The `Card`
 * shipped with shadcn's `shadow-sm`; #467 takes it out at the primitive, so the
 * six screens that cancelled it case by case no longer need to.
 */
describe('Card carries no drop shadow', () => {
  it('has no shadow class', () => {
    render(<Card data-testid="c" />)
    expect(shadowTokens(screen.getByTestId('c'))).toEqual([])
  })

  it('keeps the hairline that separates it from the page', () => {
    render(<Card data-testid="c" />)
    const classes = [...screen.getByTestId('c').classList]
    expect(classes).toEqual(expect.arrayContaining(['border', 'bg-card', 'rounded-xl']))
  })
})
