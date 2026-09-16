import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/i18n'

import { PasswordInput } from './password-input'

afterEach(cleanup)

describe('PasswordInput', () => {
  it('starts masked and toggles to visible text and back', () => {
    render(<PasswordInput data-testid="pw" />)

    const input = screen.getByTestId('pw')
    expect(input.getAttribute('type')).toBe('password')

    fireEvent.click(screen.getByTestId('pw-toggle'))
    expect(input.getAttribute('type')).toBe('text')

    fireEvent.click(screen.getByTestId('pw-toggle'))
    expect(input.getAttribute('type')).toBe('password')
  })

  it('does not submit the enclosing form when the toggle is clicked', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput data-testid="pw" />
      </form>,
    )

    fireEvent.click(screen.getByTestId('pw-toggle'))

    expect(onSubmit).not.toHaveBeenCalled()
  })
})

it('forwards invalid state and the error association to the input', () => {
  render(
    <>
      <PasswordInput data-testid="pw" aria-invalid="true" aria-describedby="pw-error" />
      <p id="pw-error">Invalid password</p>
    </>,
  )
  expect(screen.getByTestId('pw').getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByTestId('pw').getAttribute('aria-describedby')).toBe('pw-error')
  expect(screen.getByTestId('pw-toggle').getAttribute('aria-label')).toBeTruthy()
})
