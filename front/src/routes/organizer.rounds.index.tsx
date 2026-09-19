import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PANEL_BRAND_BUTTON,
  PANEL_DIALOG_TITLE,
  PANEL_FIELD_ERROR,
  PANEL_FIELD_LABEL,
} from '@/components/organizer/panel-form'
import { PanelTable } from '@/components/organizer/panel-table'
import { RoundCountdown } from '@/components/round-countdown'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useRoundStream } from '@/hooks/use-round-stream'
import { formatDate } from '@/i18n/format'
import { api } from '@/lib/api'

export const Route = createFileRoute('/organizer/rounds/')({
  component: OrganizerRoundsList,
})

const ORGANIZER_ROUNDS_QUERY_KEY = ['organizer-rounds']

// The back only says *why* a round action was refused (rounds.service.ts);
// the front turns that reason into a sentence for the action-error banner.
const ACTION_ERROR_KEYS: Record<string, string> = {
  another_round_open: 'organizer.rounds.actionError.anotherRoundOpen',
  round_not_draft: 'organizer.rounds.actionError.roundNotDraft',
  round_not_open: 'organizer.rounds.actionError.roundNotOpen',
  no_problems: 'organizer.rounds.actionError.noProblems',
  not_found: 'organizer.rounds.actionError.notFound',
}

async function fetchOrganizerRounds() {
  const res = await api.organizer.rounds.$get()
  if (!res.ok) throw new Error('failed to load rounds')
  return res.json()
}

type RoundSummary = Awaited<ReturnType<typeof fetchOrganizerRounds>>[number]

