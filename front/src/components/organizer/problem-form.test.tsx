import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import '@/i18n'

import { POINTS_MAX } from '@/lib/field-limits'
import {
  emptyProblemFormValues,
  type ProblemFormError,
  type ProblemFormValues,
  type SubmitOutcome,
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

/**
 * Radix's Select opens on pointerdown/keyboard, and jsdom has no pointer
 * capture for `fireEvent.pointerDown` — Enter is the interaction it supports
 * (same note as export-menu.test.tsx).
 */
async function chooseVisibility(visibility: 'round' | 'practice') {
  const trigger = screen.getByTestId('problem-form-visibility')
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'Enter' })
  const item = await screen.findByTestId(`problem-form-visibility-${visibility}`)
  fireEvent.keyDown(item, { key: 'Enter' })
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
}

const completeTranslations = {
  pt: { title: 'Soma', statementMd: 'Some.' },
  es: { title: 'Suma', statementMd: 'Suma.' },
  en: { title: 'Sum', statementMd: 'Sum.' },
}

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

// The `_values` parameter is load-bearing, not decoration: without it the mock
// is typed as taking none, and the tests that assert on
// `onSave.mock.calls[0]?.[0]` lose the argument's type.
/** A handler that accepted the values — the default for every test here. */
const accepts = () =>
  vi.fn(async (_values: ProblemFormValues): Promise<SubmitOutcome> => ({ ok: true }))

/** A handler that failed with per-field errors the form is expected to paint. */
const rejectsWith = (fieldErrors: ProblemFormError[]) =>
  vi.fn(async (_values: ProblemFormValues): Promise<SubmitOutcome> => ({ ok: false, fieldErrors }))

function renderForm(props: Partial<React.ComponentProps<typeof ProblemForm>> = {}) {
  const onSave = accepts()
  const onPublish = accepts()
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
    // #129's tabIndex is only for the disabled case (its Tooltip has content
    // to show on focus); an enabled Publicar mustn't gain an extra, silent
    // tab stop on its wrapper span ahead of the button itself.
    expect(screen.getByTestId('problem-form-publish-hint').getAttribute('tabIndex')).toBeNull()
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
        onSave={accepts()}
        onPublish={accepts()}
      />,
    )
    expect(screen.getByTestId('problem-form-error').textContent).toContain('Falhou')

    rerender(
      <ProblemForm
        initialValues={ptOnly()}
        savedLocales={[]}
        successMessage="Alterações salvas."
        onSave={accepts()}
        onPublish={accepts()}
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

  it('blocks the save and names the ceiling when points is over the limit', () => {
    const { onSave } = renderForm()

    fireEvent.change(screen.getByTestId('problem-form-points'), {
      target: { value: '9999999999' },
    })
    fireEvent.click(screen.getByTestId('problem-form-save'))

    // No round-trip: the acceptance is that the organizer learns the limit
    // without one.
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByTestId('problem-form-points-error').textContent).toContain(
      String(POINTS_MAX),
    )
  })

  it('caps the points input at the ceiling in the DOM too', () => {
    renderForm()

    expect(screen.getByTestId('problem-form-points').getAttribute('max')).toBe(String(POINTS_MAX))
  })

  it('paints a per-field error the handler brings back from the API', async () => {
    const onSave = rejectsWith([{ kind: 'pointsTooLarge', max: POINTS_MAX }])
    render(
      <ProblemForm
        initialValues={ptOnly()}
        savedLocales={[]}
        onSave={onSave}
        onPublish={accepts()}
      />,
    )

    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-points-error').textContent).toContain(
        String(POINTS_MAX),
      ),
    )
    expect(onSave).toHaveBeenCalledTimes(1)
    // The form-level alert stays away: the message has a field of its own.
    expect(screen.queryByTestId('problem-form-error')).toBeNull()
  })

  it('switches to the offending tab for a translation error from the API', async () => {
    const onSave = rejectsWith([
      { kind: 'serverRejected', target: { field: 'translation', locale: 'en', key: 'title' } },
    ])
    render(
      <ProblemForm
        initialValues={ptOnly()}
        savedLocales={[]}
        onSave={onSave}
        onPublish={accepts()}
      />,
    )

    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-tab-en').getAttribute('data-invalid')).toBe('true'),
    )
    expect(screen.getByTestId('problem-form-title-en-error').textContent).toBe(
      'O servidor recusou este valor. Revise o campo.',
    )
  })

  // The two fields that had no FormMessage before #187: with the 422 mapping
  // generic by path, an error on either used to be set and never rendered.
  it('has somewhere to render a rejection on difficulty', async () => {
    const onSave = rejectsWith([{ kind: 'serverRejected', target: { field: 'difficulty' } }])
    render(
      <ProblemForm
        initialValues={ptOnly()}
        savedLocales={[]}
        onSave={onSave}
        onPublish={accepts()}
      />,
    )

    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-difficulty-error').textContent).toBe(
        'O servidor recusou este valor. Revise o campo.',
      ),
    )
  })

  it('has somewhere to render a rejection on a row’s hidden flag', async () => {
    const onSave = rejectsWith([
      { kind: 'serverRejected', target: { field: 'testCase', index: 0, key: 'hidden' } },
    ])
    render(
      <ProblemForm
        initialValues={valuesWith({
          translations: { pt: { title: 'Soma', statementMd: 'Some a e b.' } },
          testCases: [{ input: '1', expected: '1', hidden: false }],
        })}
        savedLocales={[]}
        onSave={onSave}
        onPublish={accepts()}
      />,
    )

    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-case-0-hidden-error').textContent).toBe(
        'O servidor recusou este valor. Revise o campo.',
      ),
    )
  })

  it('leaves the fields alone when the failure carries no field errors', async () => {
    const onSave = rejectsWith([])
    render(
      <ProblemForm
        initialValues={ptOnly()}
        savedLocales={[]}
        rootError="Não foi possível salvar o problema. Tente novamente."
        onSave={onSave}
        onPublish={accepts()}
      />,
    )

    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('problem-form-points-error')).toBeNull()
    expect(screen.getByTestId('problem-form-error').textContent).toContain('Tente novamente')
  })
})

