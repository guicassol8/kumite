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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSession } from '@/hooks/use-session'
import { api } from '@/lib/api'
import { requireAuth } from '@/lib/route-guards'

export const Route = createFileRoute('/teams')({
  beforeLoad: requireAuth,
  component: TeamsScreen,
})

export const TEAMS_QUERY_KEY = ['teams']

async function fetchTeams() {
  const res = await api.teams.$get()
  if (!res.ok) throw new Error('failed to load teams')
  return res.json()
}

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
      await api.teams.leave.$post()
    },
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
    const res = await api.teams.$post({ json: { name: values.name } })

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

    // already_in_team (someone raced us) or an undeclared status: nothing
    // field-specific to say, so it lands on the form itself.
    createForm.setError('root', { message: t('teams.create.errors.unexpected') })
  }

  const createRootError = createForm.formState.errors.root?.message

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">{t('teams.heading')}</h1>
        {canCreate && (
          <Button type="button" data-testid="teams-create-open" onClick={openCreateDialog}>
            {t('teams.createAction')}
          </Button>
        )}
      </div>

      {myTeam && (
        <Card data-testid="my-team-panel">
          <CardHeader>
            <CardTitle data-testid="my-team-name">
              {t('teams.myTeam.title')} — {myTeam.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2">
              {myTeam.members.map((member, index) => (
                <li
                  // Same reasoning as the listing: the roster has no stable
                  // per-member id, only its position.
                  key={`${myTeam.id}-${index}`}
                  data-testid={`my-team-member-${index}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <UniversityBadge university={member.university} />
                  <span>{member.email}</span>
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
                variant="outline"
                size="sm"
                data-testid="my-team-leave"
                disabled={myTeam.frozen || leave.isPending}
                onClick={() => setLeaveDialogOpen(true)}
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
        <Table data-testid="teams-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t('teams.columns.name')}</TableHead>
              <TableHead>{t('teams.columns.members')}</TableHead>
              <TableHead>{t('teams.columns.slots')}</TableHead>
              <TableHead>{t('teams.columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.teams.map((team) => {
              const isMine = team.id === data.myTeamId
              return (
                <TableRow key={team.id} data-testid={`teams-row-${team.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{team.name}</span>
                      {isMine && (
                        <Badge data-testid="teams-your-team-badge">
                          {t('teams.yourTeamBadge')}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {team.members.map((member, index) => (
                        <UniversityBadge
                          // Members are anonymous in the public listing, so
                          // there is no stable id to key on — position is the
                          // only identity a row has.
                          key={`${team.id}-${index}`}
                          university={member.university}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>
                        {t('teams.slots', {
                          available: team.slotsAvailable,
                          max: data.maxTeamSize,
                        })}
                      </span>
                      {team.slotsAvailable === 0 && (
                        <Badge variant="secondary">{t('teams.full')}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {!isOrganizer && !isMine && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          data-testid={`teams-join-${team.id}`}
                          disabled={team.joinBlockedReason !== null || join.isPending}
                          onClick={() => join.mutate(team.id)}
                        >
                          {t('teams.joinAction')}
                        </Button>
                        {team.joinBlockedReason && (
                          <span className="text-muted-foreground text-sm">
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
        </Table>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent data-testid="teams-create-dialog">
          <DialogHeader>
            <DialogTitle>{t('teams.create.title')}</DialogTitle>
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
                      <Input data-testid="teams-create-name-input" {...field} />
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
            <AlertDialogTitle>{t('teams.leaveDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('teams.leaveDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="teams-leave-cancel">
              {t('teams.leaveDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="teams-leave-confirm"
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
