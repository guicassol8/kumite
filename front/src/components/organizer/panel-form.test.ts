import { describe, expect, it } from 'vitest'

import {
  PANEL_BRAND_BUTTON,
  PANEL_DIALOG_TITLE,
  PANEL_FIELD_ERROR,
  PANEL_FIELD_LABEL,
  PANEL_FORM_HEADING,
  PANEL_MONO,
  PANEL_SECTION_TITLE,
  PANEL_SEG_LIST,
  PANEL_SEG_TRIGGER,
} from './panel-form'

/**
 * Contract test: the numbers the #233 acceptance criteria name out loud live in
 * exactly one place, so a later restyle cannot silently drift off them.
 */
describe('panel form class tokens', () => {
  it('labels are 13/500 (Acceptance: "rótulos em 13/500")', () => {
    expect(PANEL_FIELD_LABEL).toContain('text-[13px]')
    expect(PANEL_FIELD_LABEL).toContain('font-medium')
  })

  it('field errors are crimson text at 13 px, with no red fill', () => {
    expect(PANEL_FIELD_ERROR).toContain('text-[13px]')
    expect(PANEL_FIELD_ERROR).toContain('text-destructive')
    expect(PANEL_FIELD_ERROR).not.toContain('bg-destructive')
  })

  it('the brand button fills with --brand, not with --primary', () => {
    expect(PANEL_BRAND_BUTTON).toContain('bg-brand')
    expect(PANEL_BRAND_BUTTON).not.toContain('bg-primary')
  })

  it('headings and dialog titles use the display face', () => {
    expect(PANEL_FORM_HEADING).toContain('font-display')
    expect(PANEL_FORM_HEADING).toContain('uppercase')
    expect(PANEL_DIALOG_TITLE).toContain('font-display')
    expect(PANEL_SECTION_TITLE).toContain('font-display')
    expect(PANEL_SECTION_TITLE).toContain('uppercase')
  })

  it('mono fields are JetBrains Mono 13/20', () => {
    expect(PANEL_MONO).toContain('font-mono')
    expect(PANEL_MONO).toContain('text-[13px]')
    expect(PANEL_MONO).toContain('leading-5')
  })

  it('the segmented control has a hairline and the paper-2 track', () => {
    expect(PANEL_SEG_LIST).toContain('border')
    expect(PANEL_SEG_LIST).toContain('bg-background-2')
    expect(PANEL_SEG_TRIGGER).toContain('text-[13px]')
    expect(PANEL_SEG_TRIGGER).toContain('data-[state=active]:bg-card')
  })
})
