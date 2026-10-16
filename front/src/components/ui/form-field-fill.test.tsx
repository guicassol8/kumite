import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Input } from './input'
import { PasswordInput } from './password-input'
import { Select, SelectTrigger, SelectValue } from './select'
import { Textarea } from './textarea'

afterEach(cleanup)

/** The element's classes as tokens — a substring match would hit `bg-transparent` inside `file:bg-transparent`. */
function classesOf(element: Element): string[] {
  return [...element.classList]
}

/**
 * `docs/design/identity.md` § 3 gives the `card` token to "cards, inputs,
 * tabelas" in both themes, and the components board draws
 * `.input { background: var(--card) }`. #313 moves every form-field primitive
 * from shadcn's `bg-transparent` (+ `dark:bg-input/30`) to `bg-card`.
 * § 3, Regra 1 — "erro é contorno": an invalid field changes only its border,
 * never its fill.
 */
const fields: Array<{ name: string; renderField: (invalid: boolean) => void }> = [
  {
    name: 'Input',
    renderField: (invalid) => render(<Input data-testid="field" aria-invalid={invalid} />),
  },
  {
    name: 'Textarea',
    renderField: (invalid) => render(<Textarea data-testid="field" aria-invalid={invalid} />),
  },
  {
    name: 'PasswordInput',
    renderField: (invalid) => render(<PasswordInput data-testid="field" aria-invalid={invalid} />),
  },
  {
    name: 'SelectTrigger',
    renderField: (invalid) =>
      render(
        <Select>
          <SelectTrigger data-testid="field" aria-invalid={invalid}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
        </Select>,
      ),
  },
]

describe.each(fields)('$name fill follows the identity', ({ renderField }) => {
  it.each([false, true])(
    'uses the card fill, error only on the border (aria-invalid=%s)',
    (invalid) => {
      renderField(invalid)
      const classes = classesOf(screen.getByTestId('field'))

      expect(classes).toContain('bg-card')
      expect(classes).not.toContain('bg-transparent')
      expect(classes).not.toContain('dark:bg-input/30')
      expect(classes).toContain('aria-invalid:border-destructive')
      expect(
        classes.filter(
          (token) =>
            token.startsWith('aria-invalid:bg-') || token.startsWith('dark:aria-invalid:bg-'),
        ),
      ).toEqual([])
    },
  )
})
