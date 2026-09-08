import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { UniversityBadge } from '@/components/teams/university-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

const ROLE_KEYS = {
  participant: 'organizer.teamModeration.role.participant',
  organizer: 'organizer.teamModeration.role.organizer',
} as const

function OrganizerTeamsScreen() {
  const { t } = useTranslation()

  const teams = useQuery({
    queryKey: ORGANIZER_TEAMS_QUERY_KEY,
    queryFn: fetchOrganizerTeams,
  })

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
            <Card key={team.id} data-testid={`team-moderation-card-${team.id}`}>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle data-testid={`team-moderation-name-${team.id}`}>{team.name}</CardTitle>
                  {team.frozen && (
                    <Badge variant="secondary" data-testid={`team-moderation-frozen-${team.id}`}>
                      {t('organizer.teamModeration.frozenBadge')}
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  data-testid={`team-moderation-remove-team-action-${team.id}`}
                >
                  {t('organizer.teamModeration.removeTeam.action')}
                </Button>
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
                        <TableCell />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
