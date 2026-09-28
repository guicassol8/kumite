import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { type FieldPath, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { MarkdownPreview } from '@/components/markdown-preview'
import {
  PANEL_BRAND_BUTTON,
  PANEL_FIELD_ERROR,
  PANEL_FIELD_LABEL,
  PANEL_MONO,
  PANEL_SECTION_TITLE,
  PANEL_SEG_LIST,
  PANEL_SEG_TRIGGER,
} from '@/components/organizer/panel-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { POINTS_MAX } from '@/lib/field-limits'
import {
  type Difficulty,
  emptyTestCaseRow,
  FORM_LOCALES,
  type JsonFieldName,
  moveTestCase,
  type ProblemFormError,
  type ProblemFormValues,
  type ProblemStatus,
  type ProblemVisibility,
  parseJsonField,
  type SubmitOutcome,
  validateForPublish,
  validateForSave,
} from '@/lib/problem-form'
import type { UiLocale } from '@/lib/resolve-problem-title'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const VISIBILITIES: ProblemVisibility[] = ['round', 'practice']

type ProblemFormProps = {
  initialValues: ProblemFormValues
  savedLocales: UiLocale[]
  /** `undefined` while the problem has not been created yet (the /new route). */
  status?: ProblemStatus
  isSubmitting?: boolean
  rootError?: string
  successMessage?: string
  // Async and result-bearing (#187): the API's per-field 422 has to come back
  // here to be painted onto the field that caused it, instead of being flattened
  // into the screen's form-level "could not save".
  onSave: (values: ProblemFormValues) => Promise<SubmitOutcome>
  onPublish: (values: ProblemFormValues) => Promise<SubmitOutcome>
}

function jsonFieldName(index: number, field: JsonFieldName) {
  return `testCases.${index}.${field}` as FieldPath<ProblemFormValues>
}

export function ProblemForm({
  initialValues,
  savedLocales,
  status,
  isSubmitting = false,
  rootError,
  successMessage,
  onSave,
  onPublish,
}: ProblemFormProps) {
  const { t } = useTranslation()
  const form = useForm<ProblemFormValues>({ defaultValues: initialValues })
  const [activeLocale, setActiveLocale] = useState<UiLocale>('pt')
  // Publish-only errors with no field of their own: they belong to the whole
  // test-case section, not to one row.
  const [caseSectionError, setCaseSectionError] = useState<string | null>(null)

  const testCases = form.watch('testCases')
  const visibility = form.watch('visibility')
  const errors = form.formState.errors

  function messageFor(error: ProblemFormError): string {
    switch (error.kind) {
      case 'pointsInvalid':
        return t('organizer.problemForm.errors.pointsInvalid')
      case 'pointsTooLarge':
        return t('organizer.problemForm.errors.pointsTooLarge', { max: error.max })
      case 'serverRejected':
        // Always the catalog string, never `issue.message`: kata's issues carry
        // zod's own English text, which would land untranslated in front of a
        // pt/es organizer.
        return t('organizer.problemForm.errors.fieldRejected')
      case 'translationIncomplete':
        return t('organizer.problemForm.errors.translationIncomplete')
      case 'translationCannotBeCleared':
        return t('organizer.problemForm.errors.translationCannotBeCleared')
      case 'json':
        return t(
          error.reason === 'empty'
            ? 'organizer.problemForm.errors.jsonEmpty'
            : 'organizer.problemForm.errors.jsonInvalid',
        )
      case 'publishMissingLocale':
        return t('organizer.problemForm.errors.publish.missingLocales')
      case 'publishMissingVisibleCase':
        return t('organizer.problemForm.errors.publish.missingVisibleCase')
      case 'publishMissingHiddenCase':
        return t('organizer.problemForm.errors.publish.missingHiddenCase')
      case 'visibilityLockedByRound':
        return t('organizer.problemForm.errors.problemInRound')
      case 'roundNeedsTestCases':
        return t('organizer.problemForm.errors.roundNeedsTestCases')
    }
  }

  /**
   * Maps the pure validation errors back onto their tab/field and moves the
   * user to the first tab that has one, so nothing fails out of sight.
   */
  function applyErrors(validationErrors: ProblemFormError[]): void {
    form.clearErrors()
    const sectionMessages: string[] = []
    let firstErroredLocale: UiLocale | undefined

    for (const error of validationErrors) {
      if (error.kind === 'pointsInvalid' || error.kind === 'pointsTooLarge') {
        form.setError('points', { message: messageFor(error) })
        continue
      }
      if (
        error.kind === 'publishMissingVisibleCase' ||
        error.kind === 'publishMissingHiddenCase' ||
        // The fix for this refusal is adding a case, so it sits with the cases
        // rather than under the Select that triggered it.
        error.kind === 'roundNeedsTestCases'
      ) {
        sectionMessages.push(messageFor(error))
        continue
      }
      if (error.kind === 'visibilityLockedByRound') {
        form.setError('visibility', { message: messageFor(error) })
        continue
      }
      if (error.kind === 'json') {
        form.setError(jsonFieldName(error.index, error.field), { message: messageFor(error) })
        continue
      }
      if (error.kind === 'serverRejected') {
        const { target } = error
        const message = messageFor(error)
        if (target.field === 'points' || target.field === 'difficulty') {
          form.setError(target.field, { message })
        } else if (target.field === 'testCase') {
          form.setError(`testCases.${target.index}.${target.key}`, { message })
        } else {
          form.setError(`translations.${target.locale}.${target.key}`, { message })
          firstErroredLocale ??= target.locale
        }
        continue
      }
      form.setError(`translations.${error.locale}.${error.field}`, { message: messageFor(error) })
      firstErroredLocale ??= error.locale
    }

    setCaseSectionError(sectionMessages.length > 0 ? sectionMessages.join(' ') : null)
    if (firstErroredLocale) setActiveLocale(firstErroredLocale)
  }

  async function submit(
    validate: typeof validateForSave,
    handler: (values: ProblemFormValues) => Promise<SubmitOutcome>,
  ) {
    const values = form.getValues()
    const validationErrors = validate(values, savedLocales)
    if (validationErrors.length > 0) {
      applyErrors(validationErrors)
      return
    }
    form.clearErrors()
    setCaseSectionError(null)

    // Client and server errors now reach the fields through the same door, so
    // a 422 switches to the offending tab exactly like a local rule does.
    const outcome = await handler(values)
    if (!outcome.ok && outcome.fieldErrors.length > 0) applyErrors(outcome.fieldErrors)
  }

  function validateJsonFieldOnBlur(index: number, field: JsonFieldName): void {
    const name = jsonFieldName(index, field)
    const parsed = parseJsonField(form.getValues(`testCases.${index}.${field}`))
    if (parsed.ok) form.clearErrors(name)
    else
      form.setError(name, {
        message: messageFor({ kind: 'json', reason: parsed.reason, index, field }),
      })
  }

  function updateTestCases(next: ProblemFormValues['testCases']): void {
    // The per-row errors are keyed by index, so any structural change would
    // leave them pointing at the wrong row.
    form.clearErrors('testCases')
    setCaseSectionError(null)
    form.setValue('testCases', next)
  }

  const publishDisabledReason =
    status === 'published'
      ? t('organizer.problemForm.publishDisabled.published')
      : status === 'archived'
        ? t('organizer.problemForm.publishDisabled.archived')
        : null

  return (
    <Form {...form}>
      <form
        data-testid="problem-form"
        className="flex flex-col gap-6"
        onSubmit={(event) => event.preventDefault()}
      >
        {/* The fields pin themselves to the top (`self-start`): a message under
            one of them (the three-line `problem_in_round`, #347) grows only its
            own cell instead of pushing its neighbours' controls down. The
            status badge keeps the row's bottom alignment. */}
        <div className="flex flex-wrap items-end gap-4">
          <FormField
            control={form.control}
            name="difficulty"
            render={({ field }) => (
              <FormItem className="w-40 self-start">
                <FormLabel className={PANEL_FIELD_LABEL}>
                  {t('organizer.problemForm.difficultyLabel')}
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="problem-form-difficulty">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DIFFICULTIES.map((difficulty) => (
                      <SelectItem
                        key={difficulty}
                        value={difficulty}
                        data-testid={`problem-form-difficulty-${difficulty}`}
                      >
                        {t(`organizer.problems.difficulty.${difficulty}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Nearly unreachable from the UI — a three-option Select cannot
                    produce an invalid value — but the 422 mapping is generic by
                    path, so without a node here a rejection on `difficulty`
                    would set an error with nothing to render it. */}
                <FormMessage
                  className={PANEL_FIELD_ERROR}
                  data-testid="problem-form-difficulty-error"
                />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="points"
            render={({ field }) => (
              <FormItem className="w-32 self-start">
                <FormLabel className={PANEL_FIELD_LABEL}>
                  {t('organizer.problemForm.pointsLabel')}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={POINTS_MAX}
                    data-testid="problem-form-points"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage
                  className={PANEL_FIELD_ERROR}
                  data-testid="problem-form-points-error"
                />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="visibility"
            render={({ field }) => (
              <FormItem className="w-40 self-start">
                <FormLabel className={PANEL_FIELD_LABEL}>
                  {t('organizer.problemForm.visibilityLabel')}
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger data-testid="problem-form-visibility">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {VISIBILITIES.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        data-testid={`problem-form-visibility-${option}`}
                      >
                        {t(`organizer.problemForm.visibility.${option}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Where the server's `problem_in_round` lands: the refusal
                    belongs to the control that caused it (#187). */}
                <FormMessage
                  className={PANEL_FIELD_ERROR}
                  data-testid="problem-form-visibility-error"
                />
              </FormItem>
            )}
          />

          {status && (
            <Badge data-testid="problem-form-status" className="mb-2">
              {t(`organizer.problems.status.${status}`)}
            </Badge>
          )}
        </div>

        <Tabs value={activeLocale} onValueChange={(value) => setActiveLocale(value as UiLocale)}>
          <TabsList className={PANEL_SEG_LIST}>
            {FORM_LOCALES.map((locale) => {
              const localeErrors = errors.translations?.[locale]
              const invalid = Boolean(localeErrors?.title || localeErrors?.statementMd)
              return (
                <TabsTrigger
                  key={locale}
                  value={locale}
                  data-testid={`problem-form-tab-${locale}`}
                  data-invalid={invalid}
                  className={`${PANEL_SEG_TRIGGER} data-[invalid=true]:text-destructive`}
                >
                  {t(`language.${locale}`)}
                  {invalid && <span aria-hidden="true">•</span>}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {FORM_LOCALES.map((locale) => (
            <TabsContent key={locale} value={locale} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name={`translations.${locale}.title`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={PANEL_FIELD_LABEL}>
                      {t('organizer.problemForm.titleLabel')}
                    </FormLabel>
                    <FormControl>
                      <Input data-testid={`problem-form-title-${locale}`} {...field} />
                    </FormControl>
                    <FormMessage
                      className={PANEL_FIELD_ERROR}
                      data-testid={`problem-form-title-${locale}-error`}
                    />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`translations.${locale}.statementMd`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={PANEL_FIELD_LABEL}>
                      {t('organizer.problemForm.statementLabel')}
                    </FormLabel>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormControl>
                        <Textarea
                          rows={14}
                          className={PANEL_MONO}
                          data-testid={`problem-form-statement-${locale}`}
                          {...field}
                        />
                      </FormControl>
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-xs">
                          {t('organizer.problemForm.previewHeading')}
                        </span>
                        <MarkdownPreview
                          value={field.value}
                          data-testid={`problem-form-preview-${locale}`}
                          className="min-h-40 overflow-auto rounded-md border p-3"
                        />
                      </div>
                    </div>
                    <FormMessage
                      className={PANEL_FIELD_ERROR}
                      data-testid={`problem-form-statement-${locale}-error`}
                    />
                  </FormItem>
                )}
              />
            </TabsContent>
          ))}
        </Tabs>

        <section className="flex flex-col gap-3">
          <h3 className={PANEL_SECTION_TITLE}>{t('organizer.problemForm.testCases.heading')}</h3>

          {visibility === 'practice' && (
            <p className="text-muted-foreground text-sm" data-testid="problem-form-practice-note">
              {t('organizer.problemForm.testCases.practiceNote')}
            </p>
          )}

          {testCases.length === 0 && (
            <p className="text-muted-foreground text-sm" data-testid="problem-form-cases-empty">
              {t('organizer.problemForm.testCases.empty')}
            </p>
          )}

          {testCases.map((_, index) => (
            <div
              // The rows have no identity of their own — reordering swaps the
              // values, and every field here is controlled, so the index is a
              // stable enough key.
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
              key={index}
              data-testid={`problem-form-case-${index}`}
              className="grid items-start gap-3 rounded-md border p-3 md:grid-cols-[1fr_1fr_auto_auto]"
            >
              {(['input', 'expected'] as const).map((field) => (
                <FormField
                  key={field}
                  control={form.control}
                  name={`testCases.${index}.${field}`}
                  render={({ field: controlled }) => (
                    <FormItem>
                      <FormLabel className={PANEL_FIELD_LABEL}>
                        {t(`organizer.problemForm.testCases.columns.${field}`)}
                      </FormLabel>
                      <FormControl>
                        <Input
                          className={PANEL_MONO}
                          data-testid={`problem-form-case-${index}-${field}`}
                          {...controlled}
                          onBlur={() => {
                            controlled.onBlur()
                            validateJsonFieldOnBlur(index, field)
                          }}
                        />
                      </FormControl>
                      <FormMessage
                        className={PANEL_FIELD_ERROR}
                        data-testid={`problem-form-case-${index}-${field}-error`}
                      />
                    </FormItem>
                  )}
                />
              ))}

              <FormField
                control={form.control}
                name={`testCases.${index}.hidden`}
                render={({ field }) => (
                  <FormItem className="pt-8">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`problem-form-case-${index}-hidden`}
                        data-testid={`problem-form-case-${index}-hidden`}
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                      <Label
                        htmlFor={`problem-form-case-${index}-hidden`}
                        className={PANEL_FIELD_LABEL}
                      >
                        {t('organizer.problemForm.testCases.columns.hidden')}
                      </Label>
                    </div>
                    {/* Same reason as difficulty above: a Checkbox cannot send
                        a non-boolean, but the generic path mapping can still
                        land an error here and it needs somewhere to appear. */}
                    <FormMessage
                      className={PANEL_FIELD_ERROR}
                      data-testid={`problem-form-case-${index}-hidden-error`}
                    />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-1 pt-8">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === 0}
                  aria-label={t('organizer.problemForm.testCases.moveUpAction')}
                  data-testid={`problem-form-case-${index}-up`}
                  onClick={() => updateTestCases(moveTestCase(testCases, index, 'up'))}
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === testCases.length - 1}
                  aria-label={t('organizer.problemForm.testCases.moveDownAction')}
                  data-testid={`problem-form-case-${index}-down`}
                  onClick={() => updateTestCases(moveTestCase(testCases, index, 'down'))}
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid={`problem-form-case-${index}-remove`}
                  onClick={() =>
                    updateTestCases(testCases.filter((_row, rowIndex) => rowIndex !== index))
                  }
                >
                  {t('organizer.problemForm.testCases.removeAction')}
                </Button>
              </div>
            </div>
          ))}

          {caseSectionError && (
            <p data-testid="problem-form-cases-error" className={PANEL_FIELD_ERROR}>
              {caseSectionError}
            </p>
          )}

          <div>
            <Button
              type="button"
              variant="outline"
              data-testid="problem-form-add-case"
              onClick={() => updateTestCases([...testCases, emptyTestCaseRow()])}
            >
              {t('organizer.problemForm.testCases.addAction')}
            </Button>
          </div>
        </section>

        {rootError && (
          <Alert variant="destructive" data-testid="problem-form-error">
            <AlertDescription>{rootError}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert data-testid="problem-form-success">
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-3">
          <Button
            type="button"
            data-testid="problem-form-save"
            disabled={isSubmitting}
            onClick={() => submit(validateForSave, onSave)}
          >
            {t('organizer.problemForm.saveAction')}
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* A disabled button swallows pointer events, so the tooltip
                    hangs off the wrapper; the aria-label keeps the reason
                    reachable without hovering. */}
                <span
                  data-testid="problem-form-publish-hint"
                  aria-label={publishDisabledReason ?? undefined}
                  tabIndex={publishDisabledReason ? 0 : undefined}
                  className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Button
                    type="button"
                    className={PANEL_BRAND_BUTTON}
                    data-testid="problem-form-publish"
                    disabled={isSubmitting || publishDisabledReason !== null}
                    onClick={() => submit(validateForPublish, onPublish)}
                  >
                    {t('organizer.problemForm.publishAction')}
                  </Button>
                </span>
              </TooltipTrigger>
              {publishDisabledReason && <TooltipContent>{publishDisabledReason}</TooltipContent>}
            </Tooltip>
          </TooltipProvider>
        </div>
      </form>
    </Form>
  )
}
