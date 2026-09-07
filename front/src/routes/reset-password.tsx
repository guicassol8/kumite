import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

type ResetPasswordFormValues = {
  email: string
  otp: string
  newPassword: string
  confirmPassword: string
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
  const { t } = useTranslation()
  const [succeeded, setSucceeded] = useState(false)
  const schema = useResetPasswordSchema()
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', otp: '', newPassword: '', confirmPassword: '' },
  })

  async function onSubmit(values: ResetPasswordFormValues) {
    const res = await api.auth['complete-password-reset'].$post({
      json: { email: values.email, otp: values.otp, newPassword: values.newPassword },
    })

    if (res.status !== 204) {
      // Single generic error, never field-level — mirrors the back's
      // non-oracle design (unknown email, wrong/expired code, and an
      // exhausted attempt count all look identical).
      form.setError('root', { message: t('auth.resetPassword.errors.invalidOtp') })
      return
    }

    setSucceeded(true)
  }

  const rootError = form.formState.errors.root?.message

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.resetPassword.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {succeeded ? (
            <div className="flex flex-col gap-4" data-testid="reset-password-success">
              <p>{t('auth.resetPassword.successMessage')}</p>
              <Button asChild>
                <Link to="/login" data-testid="reset-password-login-link">
                  {t('auth.resetPassword.successLoginLink')}
                </Link>
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
                        <Input
                          inputMode="numeric"
                          data-testid="reset-password-otp-input"
                          {...field}
                        />
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
                        <PasswordInput
                          data-testid="reset-password-confirm-password-input"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage data-testid="reset-password-confirm-password-error" />
                    </FormItem>
                  )}
                />
                {rootError && (
                  <Alert variant="destructive" data-testid="reset-password-form-error">
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
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
