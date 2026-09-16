import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { AuthLayout } from './auth-layout'

afterEach(cleanup)

it('composes the form and navigation without replacing root landmarks', () => {
  render(
    <AuthLayout
      title="Entrar"
      description="Description"
      navigation={<a href="/signup">Cadastro</a>}
    >
      <form aria-label="Login" />
    </AuthLayout>,
  )
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Entrar')
  expect(screen.getByText('Description')).toBeDefined()
  expect(screen.getByRole('form')).toBeDefined()
  expect(screen.getByRole('link').getAttribute('href')).toBe('/signup')
  expect(screen.queryByRole('banner')).toBeNull()
  expect(screen.queryByRole('contentinfo')).toBeNull()
})

it('accepts an optional poster alongside the form', () => {
  render(
    <AuthLayout title="Entrar" poster={<aside data-testid="poster">Poster</aside>}>
      Form
    </AuthLayout>,
  )
  expect(screen.getByTestId('poster')).toBeDefined()
  expect(screen.getByText('Form')).toBeDefined()
})
