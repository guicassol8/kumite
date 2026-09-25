import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Alert } from './alert'

afterEach(cleanup)

describe('Alert', () => {
  it('renders the destructive variant as a card with a crimson border, never a filled plate', () => {
    // Identity § 5: an error alert is a card with a crimson border. The
    // variant used to leave the border on the neutral hairline, so every error
    // alert in the app came out crimson-on-grey (#308). This checks the class
    // string because jsdom computes no colours; the computed `border-color`
    // guard runs in a real browser, in e2e/alert-destructive-border.spec.ts.
    const { getByRole } = render(<Alert variant="destructive">Falhou</Alert>)
    const alert = getByRole('alert')
    expect(alert.className).toContain('border-destructive')
    expect(alert.className).toContain('text-destructive')
    expect(alert.className).not.toContain('bg-destructive')
  })

  it('keeps the success variant on its own semantic border', () => {
    const { getByRole } = render(<Alert variant="success">Aprovado</Alert>)
    const alert = getByRole('alert')
    expect(alert.className).toContain('border-success')
    expect(alert.className).not.toContain('border-destructive')
  })
})
