import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { KeyRound, ShieldMinus, ShieldPlus, UserCheck, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { PasswordInput } from '@/components/ui/password-input'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useSession } from '@/hooks/use-session'
import { api } from '@/lib/api'

export const Route = createFileRoute('/organizer/users')({
  component: OrganizerUsersScreen,
})

const USERS_QUERY_KEY = 'organizer-users'
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
  const session = useSession()
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
      USERS_QUERY_KEY,
      debouncedQ,
      filters.role,
      filters.university,
      filters.teamId,
      filters.offset,
    ],
    queryFn: () => fetchUsers(filters, debouncedQ),
    // Every filter and page is its own query key, so without this the table
    // unmounts on each change — blanking the rows and, worse, closing a
    // confirmation dialog the organizer had just opened.
    placeholderData: keepPreviousData,
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
                <TableHead>{t('organizer.users.columns.name')}</TableHead>
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
                  {/* Accounts predating #122 have no name — an em dash, not a
                      blank cell, so the column still reads as filled in. */}
                  <TableCell>{item.name ?? t('organizer.users.noName')}</TableCell>
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
                  <TableCell>
                    <UserRowActions user={item} isSelf={session.user?.id === item.id} />
                  </TableCell>
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

const ACTIONS = {
  promote: (id: string) => api.organizer.users[':id'].promote.$post({ param: { id } }),
  demote: (id: string) => api.organizer.users[':id'].demote.$post({ param: { id } }),
  deactivate: (id: string) => api.organizer.users[':id'].deactivate.$post({ param: { id } }),
  reactivate: (id: string) => api.organizer.users[':id'].reactivate.$post({ param: { id } }),
} as const

type Action = keyof typeof ACTIONS

// Only the two destructive directions ask for confirmation; promoting and
// reactivating are one click away because both are trivially undoable.
const CONFIRMED_ACTIONS = ['demote', 'deactivate'] as const satisfies readonly Action[]

// The API refuses self-service for the same reason the UI greys the row out,
// so both surfaces say the same sentence.
const ACTION_ERROR_KEYS: Record<string, string> = {
  cannot_demote_self: 'organizer.users.actions.selfDisabled',
  cannot_deactivate_self: 'organizer.users.actions.selfDisabled',
}

