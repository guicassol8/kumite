import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CircleAlert } from 'lucide-react'
import { useMemo } from 'react'
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
import { setSession } from '@/lib/session'

export const Route = createFileRoute('/signup')({
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ redirect: z.string().optional() }).parse(search),
  component: SignupScreen,
})

type SignupFormValues = {
  name: string
  email: string
  password: string
  confirmPassword: string
  code: string
}

function useSignupSchema() {
  const { t, i18n } = useTranslation()
  return useMemo(
    () =>
      z
        .object({
          // Mirrors SignupBodySchema on the back: trim first, so a name made
          // of spaces neither clears the minimum nor reaches the API.
          name: z
            .string()
            .trim()
            .min(2, t('auth.signup.errors.nameTooShort'))
            .max(80, t('auth.signup.errors.nameTooLong')),
          email: z.string().email(t('auth.signup.errors.emailInvalid')),
          password: z.string().min(8, t('auth.signup.errors.passwordTooShort')),
          confirmPassword: z.string().min(1, t('auth.signup.errors.confirmPasswordRequired')),
          code: z.string().min(1, t('auth.signup.errors.codeRequired')),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t('auth.signup.errors.passwordMismatch'),
          path: ['confirmPassword'],
        }),
    [t, i18n.language],
  )
}

function isKnownField(path: string): path is 'name' | 'email' | 'password' | 'code' {
  return path === 'name' || path === 'email' || path === 'password' || path === 'code'
}

function SignupScreen() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const schema = useSignupSchema()
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', code: '' },
  })

  async function onSubmit(values: SignupFormValues) {
    const signupRes = await api.auth.signup.$post({
      json: {
        name: values.name,
        email: values.email,
        password: values.password,
        code: values.code,
      },
    })

    if (signupRes.status === 201) {
      const loginRes = await api.auth.login.$post({
        json: { email: values.email, password: values.password },
      })
      if (loginRes.status !== 200) {
        form.setError('root', { message: t('auth.signup.errors.unexpected') })
        return
      }
      const { token } = await loginRes.json()

      const meRes = await api.me.$get({}, { headers: { Authorization: `Bearer ${token}` } })
      if (meRes.status !== 200) {
        form.setError('root', { message: t('auth.signup.errors.unexpected') })
        return
      }
      const user = await meRes.json()
      setSession(user, token)
      navigate({ to: search.redirect ?? '/' })
      return
    }

    if (signupRes.status === 400) {
      const body = await signupRes.json()
      switch (body.error) {
        case 'invalid_event_code':
          form.setError('code', { message: t('auth.signup.errors.invalidCode') })
          break
        case 'invalid_email_domain':
          form.setError('email', { message: t('auth.signup.errors.invalidDomain') })
          break
        case 'signup_failed':
          form.setError('email', { message: t('auth.signup.errors.emailInUse') })
          break
        default:
          form.setError('root', { message: t('auth.signup.errors.unexpected') })
      }
      return
    }

    // Undeclared status (kata's automatic 422 validation envelope, or any
    // other unexpected response) — `signupRes` narrows to `never` here since
    // both declared statuses (201, 400) were excluded above; treat it as an
    // unknown Response. Defensive: client-side zod should already have
    // caught a validation failure before it reaches the API.
    const res = signupRes as unknown as { json: () => Promise<unknown> }
    const body = (await res.json().catch(() => null)) as {
      issues?: Record<string, { path: string }[]>
    } | null
    const issue = body?.issues?.body?.find((i) => isKnownField(i.path))
    if (issue && isKnownField(issue.path)) {
      form.setError(issue.path, { message: t('auth.signup.errors.invalidField') })
    } else {
      form.setError('root', { message: t('auth.signup.errors.unexpected') })
    }
  }

  const rootError = form.formState.errors.root?.message

  return (
    <AuthLayout
      title={t('auth.signup.title')}
      navigation={
        <span className="text-muted-foreground">
          {t('auth.signup.hasAccount')}{' '}
          <Link
            to="/login"
            search={{ redirect: search.redirect }}
            data-testid="signup-login-link"
            className="text-foreground underline-offset-4 hover:underline focus-visible:outline-ring"
          >
            {t('auth.signup.loginLink')}
          </Link>
        </span>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.signup.nameLabel')}</FormLabel>
                <FormControl>
                  <Input data-testid="signup-name-input" {...field} />
                </FormControl>
                <FormMessage data-testid="signup-name-error" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.signup.emailLabel')}</FormLabel>
                <FormControl>
                  <Input type="email" data-testid="signup-email-input" {...field} />
                </FormControl>
                <FormMessage data-testid="signup-email-error" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.signup.passwordLabel')}</FormLabel>
                <FormControl>
                  <PasswordInput data-testid="signup-password-input" {...field} />
                </FormControl>
                <FormMessage data-testid="signup-password-error" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.signup.confirmPasswordLabel')}</FormLabel>
                <FormControl>
                  <PasswordInput data-testid="signup-confirm-password-input" {...field} />
                </FormControl>
                <FormMessage data-testid="signup-confirm-password-error" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.signup.codeLabel')}</FormLabel>
                <FormControl>
                  <Input
                    className="font-mono tracking-widest"
                    data-testid="signup-code-input"
                    {...field}
                  />
                </FormControl>
                <FormMessage data-testid="signup-code-error" />
              </FormItem>
            )}
          />
          {rootError && (
            <Alert
              variant="destructive"
              className="border-destructive"
              data-testid="signup-form-error"
            >
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{rootError}</AlertDescription>
            </Alert>
          )}
          <Button
            type="submit"
            data-testid="signup-submit-button"
            disabled={form.formState.isSubmitting}
          >
            {t('auth.signup.submitButton')}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  )
}
