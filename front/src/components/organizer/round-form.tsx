import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import {
  PANEL_FIELD_ERROR,
  PANEL_FIELD_LABEL,
  PANEL_SECTION_TITLE,
} from '@/components/organizer/panel-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import type { ApiFieldIssue } from '@/lib/api-issues'
import { resolveProblemTitle, type UiLocale } from '@/lib/resolve-problem-title'

export type RoundFormValues = {
  name: string
  durationMinutes: number
  problemIds: string[]
}

type RoundField = keyof RoundFormValues

/** A message per field the server refused, already translated (#312). */
export type RoundFieldErrors = Partial<Record<RoundField, string>>

type RoundFormProps = {
  initialValues: RoundFormValues
  isSubmitting?: boolean
  rootError?: string
  /**
   * May hand back the fields the server refused; each message lands under its
   * field, and the next save's validation clears them. A caller with nothing
   * to report returns `void`.
   */
  onSave: (values: RoundFormValues) => void | Promise<RoundFieldErrors | void>
}

/**
 * Which catalog key each body issue of kata's 422 gets (#312). Never the
 * issue's own `message` — that is English written for the API's logs. An
 * issue on one problem id (`problemIds[2]`) belongs to the problems list as a
 * whole; a path the form has no field for is dropped, and the caller falls
 * back to its generic error when nothing is left.
 */
export function roundFieldErrorKeys(issues: ApiFieldIssue[]): Partial<Record<RoundField, string>> {
  const keys: Partial<Record<RoundField, string>> = {}
  for (const { path } of issues) {
    if (path === 'name') keys.name = 'organizer.roundForm.errors.fieldRejected'
    else if (path === 'durationMinutes')
      keys.durationMinutes = 'organizer.roundForm.errors.durationInvalid'
    else if (path === 'problemIds' || path.startsWith('problemIds['))
      keys.problemIds = 'organizer.roundForm.errors.invalidProblemIds'
  }
  return keys
}

function toUiLocale(language: string): UiLocale {
  return language === 'es' || language === 'en' ? language : 'pt'
}

async function fetchPublishedProblems() {
  const res = await api.organizer.problems.$get()
  if (!res.ok) throw new Error('failed to load problems')
  const problems = await res.json()
  // A practice problem (#209) is published but never eligible for a round —
  // the back refuses it with invalid_problem_ids, so it is not offered here.
  return problems.filter(
    (problem) => problem.status === 'published' && problem.visibility === 'round',
  )
}

/**
 * Only reorders within the selected subset — `index`/`target` are positions
 * in `problemIds`, not in the full catalog list.
 */
function moveProblemId(ids: string[], index: number, direction: 'up' | 'down'): string[] {
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= ids.length) return ids
  const next = [...ids]
  const moved = next[index]
  const displaced = next[target]
  if (moved === undefined || displaced === undefined) return ids
  next[index] = displaced
  next[target] = moved
  return next
}

