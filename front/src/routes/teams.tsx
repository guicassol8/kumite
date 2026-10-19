import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { UniversityBadge } from '@/components/teams/university-badge'
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
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSession } from '@/hooks/use-session'
import { api } from '@/lib/api'
import { readFieldIssues } from '@/lib/api-issues'
import { requireAuth } from '@/lib/route-guards'
import { displayTeamName, normalizeTeamName } from '@/lib/team-name'
import { fetchTeams, TEAMS_QUERY_KEY } from '@/lib/teams-query'

export const Route = createFileRoute('/teams')({
  beforeLoad: requireAuth,
  component: TeamsScreen,
})

// The back already decided *why* a join would be refused (teams.service.ts);
// the front only turns that reason into a sentence.
const JOIN_BLOCKED_KEYS = {
  team_full: 'teams.joinBlocked.teamFull',
  mixed_lock_violation: 'teams.joinBlocked.mixedLock',
  already_in_team: 'teams.joinBlocked.alreadyInTeam',
} as const

// The same refusals, worded for someone who already clicked: the listing was
// stale and the API said no.
const JOIN_ERROR_KEYS: Record<string, string> = {
  team_full: 'teams.actionError.teamFull',
  mixed_lock_violation: 'teams.actionError.mixedLock',
  already_in_team: 'teams.actionError.alreadyInTeam',
  not_found: 'teams.actionError.notFound',
}

// The leave's refusals (teams.route.ts): the listing said the team was not
// frozen yet, or that the participant was still on it, and it went stale.
const LEAVE_ERROR_KEYS: Record<string, string> = {
  team_frozen: 'teams.actionError.teamFrozen',
  not_in_team: 'teams.actionError.notInTeam',
}

type CreateTeamFormValues = { name: string }

// Mirrors CreateTeamBodySchema in back/src/modules/teams/teams.schema.ts —
// same bounds, so an obviously invalid name never costs a round trip.
function useCreateTeamSchema() {
  const { t, i18n } = useTranslation()
  return useMemo(
    () =>
      z.object({
        name: z
          .string()
          // `.trim()` runs before the length checks, exactly as in the back's
          // schema, so "   " is a 0-character name and is refused here rather
          // than costing a round trip (achado #10).
          .trim()
          .min(1, t('teams.create.errors.nameRequired'))
          .max(40, t('teams.create.errors.nameTooLong')),
      }),
    [t, i18n.language],
  )
}

