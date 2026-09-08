import { useState } from 'react'
import { type FieldPath, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { MarkdownPreview } from '@/components/markdown-preview'
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
import {
  type Difficulty,
  emptyTestCaseRow,
  FORM_LOCALES,
  type JsonFieldName,
  moveTestCase,
  type ProblemFormError,
  type ProblemFormValues,
  type ProblemStatus,
  parseJsonField,
  validateForPublish,
  validateForSave,
} from '@/lib/problem-form'
import type { UiLocale } from '@/lib/resolve-problem-title'

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']

type ProblemFormProps = {
  initialValues: ProblemFormValues
  savedLocales: UiLocale[]
  /** `undefined` while the problem has not been created yet (the /new route). */
  status?: ProblemStatus
  isSubmitting?: boolean
  rootError?: string
  successMessage?: string
  onSave: (values: ProblemFormValues) => void
  onPublish: (values: ProblemFormValues) => void
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
  const errors = form.formState.errors

  function messageFor(error: ProblemFormError): string {
    switch (error.kind) {
      case 'pointsInvalid':
        return t('organizer.problemForm.errors.pointsInvalid')
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
      if (error.kind === 'pointsInvalid') {
        form.setError('points', { message: messageFor(error) })
        continue
      }
      if (error.kind === 'publishMissingVisibleCase' || error.kind === 'publishMissingHiddenCase') {
        sectionMessages.push(messageFor(error))
        continue
      }
      if (error.kind === 'json') {
        form.setError(jsonFieldName(error.index, error.field), { message: messageFor(error) })
        continue
      }
      form.setError(`translations.${error.locale}.${error.field}`, { message: messageFor(error) })
      firstErroredLocale ??= error.locale
    }

    setCaseSectionError(sectionMessages.length > 0 ? sectionMessages.join(' ') : null)
    if (firstErroredLocale) setActiveLocale(firstErroredLocale)
  }

  function submit(validate: typeof validateForSave, handler: (values: ProblemFormValues) => void) {
    const values = form.getValues()
    const validationErrors = validate(values, savedLocales)
    if (validationErrors.length > 0) {
      applyErrors(validationErrors)
      return
    }
    form.clearErrors()
    setCaseSectionError(null)
    handler(values)
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
        <div className="flex flex-wrap items-end gap-4">
          <FormField
            control={form.control}
            name="difficulty"
            render={({ field }) => (
              <FormItem className="w-40">
                <FormLabel>{t('organizer.problemForm.difficultyLabel')}</FormLabel>
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
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="points"
            render={({ field }) => (
              <FormItem className="w-32">
                <FormLabel>{t('organizer.problemForm.pointsLabel')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    data-testid="problem-form-points"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage data-testid="problem-form-points-error" />
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
          <TabsList>
            {FORM_LOCALES.map((locale) => {
              const localeErrors = errors.translations?.[locale]
              const invalid = Boolean(localeErrors?.title || localeErrors?.statementMd)
              return (
                <TabsTrigger
                  key={locale}
                  value={locale}
                  data-testid={`problem-form-tab-${locale}`}
                  data-invalid={invalid}
                  className="data-[invalid=true]:text-destructive"
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
                    <FormLabel>{t('organizer.problemForm.titleLabel')}</FormLabel>
                    <FormControl>
                      <Input data-testid={`problem-form-title-${locale}`} {...field} />
                    </FormControl>
                    <FormMessage data-testid={`problem-form-title-${locale}-error`} />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`translations.${locale}.statementMd`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('organizer.problemForm.statementLabel')}</FormLabel>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormControl>
                        <Textarea
                          rows={14}
                          className="font-mono text-sm"
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
                    <FormMessage data-testid={`problem-form-statement-${locale}-error`} />
                  </FormItem>
                )}
              />
            </TabsContent>
          ))}
        </Tabs>

        <section className="flex flex-col gap-3">
          <h3 className="font-semibold text-lg">{t('organizer.problemForm.testCases.heading')}</h3>

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
                      <FormLabel>{t(`organizer.problemForm.testCases.columns.${field}`)}</FormLabel>
                      <FormControl>
                        <Input
                          className="font-mono text-sm"
                          data-testid={`problem-form-case-${index}-${field}`}
                          {...controlled}
                          onBlur={() => {
                            controlled.onBlur()
                            validateJsonFieldOnBlur(index, field)
                          }}
                        />
                      </FormControl>
                      <FormMessage data-testid={`problem-form-case-${index}-${field}-error`} />
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
                      <Label htmlFor={`problem-form-case-${index}-hidden`}>
                        {t('organizer.problemForm.testCases.columns.hidden')}
                      </Label>
                    </div>
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
                  ↑
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
                  ↓
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
            <p data-testid="problem-form-cases-error" className="text-destructive text-sm">
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
                    variant="secondary"
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
