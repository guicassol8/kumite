import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'

export const Route = createFileRoute('/organizer/event-config')({
  component: OrganizerEventConfigScreen,
})

const EVENT_CONFIG_QUERY_KEY = ['organizer-event-config']
const EVENT_CODES_QUERY_KEY = ['organizer-event-codes']

type ApiErrorBody = {
  error?: string
  message?: string
  issues?: Record<string, { path: string; message: string }[]>
}

// The event-config PATCH declares only its 200 schema (no error map), and
// event-codes PATCH's map doesn't include kata's automatic 422 envelope
// (framework-level, ADR-0011) — so the client type never covers those
// branches. Reading the body through `unknown` sidesteps a `never`-typed
// `res` in that `else` without lying about the 200 shape.
async function readErrorBody(res: unknown): Promise<ApiErrorBody | null> {
  return (await (res as Response).json().catch(() => null)) as ApiErrorBody | null
}

async function fetchEventConfig() {
  const res = await api.organizer['event-config'].$get()
  if (!res.ok) throw new Error('failed to load event config')
  return res.json()
}

async function fetchEventCodes() {
  const res = await api.organizer['event-codes'].$get()
  if (!res.ok) throw new Error('failed to load event codes')
  return res.json()
}

type EventCode = Awaited<ReturnType<typeof fetchEventCodes>>[number]

function splitSuffixes(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function OrganizerEventConfigScreen() {
  const { t } = useTranslation()

  const config = useQuery({ queryKey: EVENT_CONFIG_QUERY_KEY, queryFn: fetchEventConfig })
  const codes = useQuery({ queryKey: EVENT_CODES_QUERY_KEY, queryFn: fetchEventCodes })

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-semibold text-xl" data-testid="event-config-heading">
        {t('organizer.eventConfig.heading')}
      </h2>

      <Card data-testid="event-config-team-rules-card">
        <CardHeader>
          <CardTitle>{t('organizer.eventConfig.teamRules.heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          {config.isPending && (
            <p data-testid="event-config-team-rules-loading">
              {t('organizer.eventConfig.loading')}
            </p>
          )}
          {config.isError && (
            <div
              data-testid="event-config-team-rules-error"
              className="flex flex-col items-start gap-2"
            >
              <p>{t('organizer.eventConfig.error.message')}</p>
              <Button
                type="button"
                variant="outline"
                data-testid="event-config-team-rules-retry"
                onClick={() => config.refetch()}
              >
                {t('organizer.eventConfig.error.retry')}
              </Button>
            </div>
          )}
          {config.data && <TeamRulesSection eventConfig={config.data} />}
        </CardContent>
      </Card>

      <Card data-testid="event-config-codes-card">
        <CardHeader>
          <CardTitle>{t('organizer.eventConfig.codes.heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          {codes.isPending && (
            <p data-testid="event-config-codes-loading">{t('organizer.eventConfig.loading')}</p>
          )}
          {codes.isError && (
            <div data-testid="event-config-codes-error" className="flex flex-col items-start gap-2">
              <p>{t('organizer.eventConfig.error.message')}</p>
              <Button
                type="button"
                variant="outline"
                data-testid="event-config-codes-retry"
                onClick={() => codes.refetch()}
              >
                {t('organizer.eventConfig.error.retry')}
              </Button>
            </div>
          )}
          {codes.data && <EventCodesSection eventCodes={codes.data} />}
        </CardContent>
      </Card>
    </div>
  )
}

type EventConfig = Awaited<ReturnType<typeof fetchEventConfig>>

