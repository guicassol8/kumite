import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Info } from 'lucide-react'
import { useMemo } from 'react'
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
import { setSession } from '@/lib/session'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) =>
    z
      .object({
        redirect: z.string().optional(),
        // Set by the root when hydration finds the stored token dead (#179).
        // Without it the user is dropped on a login form with no idea why the
        // app stopped trusting them.
        notice: z.enum(['expired']).optional(),
      })
      .parse(search),
  component: LoginScreen,
})

type LoginFormValues = {
  email: string
  password: string
}

function useLoginSchema() {
  const { t, i18n } = useTranslation()
  return useMemo(
    () =>
      z.object({
        email: z.string().email(t('auth.login.errors.emailInvalid')),
        password: z.string().min(1, t('auth.login.errors.passwordRequired')),
      }),
    [t, i18n.language],
  )
}

function LoginScreen() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const schema = useLoginSchema()
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginFormValues) {
    const res = await api.auth.login.$post({ json: values })

    if (res.status !== 200) {
      // 401 is intentionally a single generic error, never field-level — it
      // matches the back's non-oracle design (unknown email and wrong
      // password look identical).
      form.setError('root', { message: t('auth.login.errors.invalidCredentials') })
      return
    }

    const { token } = await res.json()
    const meRes = await api.me.$get({}, { headers: { Authorization: `Bearer ${token}` } })
    if (meRes.status !== 200) {
      form.setError('root', { message: t('auth.login.errors.invalidCredentials') })
      return
    }
    const user = await meRes.json()
    setSession(user, token)
    // Signing in with an organizer-issued temporary password (#143) goes
    // straight to the change screen — `search.redirect` would only land on a
    // page the back is going to 403 anyway.
    if (user.mustChangePassword) {
      navigate({ to: '/change-password' })
      return
    }
    navigate({ to: search.redirect ?? '/' })
  }

  const rootError = form.formState.errors.root?.message

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.login.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              {search.notice === 'expired' && (
                <Alert data-testid="login-expired-notice">
                  {/* Without the icon the bordered box reads as one more empty
                      input sitting above the email field. */}
                  <Info />
                  <AlertDescription>{t('auth.login.notices.expired')}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.login.emailLabel')}</FormLabel>
                    <FormControl>
                      <Input type="email" data-testid="login-email-input" {...field} />
                    </FormControl>
                    <FormMessage data-testid="login-email-error" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.login.passwordLabel')}</FormLabel>
                    <FormControl>
                      <PasswordInput data-testid="login-password-input" {...field} />
                    </FormControl>
                    <FormMessage data-testid="login-password-error" />
                  </FormItem>
                )}
              />
              {rootError && (
                <Alert variant="destructive" data-testid="login-form-error">
                  <AlertDescription>{rootError}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                data-testid="login-submit-button"
                disabled={form.formState.isSubmitting}
              >
                {t('auth.login.submitButton')}
              </Button>
              <Link
                to="/reset-password"
                data-testid="login-forgot-password-link"
                className="text-center text-muted-foreground text-sm underline-offset-4 hover:underline"
              >
                {t('auth.login.forgotPasswordLink')}
              </Link>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  )
}