/** The element's classes as tokens — a substring match on the whole string
 * hits things like `aria-invalid:border-destructive` by accident. */
function classesOf(element: Element): string[] {
  return [...element.classList]
}

/** The label element bound to a control, via its `id`. */
function labelFor(testid: string): Element {
  const field = screen.getByTestId(testid)
  const id = field.getAttribute('id')
  const label = id ? document.querySelector(`label[for="${id}"]`) : null
  if (!label) throw new Error(`no label bound to ${testid}`)
  return label
}

// #233 — the problem form in the new identity.
// #347 — the round/practice visibility control.
describe('ProblemForm visibility', () => {
  it('starts on Rodada, with no practice note', () => {
    renderForm()

    expect(screen.getByTestId('problem-form-visibility').textContent).toBe('Rodada')
    expect(screen.queryByTestId('problem-form-practice-note')).toBeNull()
  })

  it('shows the practice note while Prática is chosen, and hides it again on Rodada', async () => {
    renderForm()

    await chooseVisibility('practice')
    expect(screen.getByTestId('problem-form-visibility').textContent).toBe('Prática')
    expect(screen.getByTestId('problem-form-practice-note').textContent).toContain(
      'os casos ocultos não são exigidos nem usados',
    )

    await chooseVisibility('round')
    expect(screen.queryByTestId('problem-form-practice-note')).toBeNull()
  })

  it('seeds Prática from the initial values', () => {
    const values = ptOnly()
    values.visibility = 'practice'
    renderForm({ initialValues: values })

    expect(screen.getByTestId('problem-form-visibility').textContent).toBe('Prática')
    expect(screen.getByTestId('problem-form-practice-note')).toBeTruthy()
  })

  it('publishes a practice problem with only a visible case', async () => {
    const { onPublish } = renderForm({
      initialValues: valuesWith({
        translations: completeTranslations,
        testCases: [{ input: '[1,2]', expected: '3', hidden: false }],
      }),
    })

    await chooseVisibility('practice')
    fireEvent.click(screen.getByTestId('problem-form-publish'))

    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1))
    expect(onPublish.mock.calls[0]?.[0].visibility).toBe('practice')
    expect(screen.queryByTestId('problem-form-cases-error')).toBeNull()
  })

  it('paints problem_in_round under the Select, keeping Prática and what was typed', async () => {
    const onSave = rejectsWith([{ kind: 'visibilityLockedByRound' }])
    renderForm({ onSave })

    await chooseVisibility('practice')
    fireEvent.change(screen.getByTestId('problem-form-title-pt'), {
      target: { value: 'Soma revisada' },
    })
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-visibility-error').textContent).toBe(
        'Este problema já esteve numa rodada e não pode virar prática.',
      ),
    )
    expect(onSave.mock.calls[0]?.[0].visibility).toBe('practice')
    expect((screen.getByTestId('problem-form-title-pt') as HTMLInputElement).value).toBe(
      'Soma revisada',
    )
    expect(screen.getByTestId('problem-form-visibility').textContent).toBe('Prática')
    expect(screen.queryByTestId('problem-form-error')).toBeNull()
  })

  it('paints missing_test_cases on the test-case section', async () => {
    const onSave = rejectsWith([{ kind: 'roundNeedsTestCases' }])
    renderForm({ onSave })

    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() =>
      expect(screen.getByTestId('problem-form-cases-error').textContent).toBe(
        'Para voltar para rodada, um problema publicado precisa de pelo menos um caso visível e um oculto.',
      ),
    )
    expect(screen.queryByTestId('problem-form-visibility-error')).toBeNull()
  })

  // Both refusals are about the visibility that was sent: once the organizer
  // picks another one, the message no longer describes the form on screen.
  it('clears problem_in_round once the organizer goes back to Rodada', async () => {
    const onSave = rejectsWith([{ kind: 'visibilityLockedByRound' }])
    renderForm({ onSave })

    await chooseVisibility('practice')
    fireEvent.click(screen.getByTestId('problem-form-save'))
    await waitFor(() => expect(screen.getByTestId('problem-form-visibility-error')).toBeTruthy())

    await chooseVisibility('round')
    expect(screen.queryByTestId('problem-form-visibility-error')).toBeNull()
  })

  it('clears missing_test_cases once the organizer goes back to Prática', async () => {
    const values = ptOnly()
    values.visibility = 'practice'
    const onSave = rejectsWith([{ kind: 'roundNeedsTestCases' }])
    renderForm({ initialValues: values, onSave })

    await chooseVisibility('round')
    fireEvent.click(screen.getByTestId('problem-form-save'))
    await waitFor(() => expect(screen.getByTestId('problem-form-cases-error')).toBeTruthy())

    await chooseVisibility('practice')
    expect(screen.queryByTestId('problem-form-cases-error')).toBeNull()
  })
})