function UserRowActions({
  user,
  isSelf,
}: {
  user: { id: string; email: string; role: Role; active: boolean }
  isSelf: boolean
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState<(typeof CONFIRMED_ACTIONS)[number] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useMutation({
    mutationFn: (action: Action) => ACTIONS[action](user.id),
  })

  async function perform(action: Action) {
    setConfirming(null)
    try {
      const res = await run.mutateAsync(action)
      if (res.ok) {
        setError(null)
        queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] })
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(t(ACTION_ERROR_KEYS[body?.error ?? ''] ?? 'organizer.users.actions.errors.failed'))
    } catch {
      // A dead network rejects `mutateAsync` instead of answering: without
      // this the row would show nothing at all and the rejection would go
      // unhandled, since both call sites fire this off without awaiting.
      setError(t('organizer.users.actions.errors.failed'))
    }
  }

  const roleAction: Action = user.role === 'organizer' ? 'demote' : 'promote'
  const statusAction: Action = user.active ? 'deactivate' : 'reactivate'

  return (
    <div className="flex flex-col gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              data-testid={isSelf ? `organizer-users-self-tooltip-${user.id}` : undefined}
              aria-label={isSelf ? t('organizer.users.actions.selfDisabled') : undefined}
              tabIndex={isSelf ? 0 : undefined}
              className="flex items-center gap-1 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <RowActionButton
                action={roleAction}
                userId={user.id}
                disabled={isSelf}
                onActivate={() => onActivate(roleAction)}
              />
              <RowActionButton
                action={statusAction}
                userId={user.id}
                disabled={isSelf}
                onActivate={() => onActivate(statusAction)}
              />
              <ResetPasswordAction user={user} isSelf={isSelf} />
            </span>
          </TooltipTrigger>
          {isSelf && <TooltipContent>{t('organizer.users.actions.selfDisabled')}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>

      {error && (
        <Alert variant="destructive" data-testid={`organizer-users-action-error-${user.id}`}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent data-testid={`organizer-users-confirm-${user.id}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(`organizer.users.actions.confirm.${confirming ?? 'demote'}.title`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(`organizer.users.actions.confirm.${confirming ?? 'demote'}.description`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`organizer-users-confirm-cancel-${user.id}`}>
              {t('organizer.users.actions.confirm.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid={`organizer-users-confirm-confirm-${user.id}`}
              onClick={() => confirming && perform(confirming)}
            >
              {t('organizer.users.actions.confirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )

  function onActivate(action: Action) {
    setError(null)
    if ((CONFIRMED_ACTIONS as readonly Action[]).includes(action)) {
      setConfirming(action as (typeof CONFIRMED_ACTIONS)[number])
      return
    }
    void perform(action)
  }
}

const ACTION_ICONS = {
  promote: ShieldPlus,
  demote: ShieldMinus,
  deactivate: UserX,
  reactivate: UserCheck,
} as const

function RowActionButton({
  action,
  userId,
  disabled,
  onActivate,
}: {
  action: Action
  userId: string
  disabled: boolean
  onActivate: () => void
}) {
  const { t } = useTranslation()
  const Icon = ACTION_ICONS[action]

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-8"
      disabled={disabled}
      data-testid={`organizer-users-${action}-${userId}`}
      aria-label={t(`organizer.users.actions.${action}`)}
      onClick={onActivate}
    >
      <Icon className="size-4" />
    </Button>
  )
}

// The on-site reset (#143). A Dialog, not an AlertDialog: it needs a password
// field and a second state, neither of which the confirm dialog above allows.
function ResetPasswordAction({
  user,
  isSelf,
}: {
  user: { id: string; email: string; role: Role }
  isSelf: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Never another organizer, and never yourself — the API refuses both, and
  // the button says so rather than letting the click fail.
  const isOrganizer = user.role === 'organizer'
  const disabled = isSelf || isOrganizer

  const run = useMutation({
    mutationFn: (password: string) =>
      api.organizer.users[':id']['reset-password'].$post({
        param: { id: user.id },
        json: { adminPassword: password },
      }),
  })

  // The single close path — the footer buttons route through this too, not
  // through `setOpen(false)`, or they would skip the wipe below and the next
  // open would still be showing the last temporary password.
  function close() {
    setOpen(false)
    // Always back to step one with an empty field: the temporary password
    // lives in this state and nowhere else — not localStorage, not the query
    // cache — so closing is what actually makes "shown once" true.
    setAdminPassword('')
    setTemporaryPassword(null)
    setCopied(false)
    setError(null)
  }

  async function submit() {
    setError(null)
    try {
      const res = await run.mutateAsync(adminPassword)
      if (res.status === 200) {
        const body = await res.json()
        setTemporaryPassword(body.temporaryPassword)
        setAdminPassword('')
        return
      }
      // A wrong password and an exhausted step-up ceiling are one message
      // here because they are one response there — the API refuses to say
      // which, and repeating that refusal is the point.
      setError(
        t(
          res.status === 403
            ? 'organizer.users.actions.reset.errors.invalid'
            : 'organizer.users.actions.reset.errors.unexpected',
        ),
      )
    } catch {
      setError(t('organizer.users.actions.reset.errors.unexpected'))
    }
  }

  async function copy() {
    if (!temporaryPassword) return
    try {
      await navigator.clipboard.writeText(temporaryPassword)
      setCopied(true)
    } catch {
      // No clipboard API over plain http://ip:port, which is exactly how the
      // venue laptops reach this. The password stays on screen and selectable.
    }
  }

  const button = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-8"
      disabled={disabled}
      data-testid={`organizer-users-reset-password-${user.id}`}
      aria-label={
        isOrganizer && !isSelf
          ? t('organizer.users.actions.organizerDisabled')
          : t('organizer.users.actions.resetPassword')
      }
      onClick={() => setOpen(true)}
    >
      <KeyRound className="size-4" />
    </Button>
  )

  return (
    <>
      {isOrganizer && !isSelf ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                data-testid={`organizer-users-reset-password-tooltip-${user.id}`}
                tabIndex={0}
                className="flex rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {button}
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('organizer.users.actions.organizerDisabled')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) setOpen(true)
          else close()
        }}
      >
        <DialogContent data-testid={`organizer-users-reset-password-dialog-${user.id}`}>
          {temporaryPassword === null ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t('organizer.users.actions.reset.title', { email: user.email })}
                </DialogTitle>
                <DialogDescription>
                  {t('organizer.users.actions.reset.description')}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`reset-admin-password-${user.id}`}>
                  {t('organizer.users.actions.reset.adminPasswordLabel')}
                </Label>
                <PasswordInput
                  id={`reset-admin-password-${user.id}`}
                  value={adminPassword}
                  data-testid={`organizer-users-reset-password-admin-password-input-${user.id}`}
                  onChange={(event) => setAdminPassword(event.target.value)}
                />
              </div>
              {error && (
                <Alert
                  variant="destructive"
                  data-testid={`organizer-users-reset-password-error-${user.id}`}
                >
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  data-testid={`organizer-users-reset-password-cancel-${user.id}`}
                  onClick={close}
                >
                  {t('organizer.users.actions.reset.cancel')}
                </Button>
                <Button
                  type="button"
                  disabled={adminPassword.length === 0 || run.isPending}
                  data-testid={`organizer-users-reset-password-submit-${user.id}`}
                  onClick={() => void submit()}
                >
                  {t('organizer.users.actions.reset.submit')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div
              className="flex flex-col gap-4"
              data-testid={`organizer-users-reset-password-result-${user.id}`}
            >
              <DialogHeader>
                <DialogTitle>{t('organizer.users.actions.reset.result.title')}</DialogTitle>
                <DialogDescription>
                  {t('organizer.users.actions.reset.result.warning')}
                </DialogDescription>
              </DialogHeader>
              <output
                className="rounded-md border bg-muted p-4 text-center font-mono text-lg tracking-wider"
                data-testid={`organizer-users-reset-password-result-value-${user.id}`}
              >
                {temporaryPassword}
              </output>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  data-testid={`organizer-users-reset-password-copy-${user.id}`}
                  onClick={() => void copy()}
                >
                  {t(
                    copied
                      ? 'organizer.users.actions.reset.result.copied'
                      : 'organizer.users.actions.reset.result.copy',
                  )}
                </Button>
                <Button
                  type="button"
                  data-testid={`organizer-users-reset-password-close-${user.id}`}
                  onClick={close}
                >
                  {t('organizer.users.actions.reset.result.close')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
