import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CircleAlert, Info } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { AuthLayout } from '@/components/auth-layout'
import { Mark } from '@/components/brand'
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
    <AuthLayout
      title={t('auth.login.title')}
      description={t('auth.login.description')}
      poster={
        <aside
          data-testid="login-poster"
          className="flex w-full flex-col justify-between gap-12 p-14"
        >
          <Mark className="size-28" data-testid="login-poster-mark" />
          <div>
            <p className="font-display font-bold text-6xl uppercase leading-none">
              {t('auth.login.poster.pucrs')} <span className="text-brand-on-chrome">×</span>{' '}
              {t('auth.login.poster.merida')}
              <br />
              {t('auth.login.poster.title')}
            </p>
            <p className="mt-5 max-w-sm text-chrome-muted text-sm leading-relaxed">
              {t('auth.login.poster.support')}
            </p>
          </div>
          <p className="font-display font-semibold text-chrome-muted text-xs uppercase tracking-widest">
            {t('auth.login.poster.event')}
          </p>
        </aside>
      }
      navigation={
        <>
          <Link
            to="/reset-password"
            data-testid="login-forgot-password-link"
            className="text-muted-foreground underline underline-offset-4 focus-visible:outline-ring"
          >
            {t('auth.login.forgotPasswordLink')}
          </Link>
          <span className="text-muted-foreground">
            {t('auth.login.noAccount')}{' '}
            <Link
              to="/signup"
              search={{ redirect: search.redirect }}
              data-testid="login-signup-link"
              className="text-foreground underline-offset-4 hover:underline focus-visible:outline-ring"
            >
              {t('auth.login.signupLink')}
            </Link>
          </span>
        </>
      }
    >
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
              <CircleAlert aria-hidden="true" />
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
        </form>
      </Form>
    </AuthLayout>
  )
}