export function RoundForm({
  initialValues,
  isSubmitting = false,
  rootError,
  onSave,
}: RoundFormProps) {
  const { t, i18n } = useTranslation()
  const uiLocale = toUiLocale(i18n.resolvedLanguage ?? i18n.language)

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t('organizer.roundForm.errors.nameRequired'))
          .max(120, t('organizer.roundForm.errors.nameTooLong')),
        durationMinutes: z
          .number({ invalid_type_error: t('organizer.roundForm.errors.durationInvalid') })
          .int(t('organizer.roundForm.errors.durationInvalid'))
          .positive(t('organizer.roundForm.errors.durationInvalid')),
        problemIds: z.array(z.string()),
      }),
    [t, i18n.language],
  )

  const form = useForm<RoundFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  })

  const problems = useQuery({
    queryKey: ['organizer-published-problems'],
    queryFn: fetchPublishedProblems,
  })

  const problemIds = form.watch('problemIds')
  // Not a `FormField` — the list is a set of checkboxes — so the error a
  // server hands back for it needs a slot of its own.
  const problemsError = form.formState.errors.problemIds?.message

  const selectedProblems = problemIds
    .map((id) => problems.data?.find((problem) => problem.id === id))
    .filter((problem): problem is NonNullable<typeof problem> => problem !== undefined)
  const unselectedProblems = (problems.data ?? []).filter(
    (problem) => !problemIds.includes(problem.id),
  )

  function toggleProblem(id: string, checked: boolean) {
    form.setValue(
      'problemIds',
      checked ? [...problemIds, id] : problemIds.filter((existing) => existing !== id),
      { shouldDirty: true },
    )
  }

  function moveSelected(id: string, direction: 'up' | 'down') {
    const index = problemIds.indexOf(id)
    if (index === -1) return
    form.setValue('problemIds', moveProblemId(problemIds, index, direction), { shouldDirty: true })
  }

  function problemTitle(problem: { translations: { locale: UiLocale; title: string }[] }) {
    return (
      resolveProblemTitle(problem.translations, uiLocale) ?? t('organizer.problems.missingTitle')
    )
  }

  async function handleSave() {
    const valid = await form.trigger()
    if (!valid) return
    const fieldErrors = await onSave(form.getValues())
    if (!fieldErrors) return
    for (const [field, message] of Object.entries(fieldErrors) as [RoundField, string][]) {
      form.setError(field, { message })
    }
  }

  return (
    <Form {...form}>
      <form
        data-testid="round-form"
        className="flex flex-col gap-6"
        onSubmit={(event) => event.preventDefault()}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={PANEL_FIELD_LABEL}>
                {t('organizer.roundForm.nameLabel')}
              </FormLabel>
              <FormControl>
                <Input data-testid="round-form-name" {...field} />
              </FormControl>
              <FormMessage className={PANEL_FIELD_ERROR} data-testid="round-form-name-error" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="durationMinutes"
          render={({ field }) => (
            <FormItem className="w-40">
              <FormLabel className={PANEL_FIELD_LABEL}>
                {t('organizer.roundForm.durationLabel')}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  data-testid="round-form-duration"
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage className={PANEL_FIELD_ERROR} data-testid="round-form-duration-error" />
            </FormItem>
          )}
        />

        <section className="flex flex-col gap-3">
          <h3 className={PANEL_SECTION_TITLE}>{t('organizer.roundForm.problemsHeading')}</h3>

          {problems.isPending && (
            <p data-testid="round-form-problems-loading">{t('organizer.roundForm.loading')}</p>
          )}

          {problems.data && problems.data.length === 0 && (
            <p className="text-muted-foreground text-sm" data-testid="round-form-problems-empty">
              {t('organizer.roundForm.problemsEmpty')}
            </p>
          )}

          {[...selectedProblems, ...unselectedProblems].map((problem) => {
            const checked = problemIds.includes(problem.id)
            const index = problemIds.indexOf(problem.id)
            return (
              <div
                key={problem.id}
                data-testid={`round-form-problem-${problem.id}`}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <Checkbox
                  id={`round-form-problem-${problem.id}-checkbox`}
                  data-testid={`round-form-problem-${problem.id}-checkbox`}
                  checked={checked}
                  onCheckedChange={(next) => toggleProblem(problem.id, next === true)}
                />
                <Label
                  htmlFor={`round-form-problem-${problem.id}-checkbox`}
                  className={`${PANEL_FIELD_LABEL} flex-1`}
                >
                  {problemTitle(problem)}
                </Label>
                {checked && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === 0}
                      aria-label={t('organizer.roundForm.moveUpAction')}
                      data-testid={`round-form-problem-${problem.id}-up`}
                      onClick={() => moveSelected(problem.id, 'up')}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === problemIds.length - 1}
                      aria-label={t('organizer.roundForm.moveDownAction')}
                      data-testid={`round-form-problem-${problem.id}-down`}
                      onClick={() => moveSelected(problem.id, 'down')}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            )
          })}

          {problemsError && (
            <p role="alert" className={PANEL_FIELD_ERROR} data-testid="round-form-problems-error">
              {problemsError}
            </p>
          )}
        </section>

        {rootError && (
          <Alert variant="destructive" data-testid="round-form-error">
            <AlertDescription>{rootError}</AlertDescription>
          </Alert>
        )}

        <div>
          <Button
            type="button"
            data-testid="round-form-save"
            disabled={isSubmitting}
            onClick={handleSave}
          >
            {t('organizer.roundForm.saveAction')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