function OrganizerRoundsList() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [openTargetId, setOpenTargetId] = useState<string | null>(null)
  const [closeTargetId, setCloseTargetId] = useState<string | null>(null)
  const [extendTargetId, setExtendTargetId] = useState<string | null>(null)
  const [extendMinutes, setExtendMinutes] = useState('')
  const [extendMinutesError, setExtendMinutesError] = useState<string | null>(null)
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null)

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ORGANIZER_ROUNDS_QUERY_KEY })
  }, [queryClient])
  const eventStream = useRoundStream()
  // round.opened/round.closed on the app-wide stream (#217) refetch the list
  // the same way a mutation's `onSettled: invalidate` does; the ref skips the
  // value already seen on mount instead of invalidating on first render.
  const lastRoundChangeRef = useRef(eventStream.roundChangedAt)
  useEffect(() => {
    if (eventStream.roundChangedAt === lastRoundChangeRef.current) return
    lastRoundChangeRef.current = eventStream.roundChangedAt
    invalidate()
  }, [eventStream.roundChangedAt, invalidate])

  const rounds = useQuery({
    queryKey: ORGANIZER_ROUNDS_QUERY_KEY,
    queryFn: fetchOrganizerRounds,
  })

  const openRound = rounds.data?.find((round) => round.status === 'open')
  const anotherRoundOpenId = openRound?.id ?? eventStream.currentRoundId
  const anotherRoundOpenName =
    openRound?.name ?? rounds.data?.find((round) => round.id === eventStream.currentRoundId)?.name

  const open = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.organizer.rounds[':id'].open.$post({ param: { id } })
      if (res.status === 200) return null
      const body = await res.json().catch(() => null)
      return ACTION_ERROR_KEYS[body?.error ?? ''] ?? 'organizer.rounds.actionError.unexpected'
    },
    onSuccess: (errorKey) => setActionErrorKey(errorKey),
    onError: () => setActionErrorKey('organizer.rounds.actionError.unexpected'),
    onSettled: invalidate,
  })

  const extend = useMutation({
    mutationFn: async ({ id, minutes }: { id: string; minutes: number }) => {
      const res = await api.organizer.rounds[':id'].extend.$post({
        param: { id },
        json: { minutes },
      })
      if (res.status === 200) return null
      const body = await res.json().catch(() => null)
      return ACTION_ERROR_KEYS[body?.error ?? ''] ?? 'organizer.rounds.actionError.unexpected'
    },
    onSuccess: (errorKey) => setActionErrorKey(errorKey),
    onError: () => setActionErrorKey('organizer.rounds.actionError.unexpected'),
    onSettled: invalidate,
  })

  const close = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.organizer.rounds[':id'].close.$post({ param: { id } })
      if (res.status === 200) return null
      const body = await res.json().catch(() => null)
      return ACTION_ERROR_KEYS[body?.error ?? ''] ?? 'organizer.rounds.actionError.unexpected'
    },
    onSuccess: (errorKey) => setActionErrorKey(errorKey),
    onError: () => setActionErrorKey('organizer.rounds.actionError.unexpected'),
    onSettled: invalidate,
  })

  function closesAtFor(round: RoundSummary): Date | null {
    if (eventStream.currentRoundId === round.id && eventStream.closesAt) return eventStream.closesAt
    return round.closesAt ? new Date(round.closesAt) : null
  }

  function openExtendDialog(id: string) {
    setExtendMinutes('')
    setExtendMinutesError(null)
    setExtendTargetId(id)
  }

  function confirmExtend() {
    const minutes = Number(extendMinutes)
    if (!Number.isInteger(minutes) || minutes <= 0) {
      setExtendMinutesError(t('organizer.rounds.dialogs.extend.minutesInvalid'))
      return
    }
    if (extendTargetId) extend.mutate({ id: extendTargetId, minutes })
    setExtendTargetId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display font-semibold text-2xl uppercase tracking-[0.01em]">
          {t('organizer.rounds.heading')}
        </h2>
        <Button asChild data-testid="organizer-rounds-create">
          <Link to="/organizer/rounds/new">{t('organizer.rounds.createAction')}</Link>
        </Button>
      </div>

      {actionErrorKey && (
        <Alert variant="destructive" data-testid="organizer-rounds-action-error">
          <AlertDescription>{t(actionErrorKey)}</AlertDescription>
        </Alert>
      )}

      {rounds.isPending && (
        <p data-testid="organizer-rounds-loading">{t('organizer.rounds.loading')}</p>
      )}

      {rounds.isError && (
        <div data-testid="organizer-rounds-error" className="flex flex-col items-start gap-2">
          <p>{t('organizer.rounds.error.message')}</p>
          <Button
            type="button"
            variant="outline"
            data-testid="organizer-rounds-error-retry"
            onClick={() => rounds.refetch()}
          >
            {t('organizer.rounds.error.retry')}
          </Button>
        </div>
      )}

      {rounds.data && rounds.data.length === 0 && (
        <div
          data-testid="organizer-rounds-empty"
          className="flex flex-col items-center gap-4 p-8 text-center"
        >
          <p className="text-muted-foreground">{t('organizer.rounds.empty.title')}</p>
          <Button asChild>
            <Link to="/organizer/rounds/new">{t('organizer.rounds.empty.cta')}</Link>
          </Button>
        </div>
      )}

      {rounds.data && rounds.data.length > 0 && (
        <PanelTable
          testId="organizer-rounds-table"
          rows={rounds.data}
          rowKey={(round) => round.id}
          rowTestId={(round) => `organizer-rounds-row-${round.id}`}
          columns={[
            {
              id: 'name',
              header: t('organizer.rounds.columns.name'),
              width: 'w-[26%]',
              cell: (round) => {
                const closesAt = closesAtFor(round)
                const serverTimeOffsetMs = eventStream.serverTime
                  ? eventStream.serverTime.getTime() - Date.now()
                  : 0
                return (
                  <span className="flex flex-col items-end gap-1 md:items-start">
                    <span className="font-medium">{round.name}</span>
                    {round.status === 'open' && closesAt && (
                      <RoundCountdown closesAt={closesAt} serverTimeOffsetMs={serverTimeOffsetMs} />
                    )}
                  </span>
                )
              },
            },
            {
              id: 'status',
              header: t('organizer.rounds.columns.status'),
              width: 'w-[14%]',
              cell: (round) => (
                <Badge
                  variant={round.status === 'open' ? 'outline' : 'secondary'}
                  data-testid={`organizer-rounds-status-${round.id}`}
                >
                  {round.status === 'open' && (
                    // "Aberta" is the outlined badge with a red dot (§ 5); the
                    // dot is decoration, the word carries the meaning.
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-brand"
                      data-testid={`organizer-rounds-status-dot-${round.id}`}
                    />
                  )}
                  {t(`organizer.rounds.status.${round.status}`)}
                </Badge>
              ),
            },
            {
              id: 'duration',
              header: t('organizer.rounds.columns.duration'),
              width: 'w-[14%]',
              cell: (round) => (
                <span className="font-display font-semibold tabular-nums">
                  {t('organizer.rounds.durationValue', { minutes: round.durationMinutes })}
                </span>
              ),
            },
            {
              id: 'problems',
              header: t('organizer.rounds.columns.problems'),
              width: 'w-[12%]',
              cell: (round) => (
                <span className="font-display font-semibold tabular-nums">
                  {round.problemCount}
                </span>
              ),
            },
            {
              id: 'actions',
              header: t('organizer.rounds.columns.actions'),
              width: 'w-[34%]',
              mobileLabelVisible: false,
              cell: (round) => {
                const disableOpen = round.status === 'draft' && anotherRoundOpenId !== null
                return (
                  <>
                    {round.status === 'draft' && (
                      <>
                        <Link
                          to="/organizer/rounds/$id/edit"
                          params={{ id: round.id }}
                          data-testid={`organizer-rounds-edit-${round.id}`}
                          className="text-primary text-sm underline"
                        >
                          {t('organizer.rounds.editAction')}
                        </Link>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                data-testid={`organizer-rounds-open-hint-${round.id}`}
                                aria-label={
                                  disableOpen
                                    ? t('organizer.rounds.openDisabledTooltip', {
                                        name: anotherRoundOpenName ?? '',
                                      })
                                    : undefined
                                }
                                tabIndex={disableOpen ? 0 : undefined}
                                className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                              >
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={disableOpen}
                                  data-testid={`organizer-rounds-open-${round.id}`}
                                  onClick={() => setOpenTargetId(round.id)}
                                >
                                  {t('organizer.rounds.openAction')}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {disableOpen && (
                              <TooltipContent>
                                {t('organizer.rounds.openDisabledTooltip', {
                                  name: anotherRoundOpenName ?? '',
                                })}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </>
                    )}
                    {round.status === 'open' && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid={`organizer-rounds-extend-${round.id}`}
                          onClick={() => openExtendDialog(round.id)}
                        >
                          {t('organizer.rounds.extendAction')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid={`organizer-rounds-close-${round.id}`}
                          onClick={() => setCloseTargetId(round.id)}
                        >
                          {t('organizer.rounds.closeAction')}
                        </Button>
                      </>
                    )}
                    {round.status === 'closed' && round.closedAt && (
                      <span
                        className="text-muted-foreground text-sm"
                        data-testid={`organizer-rounds-closed-at-${round.id}`}
                      >
                        {t('organizer.rounds.closedAt', {
                          date: formatDate(
                            new Date(round.closedAt),
                            i18n.resolvedLanguage ?? i18n.language,
                          ),
                        })}
                      </span>
                    )}
                  </>
                )
              },
            },
          ]}
        />
      )}

      <AlertDialog
        open={openTargetId !== null}
        onOpenChange={(next) => !next && setOpenTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={PANEL_DIALOG_TITLE}>
              {t('organizer.rounds.dialogs.open.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('organizer.rounds.dialogs.open.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('organizer.rounds.dialogs.open.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={PANEL_BRAND_BUTTON}
              data-testid="organizer-rounds-open-confirm"
              onClick={() => {
                if (openTargetId) open.mutate(openTargetId)
                setOpenTargetId(null)
              }}
            >
              {t('organizer.rounds.dialogs.open.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={closeTargetId !== null}
        onOpenChange={(next) => !next && setCloseTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={PANEL_DIALOG_TITLE}>
              {t('organizer.rounds.dialogs.close.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('organizer.rounds.dialogs.close.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('organizer.rounds.dialogs.close.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="organizer-rounds-close-confirm"
              onClick={() => {
                if (closeTargetId) close.mutate(closeTargetId)
                setCloseTargetId(null)
              }}
            >
              {t('organizer.rounds.dialogs.close.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={extendTargetId !== null}
        onOpenChange={(next) => !next && setExtendTargetId(null)}
      >
        <DialogContent data-testid="organizer-rounds-extend-dialog">
          <DialogHeader>
            <DialogTitle className={PANEL_DIALOG_TITLE}>
              {t('organizer.rounds.dialogs.extend.title')}
            </DialogTitle>
            <DialogDescription>
              {t('organizer.rounds.dialogs.extend.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="organizer-rounds-extend-minutes" className={PANEL_FIELD_LABEL}>
              {t('organizer.rounds.dialogs.extend.minutesLabel')}
            </Label>
            <Input
              id="organizer-rounds-extend-minutes"
              type="number"
              min={1}
              data-testid="organizer-rounds-extend-minutes"
              aria-invalid={extendMinutesError !== null}
              value={extendMinutes}
              onChange={(event) => {
                setExtendMinutes(event.target.value)
                setExtendMinutesError(null)
              }}
            />
            {extendMinutesError && (
              <p className={PANEL_FIELD_ERROR} data-testid="organizer-rounds-extend-error">
                {extendMinutesError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-testid="organizer-rounds-extend-cancel"
              onClick={() => setExtendTargetId(null)}
            >
              {t('organizer.rounds.dialogs.extend.cancel')}
            </Button>
            <Button
              type="button"
              data-testid="organizer-rounds-extend-confirm"
              onClick={confirmExtend}
            >
              {t('organizer.rounds.dialogs.extend.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
