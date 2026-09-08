import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'

export const Route = createFileRoute('/organizer/teams')({
  component: OrganizerTeamsScreen,
})

export const ORGANIZER_TEAMS_QUERY_KEY = ['organizer-teams']

async function fetchOrganizerTeams() {
  const res = await api.organizer.teams.$get()
  if (!res.ok) throw new Error('failed to load teams')
  return res.json()
}

type OrganizerTeamsList = Awaited<ReturnType<typeof fetchOrganizerTeams>>
type OrganizerTeam = OrganizerTeamsList['teams'][number]

const ROLE_KEYS = {
  participant: 'organizer.teamModeration.role.participant',
  organizer: 'organizer.teamModeration.role.organizer',
} as const

function OrganizerTeamsScreen() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const teams = useQuery({
    queryKey: ORGANIZER_TEAMS_QUERY_KEY,
    queryFn: fetchOrganizerTeams,
  })

  function invalidateTeams() {
    queryClient.invalidateQueries({ queryKey: ORGANIZER_TEAMS_QUERY_KEY })
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-semibold text-xl" data-testid="team-moderation-heading">
        {t('organizer.teamModeration.heading')}
      </h2>

      {teams.isPending && (
        <p data-testid="team-moderation-loading">{t('organizer.teamModeration.loading')}</p>
      )}

      {teams.isError && (
        <div data-testid="team-moderation-error" className="flex flex-col items-start gap-2">
          <p>{t('organizer.teamModeration.error.message')}</p>
          <Button
            type="button"
            variant="outline"
            data-testid="team-moderation-error-retry"
            onClick={() => teams.refetch()}
          >
            {t('organizer.teamModeration.error.retry')}
          </Button>
        </div>
      )}

      {teams.data && (
        <div className="flex flex-col gap-4">
          {teams.data.teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              allTeams={teams.data.teams}
              onChanged={invalidateTeams}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TeamCard({
  team,
  allTeams,
  onChanged,
}: {
  team: OrganizerTeam
  allTeams: OrganizerTeam[]
  onChanged: () => void
}) {
  const { t } = useTranslation()

  return (
    <Card data-testid={`team-moderation-card-${team.id}`}>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <TeamNameHeader team={team} onRenamed={onChanged} />
        <RemoveTeamAction teamId={team.id} onRemoved={onChanged} />
      </CardHeader>
      <CardContent>
        <Table data-testid={`team-moderation-members-${team.id}`}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('organizer.teamModeration.columns.email')}</TableHead>
              <TableHead>{t('organizer.teamModeration.columns.university')}</TableHead>
              <TableHead>{t('organizer.teamModeration.columns.role')}</TableHead>
              <TableHead>{t('organizer.teamModeration.columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.members.map((member) => (
              <TableRow
                key={member.userId}
                data-testid={`team-moderation-member-row-${member.userId}`}
              >
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  <UniversityBadge university={member.university} />
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{t(ROLE_KEYS[member.role])}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <MoveMemberAction
                      userId={member.userId}
                      destinations={allTeams.filter((candidate) => candidate.id !== team.id)}
                      onMoved={onChanged}
                    />
                    <RemoveMemberAction userId={member.userId} onRemoved={onChanged} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

const MOVE_ERROR_KEYS: Record<string, string> = {
  team_full: 'organizer.teamModeration.move.errors.teamFull',
  team_not_found: 'organizer.teamModeration.move.errors.teamNotFound',
  member_not_found: 'organizer.teamModeration.move.errors.memberNotFound',
}

function MoveMemberAction({
  userId,
  destinations,
  onMoved,
}: {
  userId: string
  destinations: OrganizerTeam[]
  onMoved: () => void
}) {
  const { t } = useTranslation()
  const [destinationTeamId, setDestinationTeamId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const move = useMutation({
    mutationFn: async (teamId: string) =>
      api.organizer.teams.members[':userId'].move.$post({ param: { userId }, json: { teamId } }),
  })

  async function onMove() {
    if (!destinationTeamId) return
    const res = await move.mutateAsync(destinationTeamId)
    if (res.status === 204) {
      setDestinationTeamId(undefined)
      setError(null)
      onMoved()
      return
    }
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    setError(
      t(MOVE_ERROR_KEYS[body?.error ?? ''] ?? 'organizer.teamModeration.move.errors.teamNotFound'),
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Select value={destinationTeamId} onValueChange={setDestinationTeamId}>
          <SelectTrigger className="h-8 w-40" data-testid={`team-moderation-move-select-${userId}`}>
            <SelectValue placeholder={t('organizer.teamModeration.move.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {destinations.map((destination) => (
              <SelectItem
                key={destination.id}
                value={destination.id}
                disabled={destination.slotsAvailable === 0}
              >
                {destination.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`team-moderation-move-action-${userId}`}
          disabled={!destinationTeamId || move.isPending}
          onClick={onMove}
        >
          {t('organizer.teamModeration.move.action')}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive" data-testid={`team-moderation-move-error-${userId}`}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function TeamNameHeader({ team, onRenamed }: { team: OrganizerTeam; onRenamed: () => void }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(team.name)
  const [error, setError] = useState<string | null>(null)

  const rename = useMutation({
    mutationFn: async (name: string) =>
      api.organizer.teams[':id'].$patch({ param: { id: team.id }, json: { name } }),
  })

  function startEditing() {
    setValue(team.name)
    setError(null)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setError(null)
  }

  async function save() {
    const res = await rename.mutateAsync(value)
    if (res.status === 200) {
      setEditing(false)
      setError(null)
      onRenamed()
      return
    }
    if (res.status === 409) {
      setError(t('organizer.teamModeration.rename.errors.nameTaken'))
      return
    }
    setError(t('organizer.teamModeration.rename.errors.saveFailed'))
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <CardTitle data-testid={`team-moderation-name-${team.id}`}>{team.name}</CardTitle>
        {team.frozen && (
          <Badge variant="secondary" data-testid={`team-moderation-frozen-${team.id}`}>
            {t('organizer.teamModeration.frozenBadge')}
          </Badge>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid={`team-moderation-rename-start-${team.id}`}
          onClick={startEditing}
          aria-label={t('organizer.teamModeration.rename.editAction')}
        >
          <Pencil className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          data-testid={`team-moderation-rename-input-${team.id}`}
          className="h-8 w-48"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid={`team-moderation-rename-save-${team.id}`}
          onClick={save}
          aria-label={t('organizer.teamModeration.rename.save')}
        >
          <Check className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid={`team-moderation-rename-cancel-${team.id}`}
          onClick={cancelEditing}
          aria-label={t('organizer.teamModeration.rename.cancel')}
        >
          <X className="size-4" />
        </Button>
      </div>
      {error && (
        <Alert variant="destructive" data-testid={`team-moderation-rename-error-${team.id}`}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function RemoveMemberAction({ userId, onRemoved }: { userId: string; onRemoved: () => void }) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const remove = useMutation({
    mutationFn: async () => api.organizer.teams.members[':userId'].$delete({ param: { userId } }),
    onSuccess: () => onRemoved(),
  })

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid={`team-moderation-remove-member-action-${userId}`}
        onClick={() => setConfirmOpen(true)}
      >
        {t('organizer.teamModeration.removeMember.action')}
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid={`team-moderation-remove-member-confirm-${userId}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('organizer.teamModeration.removeMember.confirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('organizer.teamModeration.removeMember.confirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid={`team-moderation-remove-member-confirm-cancel-${userId}`}
            >
              {t('organizer.teamModeration.removeMember.confirm.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid={`team-moderation-remove-member-confirm-confirm-${userId}`}
              onClick={() => {
                remove.mutate()
                setConfirmOpen(false)
              }}
            >
              {t('organizer.teamModeration.removeMember.confirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function RemoveTeamAction({ teamId, onRemoved }: { teamId: string; onRemoved: () => void }) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const remove = useMutation({
    mutationFn: async () => api.organizer.teams[':id'].$delete({ param: { id: teamId } }),
    onSuccess: () => onRemoved(),
  })

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        data-testid={`team-moderation-remove-team-action-${teamId}`}
        onClick={() => setConfirmOpen(true)}
      >
        {t('organizer.teamModeration.removeTeam.action')}
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid={`team-moderation-remove-team-confirm-${teamId}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('organizer.teamModeration.removeTeam.confirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('organizer.teamModeration.removeTeam.confirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`team-moderation-remove-team-confirm-cancel-${teamId}`}>
              {t('organizer.teamModeration.removeTeam.confirm.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid={`team-moderation-remove-team-confirm-confirm-${teamId}`}
              onClick={() => {
                remove.mutate()
                setConfirmOpen(false)
              }}
            >
              {t('organizer.teamModeration.removeTeam.confirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
