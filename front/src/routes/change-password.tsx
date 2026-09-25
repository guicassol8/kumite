import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CircleAlert, Info } from 'lucide-react'
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
import { PasswordInput } from '@/components/ui/password-input'
import { useSession } from '@/hooks/use-session'
import { api } from '@/lib/api'
import { requireSession } from '@/lib/route-guards'
import { refreshSession } from '@/lib/session'

// `requireSession`, not `requireAuth`: `requireAuth` redirects here when the
// account is flagged, so guarding this screen with it would loop it into
// itself. Anonymous callers still bounce to /login.
export const Route = createFileRoute('/change-password')({
  validateSearch: (search: Record<string, unknown>) =>
    z
      .object({
        // Set by `requireAuth` and by the root's subscriber when they bounce a
        // flagged account here (#190). Without it the user is dropped on a
        // screen they never asked for, mid-click, with no explanation.
        notice: z.enum(['required']).optional(),
      })
      .parse(search),
  beforeLoad: requireSession,
  component: ChangePasswordScreen,
})

type ChangePasswordFormValues = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

function useChangePasswordSchema() {
  const { t, i18n } = useTranslation()
  return useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t('auth.changePassword.errors.currentRequired')),
          newPassword: z.string().min(8, t('auth.changePassword.errors.passwordTooShort')),
          confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t('auth.changePassword.errors.passwordMismatch'),
          path: ['confirmPassword'],
        }),
    [t, i18n.language],
  )
}

function ChangePasswordScreen() {
  const { t } = useTranslation()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const { user } = useSession()
  // One screen, two modes: the forced one an organizer reset puts the account
  // in, and the ordinary "change my password" reachable from the header. Only
  // the copy and the way out differ.
  const isRequired = user?.mustChangePassword === true
  // The password changed but `/me` did not answer (#190). The form is gone at
  // this point and this is the only thing on screen, so it holds its own state
  // rather than riding on the form's.
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const schema = useChangePasswordSchema()
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  async function onSubmit(values: ChangePasswordFormValues) {
    let res: Awaited<ReturnType<(typeof api.auth)['change-password']['$post']>>
    try {
      res = await api.auth['change-password'].$post({
        json: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      })
    } catch {
      form.setError('root', { message: t('auth.changePassword.errors.unexpected') })
      return
    }

    if (res.status === 401) {
      form.setError('root', { message: t('auth.changePassword.errors.invalidCurrent') })
      return
    }
    if (res.status !== 204) {
      form.setError('root', { message: t('auth.changePassword.errors.unexpected') })
      return
    }

    // The session survives the change — only the flag moved. Refetch /me so
    // `mustChangePassword` goes down in the store too, or every guard would
    // keep bouncing the user right back here (#190). Navigating before that
    // refresh lands is exactly the bug: the home page would send them straight
    // back, over and over, with nothing to explain it.
    await settleRefresh()
  }

  // Shared by the post-204 refresh and by the retry button. The retry is of
  // the `/me` ONLY: the password has already changed, so re-posting the form
  // would answer 401 `invalid_credentials` and tell the user their current
  // password is wrong seconds after they successfully changed it.
  async function settleRefresh(): Promise<void> {
    const outcome = await refreshSession()
    if (outcome === 'ok') {
      navigate({ to: '/' })
      return
    }
    // 'unauthorized' renders nothing: the token is dead, the store went
    // anonymous and the root is already on its way to /login?notice=expired.
    // Offering a retry here would just race that navigation.
    if (outcome === 'failed') setRefreshFailed(true)
  }

  async function onRetryRefresh() {
    setRetrying(true)
    try {
      await settleRefresh()
    } finally {
      setRetrying(false)
    }
  }

  const rootError = form.formState.errors.root?.message

  // The password is already changed and the form's `currentPassword` is stale,
  // so the form comes down and the retry takes the screen. No "continue
  // anyway": that door leads to the home page with the very stale flag this
  // whole fix exists to avoid, and the guards would bounce the user back here.
  if (refreshFailed) {
    return (
      <AuthLayout title={t('auth.changePassword.title')}>
        <div className="flex flex-col gap-4">
          <Alert variant="destructive" data-testid="change-password-refresh-error">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{t('auth.changePassword.refresh.failed')}</AlertDescription>
          </Alert>
          <Button
            type="button"
            data-testid="change-password-refresh-retry"
            disabled={retrying}
            onClick={onRetryRefresh}
          >
            {retrying
              ? t('auth.changePassword.refresh.retrying')
              : t('auth.changePassword.refresh.retry')}
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('auth.changePassword.title')}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Three mutually exclusive openings, never two at once: bounced
              here by a guard, flagged but arrived on their own, or just
              changing the password voluntarily. */}
          {isRequired && search.notice === 'required' ? (
            <Alert data-testid="change-password-bounced-notice">
              <Info aria-hidden="true" />
              <AlertDescription>{t('auth.changePassword.notices.required')}</AlertDescription>
            </Alert>
          ) : isRequired ? (
            <Alert data-testid="change-password-required-notice">
              <AlertDescription>{t('auth.changePassword.requiredNotice')}</AlertDescription>
            </Alert>
          ) : (
            <p className="text-muted-foreground text-sm">{t('auth.changePassword.description')}</p>
          )}
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.changePassword.currentLabel')}</FormLabel>
                <FormControl>
                  <PasswordInput data-testid="change-password-current-input" {...field} />
                </FormControl>
                <FormMessage data-testid="change-password-current-error" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.changePassword.newLabel')}</FormLabel>
                <FormControl>
                  <PasswordInput data-testid="change-password-new-input" {...field} />
                </FormControl>
                <FormMessage data-testid="change-password-new-error" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.changePassword.confirmLabel')}</FormLabel>
                <FormControl>
                  <PasswordInput data-testid="change-password-confirm-input" {...field} />
                </FormControl>
                <FormMessage data-testid="change-password-confirm-error" />
              </FormItem>
            )}
          />
          {rootError && (
            <Alert variant="destructive" data-testid="change-password-form-error">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{rootError}</AlertDescription>
            </Alert>
          )}
          <Button
            type="submit"
            data-testid="change-password-submit-button"
            disabled={form.formState.isSubmitting}
          >
            {t('auth.changePassword.submitButton')}
          </Button>
          {/* No way back while the change is mandatory — every other
                  screen would just bounce back here anyway. */}
          {!isRequired && (
            <Button asChild type="button" variant="ghost">
              <Link to="/" data-testid="change-password-back-link">
                {t('auth.changePassword.backLink')}
              </Link>
            </Button>
          )}
        </form>
      </Form>
    </AuthLayout>
  )
}
