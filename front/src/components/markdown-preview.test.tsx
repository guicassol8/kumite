import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MarkdownPreview } from './markdown-preview'

afterEach(cleanup)

describe('MarkdownPreview', () => {
  it('renders headings from markdown', () => {
    render(<MarkdownPreview value="# Título" data-testid="preview" />)

    expect(screen.getByTestId('preview').querySelector('h1')?.textContent).toBe('Título')
  })

  it('renders GFM tables', () => {
    const table = ['| a | b |', '| --- | --- |', '| 1 | 2 |'].join('\n')
    render(<MarkdownPreview value={table} data-testid="preview" />)

    const rendered = screen.getByTestId('preview').querySelector('table')
    expect(rendered).not.toBeNull()
    expect(rendered?.textContent).toContain('1')
  })

  it('renders inline code and lists', () => {
    render(<MarkdownPreview value={'- some `a` e `b`'} data-testid="preview" />)

    const container = screen.getByTestId('preview')
    expect(container.querySelector('ul li')).not.toBeNull()
    expect(container.querySelector('code')?.textContent).toBe('a')
  })

  // react-markdown does not pass raw HTML through unless `rehype-raw` is wired
  // in — that is precisely why the plan skipped a sanitizer dependency.
  it('escapes raw HTML instead of rendering it', () => {
    render(<MarkdownPreview value={'<script>alert(1)</script>'} data-testid="preview" />)

    const container = screen.getByTestId('preview')
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>alert(1)</script>')
  })

  it('renders an empty container for empty input', () => {
    render(<MarkdownPreview value="" data-testid="preview" />)

    expect(screen.getByTestId('preview').textContent).toBe('')
  })
})
