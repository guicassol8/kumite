import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { Footer } from './footer'

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('pt')
})

describe('Footer', () => {
  it('renders the footer container', () => {
    render(<Footer />)

    expect(screen.getByTestId('app-footer')).toBeDefined()
  })

  it('exposes the contact address as a mailto link', () => {
    render(<Footer />)

    const link = screen.getByTestId('footer-contact-email')
    expect(link.getAttribute('href')).toBe('mailto:ligadealgoritmos@gmail.com')
    expect(link.textContent).toBe('ligadealgoritmos@gmail.com')
  })

  it.each([
    ['pt', 'Dúvidas? Fale com a organização:'],
    ['es', '¿Dudas? Habla con la organización:'],
    ['en', 'Questions? Talk to the organizers:'],
  ])('shows the contact label translated in %s, address unchanged', async (language, label) => {
    await i18n.changeLanguage(language)
    render(<Footer />)

    expect(screen.getByTestId('app-footer').textContent).toContain(label)
    expect(screen.getByTestId('footer-contact-email').textContent).toBe(
      'ligadealgoritmos@gmail.com',
    )
  })
})