describe('ProblemForm in the panel identity', () => {
  it('makes Publicar the only button filled in brand red', () => {
    renderForm({ status: 'draft' })

    const form = screen.getByTestId('problem-form')
    expect(classesOf(screen.getByTestId('problem-form-publish'))).toContain('bg-brand')

    const branded = [...form.querySelectorAll('button')].filter((button) =>
      classesOf(button).includes('bg-brand'),
    )
    expect(branded).toHaveLength(1)

    const save = screen.getByTestId('problem-form-save')
    expect(classesOf(save)).toContain('bg-primary')
    expect(classesOf(save)).not.toContain('bg-brand')
  })

  it('renders field labels at 13/500', () => {
    renderForm()

    for (const testid of ['problem-form-points', 'problem-form-title-pt']) {
      const classes = classesOf(labelFor(testid))
      expect(classes).toContain('text-[13px]')
      expect(classes).toContain('font-medium')
    }
  })

  it('paints a rejected field with a crimson outline and 13 px crimson text', async () => {
    const onSave = accepts()
    render(
      <ProblemForm
        initialValues={ptOnly()}
        savedLocales={[]}
        onSave={onSave}
        onPublish={accepts()}
      />,
    )

    fireEvent.change(screen.getByTestId('problem-form-points'), { target: { value: '0' } })
    fireEvent.click(screen.getByTestId('problem-form-save'))

    await waitFor(() => expect(screen.getByTestId('problem-form-points-error')).toBeTruthy())
    const message = screen.getByTestId('problem-form-points-error')
    expect(classesOf(message)).toContain('text-[13px]')
    expect(classesOf(message)).toContain('text-destructive')
    expect(screen.getByTestId('problem-form-points').getAttribute('aria-invalid')).toBe('true')
    // The outline is the whole error signal — no red fill anywhere.
    expect(classesOf(message)).not.toContain('bg-destructive')
    expect(onSave).not.toHaveBeenCalled()
  })

  // By slot, not by name: this also pins the two nodes #187 added
  // (`problem-form-difficulty-error`, `problem-form-case-0-hidden-error`) and
  // any that appear later, without enumerating them.
  it('gives every form-message slot the 13 px crimson treatment', async () => {
    renderForm({
      initialValues: valuesWith({
        translations: { pt: { title: 'Soma', statementMd: 'Some.' } },
        testCases: [{ input: '[1]', expected: '1', hidden: false }],
      }),
    })

    fireEvent.change(screen.getByTestId('problem-form-points'), { target: { value: '0' } })
    fireEvent.click(screen.getByTestId('problem-form-save'))
    await waitFor(() => expect(screen.getByTestId('problem-form-points-error')).toBeTruthy())

    const messages = [
      ...screen.getByTestId('problem-form').querySelectorAll('[data-slot="form-message"]'),
    ]
    expect(messages.length).toBeGreaterThan(0)
    for (const message of messages) {
      expect(classesOf(message)).toContain('text-[13px]')
      expect(classesOf(message)).toContain('text-destructive')
    }
  })

  it('sets test-case values and the statement in mono', () => {
    renderForm({
      initialValues: valuesWith({
        translations: { pt: { title: 'Soma', statementMd: 'Some.' } },
        testCases: [{ input: '[1]', expected: '1', hidden: false }],
      }),
    })

    for (const testid of [
      'problem-form-case-0-input',
      'problem-form-case-0-expected',
      'problem-form-statement-pt',
    ]) {
      expect(classesOf(screen.getByTestId(testid))).toContain('font-mono')
    }
  })

  it('reorders with Lucide arrows instead of glyphs, keeping the accessible names', () => {
    renderForm({
      initialValues: valuesWith({
        translations: { pt: { title: 'Soma', statementMd: 'Some.' } },
        testCases: [
          { input: '[1]', expected: '1', hidden: false },
          { input: '[2]', expected: '2', hidden: false },
        ],
      }),
    })

    const up = screen.getByTestId('problem-form-case-1-up')
    expect(up.textContent).not.toContain('↑')
    expect(up.querySelector('svg')).toBeTruthy()
    expect(up.getAttribute('aria-label')).toBeTruthy()

    const down = screen.getByTestId('problem-form-case-0-down')
    expect(down.textContent).not.toContain('↓')
    expect(down.querySelector('svg')).toBeTruthy()
  })

  it('keeps the invalid-tab hint while wearing the segmented control', () => {
    renderForm({
      initialValues: valuesWith({ translations: { pt: { title: '', statementMd: '' } } }),
    })

    const tab = screen.getByTestId('problem-form-tab-pt')
    expect(classesOf(tab)).toContain('data-[invalid=true]:text-destructive')
    expect(classesOf(tab)).toContain('text-[13px]')
  })
})
