import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { LanguageSelector } from './language-selector'

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('pt')
})

describe('LanguageSelector', () => {
  it('renders the three language options', () => {
    render(<LanguageSelector />)

    expect(screen.getByTestId('language-selector')).toBeDefined()
    expect(screen.getByTestId('language-option-pt')).toBeDefined()
    expect(screen.getByTestId('language-option-es')).toBeDefined()
    expect(screen.getByTestId('language-option-en')).toBeDefined()
  })

  it('marks the active language as current', async () => {
    await i18n.changeLanguage('pt')
    render(<LanguageSelector />)

    expect(screen.getByTestId('language-option-pt').getAttribute('aria-current')).toBe('true')
    expect(screen.getByTestId('language-option-es').getAttribute('aria-current')).toBe('false')
    expect(screen.getByTestId('language-option-en').getAttribute('aria-current')).toBe('false')
  })

  it('switches the active language on click', () => {
    render(<LanguageSelector />)

    fireEvent.click(screen.getByTestId('language-option-es'))

    expect(i18n.language).toBe('es')
    expect(screen.getByTestId('language-option-es').getAttribute('aria-current')).toBe('true')
    expect(screen.getByTestId('language-option-pt').getAttribute('aria-current')).toBe('false')
  })

  it('gives each option its own autonym as an accessible label, regardless of active language', async () => {
    await i18n.changeLanguage('en')
    render(<LanguageSelector />)

    expect(screen.getByTestId('language-option-pt').getAttribute('aria-label')).toBe('Português')
    expect(screen.getByTestId('language-option-es').getAttribute('aria-label')).toBe('Español')
    expect(screen.getByTestId('language-option-en').getAttribute('aria-label')).toBe('English')
  })
})