function TeamRulesSection({ eventConfig }: { eventConfig: EventConfig }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [mixingConfirmNext, setMixingConfirmNext] = useState<boolean | null>(null)
  const [mixingError, setMixingError] = useState<string | undefined>(undefined)

  function invalidateConfig() {
    queryClient.invalidateQueries({ queryKey: EVENT_CONFIG_QUERY_KEY })
  }

  const updateMixing = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await api.organizer['event-config'].$patch({ json: { mixingLocked: next } })
      return res.status === 200
    },
    onSuccess: (ok) => {
      setMixingError(ok ? undefined : t('organizer.eventConfig.teamRules.errors.saveFailed'))
      invalidateConfig()
    },
    onError: () => setMixingError(t('organizer.eventConfig.teamRules.errors.saveFailed')),
  })

  function confirmMixingChange() {
    if (mixingConfirmNext !== null) updateMixing.mutate(mixingConfirmNext)
    setMixingConfirmNext(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="event-config-mixing-switch">
            {t('organizer.eventConfig.teamRules.mixingLabel')}
          </Label>
          <p className="text-muted-foreground text-sm">
            {t('organizer.eventConfig.teamRules.mixingDescription')}
          </p>
        </div>
        <Switch
          id="event-config-mixing-switch"
          data-testid="event-config-mixing-switch"
          checked={eventConfig.mixingLocked}
          onCheckedChange={(next) => setMixingConfirmNext(next)}
        />
      </div>

      {mixingError && (
        <Alert variant="destructive" data-testid="event-config-mixing-error">
          <AlertDescription>{mixingError}</AlertDescription>
        </Alert>
      )}

      <MaxTeamSizeForm eventConfig={eventConfig} onSaved={invalidateConfig} />

      <AlertDialog
        open={mixingConfirmNext !== null}
        onOpenChange={(next) => !next && setMixingConfirmNext(null)}
      >
        <AlertDialogContent data-testid="event-config-mixing-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                mixingConfirmNext
                  ? 'organizer.eventConfig.teamRules.mixingDialog.titleLock'
                  : 'organizer.eventConfig.teamRules.mixingDialog.titleUnlock',
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('organizer.eventConfig.teamRules.mixingDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="event-config-mixing-confirm-cancel">
              {t('organizer.eventConfig.teamRules.mixingDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="event-config-mixing-confirm-confirm"
              onClick={confirmMixingChange}
            >
              {t('organizer.eventConfig.teamRules.mixingDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

type MaxTeamSizeFormValues = { maxTeamSize: number }

function MaxTeamSizeForm({
  eventConfig,
  onSaved,
}: {
  eventConfig: EventConfig
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [savedMessageVisible, setSavedMessageVisible] = useState(false)

  const schema = useMemo(
    () =>
      z.object({
        maxTeamSize: z
          .number({
            invalid_type_error: t('organizer.eventConfig.teamRules.errors.maxTeamSizeInvalid'),
          })
          .int(t('organizer.eventConfig.teamRules.errors.maxTeamSizeInvalid'))
          .positive(t('organizer.eventConfig.teamRules.errors.maxTeamSizeInvalid')),
      }),
    [t],
  )

  const form = useForm<MaxTeamSizeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { maxTeamSize: eventConfig.maxTeamSize },
  })

  useEffect(() => {
    form.reset({ maxTeamSize: eventConfig.maxTeamSize })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventConfig.maxTeamSize])

  async function onSubmit(values: MaxTeamSizeFormValues) {
    setSavedMessageVisible(false)
    const res = await api.organizer['event-config'].$patch({
      json: { maxTeamSize: values.maxTeamSize },
    })
    if (res.status === 200) {
      onSaved()
      setSavedMessageVisible(true)
      return
    }

    const body = await readErrorBody(res)
    const fieldIssue = body?.issues?.body?.find((issue) => issue.path === 'maxTeamSize')
    if (fieldIssue) {
      form.setError('maxTeamSize', { message: fieldIssue.message })
      return
    }
    form.setError('root', { message: t('organizer.eventConfig.teamRules.errors.saveFailed') })
  }

  const rootError = form.formState.errors.root?.message

  return (
    <Form {...form}>
      <form
        data-testid="event-config-max-team-size-form"
        className="flex flex-col gap-3"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="maxTeamSize"
          render={({ field }) => (
            <FormItem className="w-48">
              <FormLabel>{t('organizer.eventConfig.teamRules.maxTeamSizeLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  data-testid="event-config-max-team-size-input"
                  value={field.value}
                  onChange={(event) => {
                    setSavedMessageVisible(false)
                    field.onChange(event.target.valueAsNumber)
                  }}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage data-testid="event-config-max-team-size-error" />
            </FormItem>
          )}
        />

        {rootError && (
          <Alert variant="destructive" data-testid="event-config-max-team-size-root-error">
            <AlertDescription>{rootError}</AlertDescription>
          </Alert>
        )}

        {savedMessageVisible && (
          <p
            className="text-muted-foreground text-sm"
            data-testid="event-config-max-team-size-saved"
          >
            {t('organizer.eventConfig.teamRules.savedMessage')}
          </p>
        )}

        <div>
          <Button type="submit" data-testid="event-config-max-team-size-save">
            {t('organizer.eventConfig.teamRules.saveAction')}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function EventCodesSection({ eventCodes }: { eventCodes: EventCode[] }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<EventCode | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <Table data-testid="event-config-codes-table">
        <TableHeader>
          <TableRow>
            <TableHead>{t('organizer.eventConfig.codes.columns.university')}</TableHead>
            <TableHead>{t('organizer.eventConfig.codes.columns.code')}</TableHead>
            <TableHead>{t('organizer.eventConfig.codes.columns.suffixes')}</TableHead>
            <TableHead>{t('organizer.eventConfig.codes.columns.active')}</TableHead>
            <TableHead>{t('organizer.eventConfig.codes.columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {eventCodes.map((eventCode) => (
            <TableRow
              key={eventCode.university}
              data-testid={`event-config-codes-row-${eventCode.university}`}
            >
              <TableCell>{t(`teams.university.${eventCode.university}`)}</TableCell>
              <TableCell>{eventCode.code}</TableCell>
              <TableCell>{eventCode.allowedEmailSuffixes.join(', ')}</TableCell>
              <TableCell>
                <Badge variant={eventCode.active ? 'default' : 'outline'}>
                  {t(
                    eventCode.active
                      ? 'organizer.eventConfig.codes.activeYes'
                      : 'organizer.eventConfig.codes.activeNo',
                  )}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid={`event-config-codes-edit-${eventCode.university}`}
                  onClick={() => setEditing(eventCode)}
                >
                  {t('organizer.eventConfig.codes.editAction')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <EditEventCodeDialog eventCode={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

type EditEventCodeFormValues = { code: string; suffixes: string; active: boolean }

function EditEventCodeDialog({
  eventCode,
  onClose,
}: {
  eventCode: EventCode | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const schema = useMemo(
    () =>
      z.object({
        code: z.string().min(1, t('organizer.eventConfig.codes.errors.codeRequired')),
        suffixes: z.string().refine((value) => splitSuffixes(value).length > 0, {
          message: t('organizer.eventConfig.codes.errors.suffixesRequired'),
        }),
        active: z.boolean(),
      }),
    [t],
  )

  const form = useForm<EditEventCodeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', suffixes: '', active: true },
  })

  useEffect(() => {
    if (eventCode) {
      form.reset({
        code: eventCode.code,
        suffixes: eventCode.allowedEmailSuffixes.join('\n'),
        active: eventCode.active,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCode])

  async function onSubmit(values: EditEventCodeFormValues) {
    if (!eventCode) return

    const res = await api.organizer['event-codes'][':university'].$patch({
      param: { university: eventCode.university },
      json: {
        code: values.code,
        allowedEmailSuffixes: splitSuffixes(values.suffixes),
        active: values.active,
      },
    })

    if (res.status === 200) {
      queryClient.invalidateQueries({ queryKey: EVENT_CODES_QUERY_KEY })
      onClose()
      return
    }

    if (res.status === 409) {
      form.setError('code', { message: t('organizer.eventConfig.codes.errors.codeTaken') })
      return
    }

    const body = await readErrorBody(res)
    const issues = body?.issues?.body ?? []
    let mapped = false
    for (const issue of issues) {
      if (issue.path === 'code') {
        form.setError('code', { message: issue.message })
        mapped = true
      } else if (issue.path === 'active') {
        form.setError('active', { message: issue.message })
        mapped = true
      } else if (
        issue.path === 'allowedEmailSuffixes' ||
        issue.path.startsWith('allowedEmailSuffixes[')
      ) {
        form.setError('suffixes', { message: issue.message })
        mapped = true
      }
    }
    if (!mapped) {
      form.setError('root', { message: t('organizer.eventConfig.codes.errors.saveFailed') })
    }
  }

  const rootError = form.formState.errors.root?.message

  return (
    <Dialog open={eventCode !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="event-config-codes-edit-dialog">
        <DialogHeader>
          <DialogTitle>{t('organizer.eventConfig.codes.dialog.title')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('organizer.eventConfig.codes.dialog.codeLabel')}</FormLabel>
                  <FormControl>
                    <Input data-testid="event-config-codes-edit-code" {...field} />
                  </FormControl>
                  <FormMessage data-testid="event-config-codes-edit-code-error" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="suffixes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('organizer.eventConfig.codes.dialog.suffixesLabel')}</FormLabel>
                  <FormControl>
                    <Textarea data-testid="event-config-codes-edit-suffixes" {...field} />
                  </FormControl>
                  <FormMessage data-testid="event-config-codes-edit-suffixes-error" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        data-testid="event-config-codes-edit-active"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      {t('organizer.eventConfig.codes.dialog.activeLabel')}
                    </FormLabel>
                  </div>
                  <FormMessage data-testid="event-config-codes-edit-active-error" />
                </FormItem>
              )}
            />

            {rootError && (
              <Alert variant="destructive" data-testid="event-config-codes-edit-error">
                <AlertDescription>{rootError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                data-testid="event-config-codes-edit-cancel"
                onClick={onClose}
              >
                {t('organizer.eventConfig.codes.dialog.cancel')}
              </Button>
              <Button type="submit" data-testid="event-config-codes-edit-save">
                {t('organizer.eventConfig.codes.dialog.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
