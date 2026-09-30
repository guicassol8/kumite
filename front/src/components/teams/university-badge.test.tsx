import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import i18n from '@/i18n'
import { UniversityBadge } from './university-badge'

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('pt')
})

describe('UniversityBadge', () => {
  it('renders the PUCRS textual seal', () => {
    render(<UniversityBadge university="pucrs" />)

    const badge = screen.getByTestId('university-badge-pucrs')
    expect(badge.textContent).not.toContain('🇧🇷')
    expect(badge.textContent).toContain('PUCRS')
  })

  it('renders the Mérida textual seal', () => {
    render(<UniversityBadge university="merida" />)

    const badge = screen.getByTestId('university-badge-merida')
    expect(badge.textContent).not.toContain('🇲🇽')
    expect(badge.textContent).toContain('Mérida')
  })

  // The pódio (#284) projects the seal at a distance: a caller's size must
  // replace the 11px default, not sit next to it and lose the cascade.
  it('lets a caller override the default size through className', () => {
    render(<UniversityBadge university="pucrs" className="text-[20px]" />)

    const classes = screen.getByTestId('university-badge-pucrs').className.split(/\s+/)
    expect(classes).toContain('text-[20px]')
    expect(classes).not.toContain('text-[11px]')
  })

  it('keeps the 11px default without a className', () => {
    render(<UniversityBadge university="pucrs" />)

    expect(screen.getByTestId('university-badge-pucrs').className.split(/\s+/)).toContain(
      'text-[11px]',
    )
  })

  it.each(['pt', 'es', 'en'])('keeps the seal label in %s', async (language) => {
    await i18n.changeLanguage(language)
    render(<UniversityBadge university="merida" />)

    expect(screen.getByTestId('university-badge-merida').textContent).toContain('Mérida')
  })
})
