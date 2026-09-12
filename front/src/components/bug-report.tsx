import { zodResolver } from '@hookform/resolvers/zod'
import { useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useSession } from '@/hooks/use-session'
import { api } from '@/lib/api'

// Mirrors CreateBugReportBodySchema's ceiling in the back — over it the API
// answers 422, so the counter and the client-side check use the same number.
const MAX_DESCRIPTION = 2000

// Never translated, only interpolated — same rule as footer.tsx.
const CONTACT_EMAIL = 'ligadealgoritmos@gmail.com'

type BugReportFormValues = {
  description: string
  replyTo: string
}

function useBugReportSchema() {
  const { t, i18n } = useTranslation()
  return useMemo(
    () =>
      z.object({
        description: z
          .string()
          .trim()
          .min(1, t('bugReport.validation.descriptionRequired'))
          .max(
            MAX_DESCRIPTION,
            t('bugReport.validation.descriptionTooLong', { max: MAX_DESCRIPTION }),
          ),
        // Optional, so an empty string has to pass — only an actual value is
        // held to being an address.
        replyTo: z
          .string()
          .trim()
          .refine((value) => value === '' || z.string().email().safeParse(value).success, {
            message: t('bugReport.validation.emailInvalid'),
          }),
      }),
    [t, i18n.language],
  )
}

/**
 * The floating "report a bug" trigger and its dialog, mounted once in
 * `__root.tsx` so it is reachable from every route — including
 * `/change-password`, where #143 parks anyone on a temporary password: the
 * person who cannot get in is exactly the one with something to report.
 *
 * Only the dialog lives here — the trigger(s) are `children`, so the header
 * (#217) can render as many `<DialogTrigger asChild>` as it needs (one icon
 * button on desktop). `open`/`onOpenChange` are controlled by the caller
 * rather than owned here: the mobile menu row can't be a `<DialogTrigger>`
 * of its own — it lives inside a `<SheetContent>`, and Sheet is built on the
 * very same Radix `Dialog` primitive, so a `Dialog.Trigger` nested inside it
 * binds to the Sheet's own context (the nearest `Dialog.Root`) instead of
 * this one. The mobile row is a plain button that calls `onOpenChange(true)`
 * directly after closing the sheet, and both triggers end up driving the
 * same controlled `open` state.
 *
 * Mounted once inside the header, which itself lives in `__root.tsx`, so the
 * trigger exists on every route and the draft survives closing the dialog
 * (#145): the component never unmounts, so closing and reopening it keeps
 * what was typed. Only a successful send clears it.
 */
export function BugReport({
  open,
  onOpenChange: setOpen,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const { user } = useSession()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [sent, setSent] = useState(false)
  const schema = useBugReportSchema()

  const form = useForm<BugReportFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', replyTo: '' },
  })

  // The session's address is a starting point, not a lock: it fills the field
  // the first time the dialog opens and stays editable afterwards.
  function onOpenChange(next: boolean) {
    if (next) {
      setSent(false)
      if (user?.email && form.getValues('replyTo') === '') {
        form.setValue('replyTo', user.email)
      }
    }
    setOpen(next)
  }

  const description = form.watch('description') ?? ''

  async function onSubmit(values: BugReportFormValues) {
    const replyTo = values.replyTo.trim()

    try {
      const res = await api['bug-reports'].$post({
        json: {
          description: values.description.trim(),
          ...(replyTo === '' ? {} : { replyTo }),
          // Attached automatically — never editable fields of the form.
          context: {
            route: pathname,
            userAgent: navigator.userAgent,
            occurredAt: new Date().toISOString(),
            ...(user ? { userEmail: user.email, userId: user.id } : {}),
          },
        },
      })

      if (res.status === 200) {
        form.reset({ description: '', replyTo })
        setSent(true)
        return
      }

      if (res.status === 429) {
        form.setError('root', { message: t('bugReport.errors.throttled') })
        return
      }

      // 422 is not in the route's `output`, so comparing res.status to it
      // directly is a TS2367 ("no overlap") — the coerced number is what
      // makes kata's validation envelope reachable from the typed client.
      if ((res.status as number) === 422) {
        form.setError('root', { message: t('bugReport.errors.validation') })
        return
      }

      form.setError('root', { message: t('bugReport.errors.unexpected') })
    } catch {
      // Network failure, or the API being down — the same dead end for the
      // person reporting, and the same fallback address.
      form.setError('root', { message: t('bugReport.errors.unexpected') })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}

      <DialogContent data-testid="bug-report-dialog">
        <DialogHeader>
          <DialogTitle>{sent ? t('bugReport.success.title') : t('bugReport.title')}</DialogTitle>
          <DialogDescription>
            {sent ? t('bugReport.success.body') : t('bugReport.intro')}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <DialogFooter>
            <Button data-testid="bug-report-close" onClick={() => setOpen(false)}>
              {t('bugReport.close')}
            </Button>
          </DialogFooter>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bugReport.descriptionLabel')}</FormLabel>
                    <FormControl>
                      <Textarea
                        data-testid="bug-report-description"
                        rows={5}
                        maxLength={MAX_DESCRIPTION}
                        placeholder={t('bugReport.descriptionPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription data-testid="bug-report-counter">
                      {/* `current`, not `count`: i18next reads `count` as a
                          plural selector and would look for counter_one /
                          counter_other instead of interpolating. */}
                      {t('bugReport.counter', {
                        current: description.length,
                        max: MAX_DESCRIPTION,
                      })}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="replyTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('bugReport.emailLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="bug-report-email"
                        type="email"
                        placeholder={t('bugReport.emailPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>{t('bugReport.emailHelp')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <Alert variant="destructive" data-testid="bug-report-error">
                  <AlertDescription>
                    {form.formState.errors.root.message}{' '}
                    {t('bugReport.errors.contactFallback', { email: CONTACT_EMAIL })}
                  </AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="bug-report-cancel"
                  onClick={() => setOpen(false)}
                >
                  {t('bugReport.cancel')}
                </Button>
                <Button
                  type="submit"
                  data-testid="bug-report-submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? t('bugReport.submitting') : t('bugReport.submit')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
