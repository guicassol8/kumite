import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/i18n'

import {
  emptyProblemFormValues,
  type ProblemFormValues,
  type TestCaseRow,
} from '@/lib/problem-form'
import type { UiLocale } from '@/lib/resolve-problem-title'

import { ProblemForm } from './problem-form'

afterEach(cleanup)

function valuesWith(overrides: {
  translations?: Partial<Record<UiLocale, { title: string; statementMd: string }>>
  testCases?: TestCaseRow[]
}): ProblemFormValues {
  const values = emptyProblemFormValues()
  Object.assign(values.translations, overrides.translations ?? {})
  values.testCases = overrides.testCases ?? []
  return values
}

const ptOnly = () =>
  valuesWith({ translations: { pt: { title: 'Soma', statementMd: 'Some `a` e `b`.' } } })

// Radix's Tabs trigger switches on mousedown/focus, not on a bare click.
function selectTab(locale: 'pt' | 'es' | 'en') {
  fireEvent.mouseDown(screen.getByTestId(`problem-form-tab-${locale}`))
}

/** The error a screen reader would read out for a field, via aria-describedby. */
function announcedError(testid: string): (string | undefined)[] {
  const field = screen.getByTestId(testid)
  expect(field.getAttribute('aria-invalid')).toBe('true')
  return (field.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent)
}

function renderForm(props: Partial<React.ComponentProps<typeof ProblemForm>> = {}) {
  const onSave = vi.fn()
  const onPublish = vi.fn()
  render(
    <ProblemForm
      initialValues={ptOnly()}
      savedLocales={[]}
      onSave={onSave}
      onPublish={onPublish}
      {...props}
    />,
  )
  return { onSave, onPublish }
}

