import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { UniversityBadge } from '@/components/teams/university-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

function TeamsScreen() {
  const { t } = useTranslation()
  const { user } = useSession()
  const isOrganizer = user?.role === 'organizer'

  const teams = useQuery({
    queryKey: TEAMS_QUERY_KEY,
    queryFn: fetchTeams,
  })

  const data = teams.data

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">{t('teams.heading')}</h1>
      </div>

      {data?.mixingLocked && (
        <Alert data-testid="teams-mixing-locked-notice">
          <AlertDescription>{t('teams.mixingLockedNotice')}</AlertDescription>
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
          {!isOrganizer && (
            <Button type="button" data-testid="teams-empty-cta">
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
                          disabled={team.joinBlockedReason !== null}
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
    </main>
  )
}