function TeamsScreen() {
  const { t } = useTranslation()
  const { user } = useSession()
  const queryClient = useQueryClient()
  const isOrganizer = user?.role === 'organizer'
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null)
  const createSchema = useCreateTeamSchema()
  const createForm = useForm<CreateTeamFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '' },
  })

  const teams = useQuery({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: fetchTeams,
  })

  const leave = useMutation({
    mutationFn: async () => {
      const res = await api.teams.leave.$post()
      if (res.status === 204) return null

      const body = (await res.json().catch(() => null)) as { error?: string } | null
      return LEAVE_ERROR_KEYS[body?.error ?? ''] ?? 'teams.actionError.leaveUnexpected'
    },
    // Same surface as the join: a refusal or a dead network lands on the page
    // alert, and a successful leave clears whatever an earlier click left there.
    onSuccess: (errorKey) => setActionErrorKey(errorKey),
    onError: () => setActionErrorKey('teams.actionError.leaveUnexpected'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY })
    },
  })

  const join = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.teams[':id'].join.$post({ param: { id } })
      if (res.status === 200) return null

      const body = (await res.json()) as { error?: string }
      return JOIN_ERROR_KEYS[body.error ?? ''] ?? 'teams.actionError.unexpected'
    },
    onSuccess: (errorKey) => setActionErrorKey(errorKey),
    onError: () => setActionErrorKey('teams.actionError.unexpected'),
    // Whatever happened, the listing we based the click on is stale — the
    // refetch is what puts the real state back on screen.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY })
    },
  })

  const data = teams.data
  const myTeam = data?.teams.find((team) => team.id === data.myTeamId) ?? null
  const canCreate = !isOrganizer && data !== undefined && data.myTeamId === null

  function openCreateDialog() {
    createForm.reset({ name: '' })
    setCreateDialogOpen(true)
  }

  async function onCreateSubmit(values: CreateTeamFormValues) {
    // Normalized before it leaves the browser (#185), so the name the API
    // stores is the one the unique index compares: "Os Dragoes " and
    // "Os  Dragoes" both collide with "Os Dragoes" instead of creating a
    // second, visually identical team.
    const res = await api.teams.$post({ json: { name: normalizeTeamName(values.name) } })

    if (res.status === 201) {
      setCreateDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEY })
      return
    }

    if (res.status === 409) {
      const body = await res.json()
      if (body.error === 'name_taken') {
        createForm.setError('name', { message: t('teams.create.errors.nameTaken') })
        return
      }
    }

    // kata's validation envelope names the field, so a rejected name belongs
    // under the input and not in the dialog's generic alert — same shape as
    // organizer.event-config.tsx's 422 branch.
    const nameIssue = (await readFieldIssues(res)).find((issue) => issue.path === 'name')
    if (nameIssue) {
      // The catalog string, never `issue.message`: kata hands back zod's own
      // English text, which would reach a pt/es participant untranslated.
      createForm.setError('name', {
        message:
          nameIssue.code === 'too_small'
            ? t('teams.create.errors.nameRequired')
            : nameIssue.code === 'too_big'
              ? t('teams.create.errors.nameTooLong')
              : t('teams.create.errors.fieldRejected'),
      })
      return
    }

    // already_in_team (someone raced us) or an undeclared status: nothing
    // field-specific to say, so it lands on the form itself.
    createForm.setError('root', { message: t('teams.create.errors.unexpected') })
  }

  const createRootError = createForm.formState.errors.root?.message
  const eyebrow = 'font-display text-[13px] font-semibold uppercase tracking-[0.12em]'
  const cellClass =
    'flex min-w-0 items-start justify-between gap-3 whitespace-normal px-4 py-2 md:table-cell md:px-3 md:py-4'

  return (
    <main
      data-testid="teams-screen"
      className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1
            data-testid="teams-heading"
            className="font-display font-bold text-4xl leading-none uppercase tracking-[0.01em]"
          >
            {t('teams.heading')}
          </h1>
          {data && (
            <p data-testid="teams-rules" className="mt-2 text-muted-foreground text-sm">
              {t('teams.rules', {
                max: data.maxTeamSize,
                rule: t(data.mixingLocked ? 'teams.mixingLocked' : 'teams.mixingAllowed'),
              })}
            </p>
          )}
        </div>
        {canCreate && (
          <Button
            type="button"
            data-testid="teams-create-open"
            onClick={openCreateDialog}
            className="h-11 md:h-9"
          >
            {t('teams.createAction')}
          </Button>
        )}
      </div>

      {myTeam && (
        <Card data-testid="my-team-panel" className="gap-4">
          <CardHeader className="flex-row flex-wrap items-center gap-3">
            <h2 className={`${eyebrow} text-muted-foreground`}>{t('teams.myTeam.title')}</h2>
            <Badge
              data-testid="my-team-name"
              className="max-w-full whitespace-normal wrap-anywhere"
            >
              {displayTeamName(myTeam.name, t('teams.unnamed'))}
            </Badge>
            <span data-testid="my-team-count" className="text-muted-foreground text-sm">
              {t('home.team.memberCount', {
                members: myTeam.members.length,
                max: data?.maxTeamSize,
              })}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col">
              {myTeam.members.map((member, index) => (
                <li
                  key={`${myTeam.id}-${index}`}
                  data-testid={`my-team-member-${index}`}
                  className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-t py-3 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-display font-semibold text-muted-foreground"
                  >
                    {(member.name || member.email || '').slice(0, 1).toLocaleUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1 basis-36 wrap-anywhere">
                    {member.name ? (
                      <>
                        <span className="block">{member.name}</span>
                        <span className="block text-muted-foreground text-xs">{member.email}</span>
                      </>
                    ) : (
                      <span>{member.email}</span>
                    )}
                  </div>
                  <UniversityBadge university={member.university} />
                  {member.email === user?.email && (
                    <span className="text-muted-foreground">{t('teams.myTeam.you')}</span>
                  )}
                </li>
              ))}
            </ul>
            {myTeam.frozen && (
              <p data-testid="my-team-frozen-notice" className="text-muted-foreground text-sm">
                {t('teams.myTeam.frozenNotice')}
              </p>
            )}
            <div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                data-testid="my-team-leave"
                disabled={myTeam.frozen || leave.isPending}
                onClick={() => setLeaveDialogOpen(true)}
                className="h-11 md:h-8"
              >
                {t('teams.myTeam.leaveAction')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {data?.mixingLocked && (
        <Alert data-testid="teams-mixing-locked-notice">
          <AlertDescription>{t('teams.mixingLockedNotice')}</AlertDescription>
        </Alert>
      )}

      {actionErrorKey && (
        <Alert variant="destructive" data-testid="teams-action-error">
          <AlertDescription>{t(actionErrorKey)}</AlertDescription>
        </Alert>
      )}

      {teams.isPending && <p data-testid="teams-loading">{t('teams.loading')}</p>}

      {teams.isError && (
        <div data-testid="teams-error" className="flex flex-col items-start gap-2">
          <p>{t('teams.error.message')}</p>
          <Button
            type="button"
            variant="outline"
            data-testid="teams-error-retry"
            onClick={() => teams.refetch()}
          >
            {t('teams.error.retry')}
          </Button>
        </div>
      )}

      {data && data.teams.length === 0 && (
        <div data-testid="teams-empty" className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="text-muted-foreground">{t('teams.empty.title')}</p>
          {canCreate && (
            <Button type="button" data-testid="teams-empty-cta" onClick={openCreateDialog}>
              {t('teams.empty.cta')}
            </Button>
          )}
        </div>
      )}

      {data && data.teams.length > 0 && (
        <table
          data-testid="teams-table"
          role="table"
          className="w-full table-fixed text-sm md:rounded-lg md:border md:bg-card"
        >
          <TableHeader className="hidden md:table-header-group">
            <TableRow>
              <TableHead
                data-testid="teams-column-name"
                className={`${eyebrow} w-[25%] text-muted-foreground`}
              >
                {t('teams.columns.name')}
              </TableHead>
              <TableHead
                data-testid="teams-column-members"
                className={`${eyebrow} w-[30%] text-muted-foreground`}
              >
                {t('teams.columns.members')}
              </TableHead>
              <TableHead
                data-testid="teams-column-slots"
                className={`${eyebrow} w-[12%] text-muted-foreground`}
              >
                {t('teams.columns.slots')}
              </TableHead>
              <TableHead
                data-testid="teams-column-actions"
                className={`${eyebrow} text-muted-foreground`}
              >
                {t('teams.columns.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="flex flex-col gap-4 md:table-row-group [&_tr:last-child]:border md:[&_tr:last-child]:border-0">
            {data.teams.map((team) => {
              const isMine = team.id === data.myTeamId
              return (
                <TableRow
                  key={team.id}
                  data-testid={`teams-row-${team.id}`}
                  role="row"
                  className="flex flex-col rounded-lg border bg-card py-2 md:table-row md:rounded-none md:py-0"
                >
                  <TableCell role="cell" className={cellClass}>
                    <span className={`${eyebrow} text-muted-foreground md:hidden`}>
                      {t('teams.columns.name')}
                    </span>
                    <span className="min-w-0 wrap-anywhere font-medium">
                      {displayTeamName(team.name, t('teams.unnamed'))}
                    </span>
                  </TableCell>
                  <TableCell role="cell" className={cellClass}>
                    <span className={`${eyebrow} text-muted-foreground md:hidden`}>
                      {t('teams.columns.members')}
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span
                        data-testid={`teams-member-count-${team.id}`}
                        className="mr-1 font-display font-semibold tabular-nums"
                      >
                        {team.members.length}
                      </span>
                      {team.members.map((member, index) => (
                        <UniversityBadge
                          key={`${team.id}-${index}`}
                          university={member.university}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell role="cell" className={cellClass}>
                    <span className={`${eyebrow} text-muted-foreground md:hidden`}>
                      {t('teams.columns.slots')}
                    </span>
                    <span className="font-display font-semibold tabular-nums">
                      {t('teams.slots', { available: team.slotsAvailable, max: data.maxTeamSize })}
                    </span>
                  </TableCell>
                  <TableCell role="cell" className={cellClass}>
                    <span className={`${eyebrow} text-muted-foreground md:hidden`}>
                      {t('teams.columns.actions')}
                    </span>
                    {isMine && (
                      <Badge variant="brand" data-testid="teams-your-team-badge">
                        {t('teams.yourTeamBadge')}
                      </Badge>
                    )}
                    {!isOrganizer && !isMine && (
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={team.slotsAvailable === 0 ? 'ghost' : 'outline'}
                          className={`h-11 md:h-8 ${team.slotsAvailable === 0 ? 'text-muted-foreground disabled:opacity-100' : ''}`}
                          data-testid={`teams-join-${team.id}`}
                          disabled={team.joinBlockedReason !== null || join.isPending}
                          onClick={() => join.mutate(team.id)}
                        >
                          {t(team.slotsAvailable === 0 ? 'teams.full' : 'teams.joinAction')}
                        </Button>
                        {team.joinBlockedReason && (
                          <span className="min-w-0 wrap-anywhere text-muted-foreground text-xs">
                            {t(JOIN_BLOCKED_KEYS[team.joinBlockedReason])}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </table>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent data-testid="teams-create-dialog">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold text-2xl">
              {t('teams.create.title')}
            </DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit(onCreateSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('teams.create.nameLabel')}</FormLabel>
                    <FormControl>
                      <Input data-testid="teams-create-name-input" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage data-testid="teams-create-name-error" />
                  </FormItem>
                )}
              />
              {createRootError && (
                <Alert variant="destructive" data-testid="teams-create-form-error">
                  <AlertDescription>{createRootError}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="teams-create-cancel"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  {t('teams.create.cancel')}
                </Button>
                <Button
                  type="submit"
                  data-testid="teams-create-submit"
                  disabled={createForm.formState.isSubmitting}
                >
                  {t('teams.create.submit')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent data-testid="teams-leave-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-semibold text-2xl">
              {t('teams.leaveDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('teams.leaveDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="teams-leave-cancel">
              {t('teams.leaveDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="teams-leave-confirm"
              className="border border-destructive bg-transparent text-destructive hover:bg-destructive/10"
              onClick={() => {
                leave.mutate()
                setLeaveDialogOpen(false)
              }}
            >
              {t('teams.leaveDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