describe('ProblemForm', () => {
  it('renders the PT tab seeded from the initial values, with a live markdown preview', () => {
    renderForm()

    expect((screen.getByTestId('problem-form-title-pt') as HTMLInputElement).value).toBe('Soma')
    expect(screen.getByTestId('problem-form-preview-pt').querySelector('code')?.textContent).toBe(
      'a',
    )

    fireEvent.change(screen.getByTestId('problem-form-statement-pt'), {
      target: { value: '# Novo título' },
    })
    expect(screen.getByTestId('problem-form-preview-pt').querySelector('h1')?.textContent).toBe(
      'Novo título',
    )
  })

  // Acceptance #1: the error lands on the offending field and the rest of the
  // form — including the other rows — survives untouched.
  it('flags a malformed JSON field on blur without disturbing the other case', () => {
    renderForm({
      initialValues: valuesWith({
        translations: { pt: { title: 'Soma', statementMd: 'Some.' } },
        testCases: [
          { input: '[1,2]', expected: '3', hidden: false },
          { input: '[4,5]', expected: '9', hidden: true },
        ],
      }),
    })

    const input = screen.getByTestId('problem-form-case-0-input')
    fireEvent.change(input, { target: { value: '[1,' } })
    fireEvent.blur(input)

    expect(screen.getByTestId('problem-form-case-0-input-error').textContent).toBe('JSON inválido')
    expect(screen.queryByTestId('problem-form-case-0-expected-error')).toBeNull()
    expect(screen.queryByTestId('problem-form-case-1-input-error')).toBeNull()
    expect((screen.getByTestId('problem-form-case-1-input') as HTMLInputElement).value).toBe(
      '[4,5]',
    )
    expect((screen.getByTestId('problem-form-case-0-expected') as HTMLInputElement).value).toBe('3')
  })

  it('reports an empty JSON field with its own message and clears it once fixed', () => {
    renderForm({
      initialValues: valuesWith({
        translations: { pt: { title: 'Soma', statementMd: 'Some.' } },
        testCases: [{ input: '', expected: '3', hidden: false }],
      }),
    })

    const input = screen.getByTestId('problem-form-case-0-input')
    fireEvent.blur(input)
    expect(screen.getByTestId('problem-form-case-0-input-error').textContent).toBe(
      'Informe um valor JSON',
    )

    fireEvent.change(input, { target: { value: '[1,2]' } })
    fireEvent.blur(input)
    expect(screen.queryByTestId('problem-form-case-0-input-error')).toBeNull()
  })

  // Acceptance #3: a draft with only PT saves as-is.
  it('saves a pt-only draft untouched', () => {
    const { onSave } = renderForm()

    fireEvent.click(screen.getByTestId('problem-form-save'))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0]?.[0].translations.pt.title).toBe('Soma')
    expect(onSave.mock.calls[0]?.[0].translations.es.title).toBe('')
  })

  it('blocks the save on a half-filled tab and points at the missing field', () => {
    const { onSave } = renderForm({
      initialValues: valuesWith({
        translations: {
          pt: { title: 'Soma', statementMd: 'Some.' },
          es: { title: 'Suma', statementMd: '' },
        },
      }),
    })

    fireEvent.click(screen.getByTestId('problem-form-save'))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByTestId('problem-form-tab-es').dataset.invalid).toBe('true')
    selectTab('es')
    expect(screen.getByTestId('problem-form-statement-es-error').textContent).toContain(
      'Preencha título e enunciado',
    )
  })

  it('refuses to clear a translation the API already stores', () => {
    const { onSave } = renderForm({ savedLocales: ['pt', 'es'] })

    fireEvent.click(screen.getByTestId('problem-form-save'))

    expect(onSave).not.toHaveBeenCalled()
    selectTab('es')
    expect(screen.getByTestId('problem-form-title-es-error').textContent).toContain(
      'Não é possível apagar uma tradução já salva',
    )
  })

  // Acceptance #2: publishing a pt-only draft names the tabs that are missing
  // content instead of bouncing off the API's English 400 message.
  it('blocks Publicar on a pt-only draft and flags the ES and EN tabs', () => {
    const { onPublish } = renderForm({
      initialValues: valuesWith({
        translations: { pt: { title: 'Soma', statementMd: 'Some.' } },
        testCases: [
          { input: '[1,2]', expected: '3', hidden: false },
          { input: '[4,5]', expected: '9', hidden: true },
        ],
      }),
    })

    fireEvent.click(screen.getByTestId('problem-form-publish'))

    expect(onPublish).not.toHaveBeenCalled()
    expect(screen.getByTestId('problem-form-tab-es').dataset.invalid).toBe('true')
    expect(screen.getByTestId('problem-form-tab-en').dataset.invalid).toBe('true')
    expect(screen.getByTestId('problem-form-tab-pt').dataset.invalid).toBe('false')

    selectTab('es')
    expect(screen.getByTestId('problem-form-title-es-error').textContent).toContain(
      'complete a tradução deste idioma',
    )
  })

  it('blocks Publicar when the case set has no hidden case', () => {
    const complete = {
      pt: { title: 'Soma', statementMd: 'Some.' },
      es: { title: 'Suma', statementMd: 'Suma.' },
      en: { title: 'Sum', statementMd: 'Sum.' },
    }
    const { onPublish } = renderForm({
      initialValues: valuesWith({
        translations: complete,
        testCases: [{ input: '[1,2]', expected: '3', hidden: false }],
      }),
    })

    fireEvent.click(screen.getByTestId('problem-form-publish'))

    expect(onPublish).not.toHaveBeenCalled()
    expect(screen.getByTestId('problem-form-cases-error').textContent).toContain(
      'pelo menos um caso oculto',
    )
  })

  it('publishes a fully translated problem with a visible and a hidden case', () => {
    const { onPublish } = renderForm({
      initialValues: valuesWith({
        translations: {
          pt: { title: 'Soma', statementMd: 'Some.' },
          es: { title: 'Suma', statementMd: 'Suma.' },
          en: { title: 'Sum', statementMd: 'Sum.' },
        },
        testCases: [
          { input: '[1,2]', expected: '3', hidden: false },
          { input: '[4,5]', expected: '9', hidden: true },
        ],
      }),
    })

    fireEvent.click(screen.getByTestId('problem-form-publish'))

    expect(onPublish).toHaveBeenCalledTimes(1)
    expect(onPublish.mock.calls[0]?.[0].testCases).toHaveLength(2)
  })

  it('adds, reorders and removes test-case rows', () => {
    renderForm({
      initialValues: valuesWith({
        translations: { pt: { title: 'Soma', statementMd: 'Some.' } },
        testCases: [
          { input: '[1,2]', expected: '3', hidden: false },
          { input: '[4,5]', expected: '9', hidden: true },
        ],
      }),
    })

    fireEvent.click(screen.getByTestId('problem-form-case-1-up'))
    expect((screen.getByTestId('problem-form-case-0-input') as HTMLInputElement).value).toBe(
      '[4,5]',
    )
    expect((screen.getByTestId('problem-form-case-1-input') as HTMLInputElement).value).toBe(
      '[1,2]',
    )

    fireEvent.click(screen.getByTestId('problem-form-case-0-down'))
    expect((screen.getByTestId('problem-form-case-0-input') as HTMLInputElement).value).toBe(
      '[1,2]',
    )

    fireEvent.click(screen.getByTestId('problem-form-add-case'))
    expect((screen.getByTestId('problem-form-case-2-input') as HTMLInputElement).value).toBe('')

    fireEvent.click(screen.getByTestId('problem-form-case-0-remove'))
    expect(screen.queryByTestId('problem-form-case-2-input')).toBeNull()
    expect((screen.getByTestId('problem-form-case-0-input') as HTMLInputElement).value).toBe(
      '[4,5]',
    )
  })

  it('leaves the first row unable to move up and the last unable to move down', () => {
    renderForm({
      initialValues: valuesWith({
        testCases: [
          { input: '[1,2]', expected: '3', hidden: false },
          { input: '[4,5]', expected: '9', hidden: true },
        ],
      }),
    })

    expect((screen.getByTestId('problem-form-case-0-up') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('problem-form-case-1-down') as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('disables Publicar with the archived reason, while Salvar stays available', () => {
    const { onSave } = renderForm({ status: 'archived' })

    expect((screen.getByTestId('problem-form-publish') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('problem-form-publish-hint').getAttribute('aria-label')).toBe(
      'Não é possível publicar um problema arquivado.',
    )
    expect(screen.getByTestId('problem-form-publish-hint').getAttribute('tabIndex')).toBe('0')

    fireEvent.click(screen.getByTestId('problem-form-save'))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('disables Publicar on an already published problem and shows its status badge', () => {
    renderForm({ status: 'published' })

    expect((screen.getByTestId('problem-form-publish') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('problem-form-publish-hint').getAttribute('aria-label')).toBe(
      'Este problema já está publicado.',
    )
    expect(screen.getByTestId('problem-form-publish-hint').getAttribute('tabIndex')).toBe('0')
    expect(screen.getByTestId('problem-form-status').textContent).toBe('Publicado')
  })

  it('surfaces the form-level error and success messages it is handed', async () => {
    const { rerender } = render(
      <ProblemForm
        initialValues={ptOnly()}
        savedLocales={[]}
        rootError="Falhou"
        onSave={vi.fn()}
        onPublish={vi.fn()}
      />,
    )
    expect(screen.getByTestId('problem-form-error').textContent).toContain('Falhou')

    rerender(
      <ProblemForm
        initialValues={ptOnly()}
        savedLocales={[]}
        successMessage="Alterações salvas."
        onSave={vi.fn()}
        onPublish={vi.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('problem-form-success').textContent).toContain(
        'Alterações salvas.',
      ),
    )
    expect(screen.queryByTestId('problem-form-error')).toBeNull()
  })

  it('disables both actions while a submission is in flight', () => {
    renderForm({ isSubmitting: true })

    expect((screen.getByTestId('problem-form-save') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('problem-form-publish') as HTMLButtonElement).disabled).toBe(true)
  })
  // The errors are visible, but `FormControl` also points aria-describedby at
  // the message id — so they have to be rendered where that id lands.
  it('announces the field errors to assistive tech, not just visually', () => {
    const incomplete = 'Preencha título e enunciado, ou deixe a aba inteira em branco.'
    renderForm({
      initialValues: valuesWith({
        translations: {
          pt: { title: '', statementMd: 'Some a e b.' },
          es: { title: 'Suma', statementMd: '' },
        },
        testCases: [{ input: '[1,', expected: '3', hidden: false }],
      }),
    })

    fireEvent.click(screen.getByTestId('problem-form-save'))

    expect(announcedError('problem-form-title-pt')).toContain(incomplete)
    expect(announcedError('problem-form-case-0-input')).toContain('JSON inválido')
    selectTab('es')
    expect(announcedError('problem-form-statement-es')).toContain(incomplete)
  })
  // An emptied number field hands back NaN, which used to serialize as
  // `points: null` and come back as a generic "could not save" alert.
  it('blocks the save when the points field is cleared', () => {
    const { onSave } = renderForm()

    fireEvent.change(screen.getByTestId('problem-form-points'), { target: { value: '' } })
    fireEvent.click(screen.getByTestId('problem-form-save'))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByTestId('problem-form-points-error').textContent).toBe(
      'Informe uma pontuação inteira maior que zero.',
    )
    expect(announcedError('problem-form-points')).toContain(
      'Informe uma pontuação inteira maior que zero.',
    )
  })
})
