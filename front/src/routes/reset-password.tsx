import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CircleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { AuthLayout } from '@/components/auth-layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { api } from '@/lib/api'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordScreen,
})

// Narrows i18next's free-form language string to the back's Locale enum
// (#231) — the back has no `locale` column on `users`, so the reset email
// speaks whatever the requester's UI was set to when they asked.
function toApiLocale(language: string): 'pt' | 'es' | 'en' {
  return language === 'es' || language === 'en' ? language : 'pt'
}

type RequestFormValues = {
  email: string
}

type ResetPasswordFormValues = {
  email: string
  otp: string
  newPassword: string
  confirmPassword: string
}

function useRequestSchema() {
  const { t, i18n } = useTranslation()
  return useMemo(
    () =>
      z.object({
        email: z.string().email(t('auth.resetPassword.errors.emailInvalid')),
      }),
    [t, i18n.language],
  )
}

function useResetPasswordSchema() {
  const { t, i18n } = useTranslation()
  return useMemo(
    () =>
      z
        .object({
          email: z.string().email(t('auth.resetPassword.errors.emailInvalid')),
          otp: z.string().regex(/^\d{6}$/, t('auth.resetPassword.errors.otpInvalid')),
          newPassword: z.string().min(8, t('auth.resetPassword.errors.passwordTooShort')),
          confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t('auth.resetPassword.errors.passwordMismatch'),
          path: ['confirmPassword'],
        }),
    [t, i18n.language],
  )
}

function ResetPasswordScreen() {
  const { t, i18n } = useTranslation()
  // Two steps in one screen: ask for a code, then spend it. `sentTo` is what
  // step 2 echoes back — the email the code actually went to, which the user
  // may still edit in the form below it.
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [succeeded, setSucceeded] = useState(false)
  const requestSchema = useRequestSchema()
  const schema = useResetPasswordSchema()
  const requestForm = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' },
  })
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', otp: '', newPassword: '', confirmPassword: '' },
  })

  async function onRequestSubmit(values: RequestFormValues) {
    try {
      const res = await api.auth['request-password-reset'].$post({
        json: {
          email: values.email,
          locale: toApiLocale(i18n.resolvedLanguage ?? i18n.language),
        },
      })
      if (res.status !== 204) {
        requestForm.setError('root', {
          message: t('auth.resetPassword.request.errors.unexpected'),
        })
        return
      }
    } catch {
      requestForm.setError('root', { message: t('auth.resetPassword.request.errors.unexpected') })
      return
    }

    // The back answers 204 for unregistered emails too (no oracle), so this
    // says the code was sent, never that the account exists.
    form.setValue('email', values.email)
    setSentTo(values.email)
  }

  async function onSubmit(values: ResetPasswordFormValues) {
    // #195: a failure that is not the code's fault — a dead network, a 5xx —
    // says so, and the form keeps every field, so retrying is one click with
    // the same code. Calling it "invalid code" would send the user off to
    // request a new one while the one they have is still good.
    try {
      const res = await api.auth['complete-password-reset'].$post({
        json: { email: values.email, otp: values.otp, newPassword: values.newPassword },
      })

      if (res.status === 204) {
        setSucceeded(true)
        return
      }

      if (res.status === 400) {
        // Single generic error, never field-level — mirrors the back's
        // non-oracle design (unknown email, wrong/expired code, and an
        // exhausted attempt count all look identical).
        form.setError('root', { message: t('auth.resetPassword.errors.invalidOtp') })
        return
      }
    } catch {
      // Falls through: react-hook-form rethrows whatever escapes onSubmit, so
      // without this catch the rejection went unhandled with nothing on screen.
    }

    form.setError('root', { message: t('auth.resetPassword.errors.unexpected') })
  }

  const requestError = requestForm.formState.errors.root?.message
  const rootError = form.formState.errors.root?.message

  return (
    <AuthLayout title={t('auth.resetPassword.title')}>
      {succeeded ? (
        <div className="flex flex-col gap-4" data-testid="reset-password-success">
          <p>{t('auth.resetPassword.successMessage')}</p>
          <Button asChild>
            <Link to="/login" data-testid="reset-password-login-link">
              {t('auth.resetPassword.successLoginLink')}
            </Link>
          </Button>
        </div>
      ) : sentTo === null ? (
        <Form {...requestForm}>
          <form
            onSubmit={requestForm.handleSubmit(onRequestSubmit)}
            className="flex flex-col gap-4"
          >
            <p className="text-muted-foreground text-sm">
              {t('auth.resetPassword.request.description')}
            </p>
            <FormField
              control={requestForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.resetPassword.request.emailLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      data-testid="reset-password-request-email-input"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage data-testid="reset-password-request-email-error" />
                </FormItem>
              )}
            />
            {requestError && (
              <Alert variant="destructive" data-testid="reset-password-request-error">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{requestError}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              data-testid="reset-password-request-submit"
              disabled={requestForm.formState.isSubmitting}
            >
              {t('auth.resetPassword.request.submitButton')}
            </Button>
          </form>
        </Form>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Alert data-testid="reset-password-request-sent">
              <AlertDescription>
                {t('auth.resetPassword.request.sentMessage', { email: sentTo })}
              </AlertDescription>
            </Alert>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.resetPassword.emailLabel')}</FormLabel>
                  <FormControl>
                    <Input type="email" data-testid="reset-password-email-input" {...field} />
                  </FormControl>
                  <FormMessage data-testid="reset-password-email-error" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.resetPassword.otpLabel')}</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" data-testid="reset-password-otp-input" {...field} />
                  </FormControl>
                  <FormMessage data-testid="reset-password-otp-error" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.resetPassword.newPasswordLabel')}</FormLabel>
                  <FormControl>
                    <PasswordInput data-testid="reset-password-new-password-input" {...field} />
                  </FormControl>
                  <FormMessage data-testid="reset-password-new-password-error" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.resetPassword.confirmPasswordLabel')}</FormLabel>
                  <FormControl>
                    <PasswordInput data-testid="reset-password-confirm-password-input" {...field} />
                  </FormControl>
                  <FormMessage data-testid="reset-password-confirm-password-error" />
                </FormItem>
              )}
            />
            {rootError && (
              <Alert variant="destructive" data-testid="reset-password-form-error">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{rootError}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              data-testid="reset-password-submit-button"
              disabled={form.formState.isSubmitting}
            >
              {t('auth.resetPassword.submitButton')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              data-testid="reset-password-request-back"
              onClick={() => setSentTo(null)}
            >
              {t('auth.resetPassword.request.backButton')}
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  )
}
