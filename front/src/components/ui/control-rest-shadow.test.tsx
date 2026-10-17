import { cleanup, render, screen } from '@testing-library/react'
import type * as React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { Button } from './button'
import { Checkbox } from './checkbox'
import { Input } from './input'
import { PasswordInput } from './password-input'
import { Select, SelectTrigger, SelectValue } from './select'
import { Switch } from './switch'
import { Textarea } from './textarea'

afterEach(cleanup)

/**
 * `docs/design/identity.md` § 5: "Hairlines de 1 px, sem sombra além do anel de
 * foco". The form controls shipped with shadcn's resting `shadow-xs`; #458 takes
 * it out at the primitive, so every screen loses it at once — and keeps the
 * focus ring and the crimson error ring, which ARE the § 5 exception.
 */

/** The element's classes as tokens, as in `overlay-primitives.test.tsx`. */
function classesOf(element: Element): string[] {
  return [...element.classList]
}

/** Tokens whose utility (after the last variant `:`) is a shadow, e.g. `dark:shadow-xs`. */
function shadowTokens(element: Element): string[] {
  return classesOf(element).filter((token) => {
    const utility = token.slice(token.lastIndexOf(':') + 1)
    return utility.startsWith('shadow-')
  })
}

const FOCUS_RING = ['focus-visible:ring-[3px]', 'focus-visible:ring-ring/50']
const ERROR_RING = ['aria-invalid:border-destructive', 'aria-invalid:ring-destructive/20']

type Case = { name: string; ui: React.ReactNode; hasErrorState: boolean }

const BUTTON_VARIANTS = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const

const cases: Case[] = [
  { name: 'Input', ui: <Input data-testid="c" />, hasErrorState: true },
  { name: 'Textarea', ui: <Textarea data-testid="c" />, hasErrorState: true },
  {
    name: 'PasswordInput',

    ui: <PasswordInput data-testid="c" />,
    hasErrorState: true,
  },
  {
    name: 'SelectTrigger',

    ui: (
      <Select>
        <SelectTrigger data-testid="c">
          <SelectValue placeholder="—" />
        </SelectTrigger>
      </Select>
    ),
    hasErrorState: true,
  },
  { name: 'Checkbox', ui: <Checkbox data-testid="c" />, hasErrorState: true },
  { name: 'Switch', ui: <Switch data-testid="c" />, hasErrorState: false },
  ...BUTTON_VARIANTS.map((variant) => ({
    name: `Button ${variant}`,

    ui: (
      <Button data-testid="c" variant={variant}>
        Ok
      </Button>
    ),
    hasErrorState: true,
  })),
]

describe('form controls carry no resting shadow (identity § 5, #458)', () => {
  it.each(cases)('$name has no shadow-* utility', ({ ui }) => {
    render(ui)
    expect(shadowTokens(screen.getByTestId('c'))).toEqual([])
  })

  it.each(cases)('$name keeps the 3 px focus ring', ({ ui }) => {
    render(ui)
    const classes = classesOf(screen.getByTestId('c'))
    for (const token of FOCUS_RING) expect(classes).toContain(token)
  })

  it.each(cases.filter((c) => c.hasErrorState))(
    '$name keeps the crimson error border and ring',
    ({ ui }) => {
      render(ui)
      const classes = classesOf(screen.getByTestId('c'))
      for (const token of ERROR_RING) expect(classes).toContain(token)
    },
  )
})
