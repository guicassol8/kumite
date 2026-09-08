import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useEventStream } from '@/hooks/use-event-stream'
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
  const eventStream = useEventStream(invalidate)

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
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-xl">{t('organizer.rounds.heading')}</h2>
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
        <Table data-testid="organizer-rounds-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t('organizer.rounds.columns.name')}</TableHead>
              <TableHead>{t('organizer.rounds.columns.status')}</TableHead>
              <TableHead>{t('organizer.rounds.columns.duration')}</TableHead>
              <TableHead>{t('organizer.rounds.columns.problems')}</TableHead>
              <TableHead>{t('organizer.rounds.columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rounds.data.map((round) => {
              const closesAt = closesAtFor(round)
              const serverTimeOffsetMs = eventStream.serverTime
                ? eventStream.serverTime.getTime() - Date.now()
                : 0
              const disableOpen = round.status === 'draft' && anotherRoundOpenId !== null

              return (
                <TableRow key={round.id} data-testid={`organizer-rounds-row-${round.id}`}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{round.name}</span>
                      {round.status === 'open' && closesAt && (
                        <RoundCountdown
                          closesAt={closesAt}
                          serverTimeOffsetMs={serverTimeOffsetMs}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge>{t(`organizer.rounds.status.${round.status}`)}</Badge>
                  </TableCell>
                  <TableCell>
                    {t('organizer.rounds.durationValue', { minutes: round.durationMinutes })}
                  </TableCell>
                  <TableCell>{round.problemCount}</TableCell>
                  <TableCell>
                    {round.status === 'draft' && (
                      <div className="flex items-center gap-2">
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
                      </div>
                    )}
                    {round.status === 'open' && (
                      <div className="flex items-center gap-2">
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
                      </div>
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
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <AlertDialog
        open={openTargetId !== null}
        onOpenChange={(next) => !next && setOpenTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('organizer.rounds.dialogs.open.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('organizer.rounds.dialogs.open.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('organizer.rounds.dialogs.open.cancel')}</AlertDialogCancel>
            <AlertDialogAction
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
            <AlertDialogTitle>{t('organizer.rounds.dialogs.close.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('organizer.rounds.dialogs.close.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('organizer.rounds.dialogs.close.cancel')}</AlertDialogCancel>
            <AlertDialogAction
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
            <DialogTitle>{t('organizer.rounds.dialogs.extend.title')}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {t('organizer.rounds.dialogs.extend.description')}
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="organizer-rounds-extend-minutes">
              {t('organizer.rounds.dialogs.extend.minutesLabel')}
            </Label>
            <Input
              id="organizer-rounds-extend-minutes"
              type="number"
              min={1}
              data-testid="organizer-rounds-extend-minutes"
              value={extendMinutes}
              onChange={(event) => {
                setExtendMinutes(event.target.value)
                setExtendMinutesError(null)
              }}
            />
            {extendMinutesError && (
              <p className="text-destructive text-sm" data-testid="organizer-rounds-extend-error">
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
