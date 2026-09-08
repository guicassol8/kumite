import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { UniversityBadge } from '@/components/teams/university-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export const Route = createFileRoute('/organizer/users')({
  component: OrganizerUsersScreen,
})

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

// Radix's Select has no value for "no selection", so every filter uses this
// sentinel for its "all" option and drops the param instead of sending it.
const ALL = 'all'

type Role = 'participant' | 'organizer'
type University = 'pucrs' | 'merida'

type Filters = {
  q: string
  role: Role | typeof ALL
  university: University | typeof ALL
  teamId: string
  offset: number
}

const INITIAL_FILTERS: Filters = { q: '', role: ALL, university: ALL, teamId: ALL, offset: 0 }

async function fetchUsers(filters: Filters, q: string) {
  const res = await api.organizer.users.$get({
    query: {
      ...(q ? { q } : {}),
      ...(filters.role === ALL ? {} : { role: filters.role }),
      ...(filters.university === ALL ? {} : { university: filters.university }),
      ...(filters.teamId === ALL ? {} : { teamId: filters.teamId }),
      limit: PAGE_SIZE,
      offset: filters.offset,
    },
  })
  if (!res.ok) throw new Error('failed to load users')
  return res.json()
}

async function fetchTeamOptions() {
  const res = await api.organizer.teams.$get()
  if (!res.ok) throw new Error('failed to load teams')
  return res.json()
}

const ROLE_KEYS = {
  participant: 'organizer.users.role.participant',
  organizer: 'organizer.users.role.organizer',
} as const

function OrganizerUsersScreen() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS)
  // The search box is the only filter that doesn't hit the API on every
  // keystroke: `filters.q` is what was typed, `debouncedQ` is what is queried.
  const [debouncedQ, setDebouncedQ] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(filters.q), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [filters.q])

  const users = useQuery({
    queryKey: [
      'organizer-users',
      debouncedQ,
      filters.role,
      filters.university,
      filters.teamId,
      filters.offset,
    ],
    queryFn: () => fetchUsers(filters, debouncedQ),
  })

  const teams = useQuery({ queryKey: ['organizer-teams'], queryFn: fetchTeamOptions })

  // Any filter change starts over from page 1 — page 3 of the old result set
  // says nothing about the new one.
  function updateFilter(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch, offset: 0 }))
  }

  const total = users.data?.total ?? 0
  const from = total === 0 ? 0 : filters.offset + 1
  const to = Math.min(filters.offset + PAGE_SIZE, total)

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-semibold text-xl" data-testid="organizer-users-heading">
        {t('organizer.users.heading')}
      </h2>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="organizer-users-search">{t('organizer.users.search.label')}</Label>
          <Input
            id="organizer-users-search"
            className="h-9 w-56"
            data-testid="organizer-users-search-input"
            placeholder={t('organizer.users.search.placeholder')}
            value={filters.q}
            onChange={(event) => updateFilter({ q: event.target.value })}
          />
        </div>

        <FilterSelect
          label={t('organizer.users.filters.university')}
          testId="organizer-users-filter-university"
          value={filters.university}
          onValueChange={(value) => updateFilter({ university: value as Filters['university'] })}
          options={[
            { value: 'pucrs', label: t('teams.university.pucrs') },
            { value: 'merida', label: t('teams.university.merida') },
          ]}
        />

        <FilterSelect
          label={t('organizer.users.filters.role')}
          testId="organizer-users-filter-role"
          value={filters.role}
          onValueChange={(value) => updateFilter({ role: value as Filters['role'] })}
          options={[
            { value: 'participant', label: t('organizer.users.role.participant') },
            { value: 'organizer', label: t('organizer.users.role.organizer') },
          ]}
        />

        <FilterSelect
          label={t('organizer.users.filters.team')}
          testId="organizer-users-filter-team"
          value={filters.teamId}
          onValueChange={(value) => updateFilter({ teamId: value })}
          options={(teams.data?.teams ?? []).map((team) => ({ value: team.id, label: team.name }))}
        />
      </div>

      {users.isPending && (
        <p data-testid="organizer-users-loading">{t('organizer.users.loading')}</p>
      )}

      {users.isError && (
        <div data-testid="organizer-users-error" className="flex flex-col items-start gap-2">
          <p>{t('organizer.users.error.message')}</p>
          <Button
            type="button"
            variant="outline"
            data-testid="organizer-users-error-retry"
            onClick={() => users.refetch()}
          >
            {t('organizer.users.error.retry')}
          </Button>
        </div>
      )}

      {users.data && users.data.items.length === 0 && (
        <p data-testid="organizer-users-empty">{t('organizer.users.empty')}</p>
      )}

      {users.data && users.data.items.length > 0 && (
        <>
          <Table data-testid="organizer-users-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t('organizer.users.columns.email')}</TableHead>
                <TableHead>{t('organizer.users.columns.university')}</TableHead>
                <TableHead>{t('organizer.users.columns.role')}</TableHead>
                <TableHead>{t('organizer.users.columns.team')}</TableHead>
                <TableHead>{t('organizer.users.columns.status')}</TableHead>
                <TableHead>{t('organizer.users.columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.items.map((item) => (
                <TableRow
                  key={item.id}
                  data-testid={`organizer-users-row-${item.id}`}
                  className={item.active ? undefined : 'text-muted-foreground'}
                >
                  <TableCell>{item.email}</TableCell>
                  <TableCell>
                    <UniversityBadge university={item.university} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{t(ROLE_KEYS[item.role])}</Badge>
                  </TableCell>
                  <TableCell>{item.team?.name ?? t('organizer.users.noTeam')}</TableCell>
                  <TableCell>
                    <Badge
                      variant={item.active ? 'outline' : 'secondary'}
                      data-testid={`organizer-users-status-${item.id}`}
                    >
                      {item.active
                        ? t('organizer.users.status.active')
                        : t('organizer.users.status.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm" data-testid="organizer-users-range">
              {t('organizer.users.pagination.range', { from, to, total })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="organizer-users-prev"
                disabled={filters.offset === 0}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    offset: Math.max(0, current.offset - PAGE_SIZE),
                  }))
                }
              >
                {t('organizer.users.pagination.previous')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="organizer-users-next"
                disabled={to >= total}
                onClick={() =>
                  setFilters((current) => ({ ...current, offset: current.offset + PAGE_SIZE }))
                }
              >
                {t('organizer.users.pagination.next')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  testId,
  value,
  onValueChange,
  options,
}: {
  label: string
  testId: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 w-44" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('organizer.users.filters.all')}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
