import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { resolveProblemTitle, type UiLocale } from '@/lib/resolve-problem-title'

export const Route = createFileRoute('/organizer/problems/')({
  component: OrganizerProblemsList,
})

const PROBLEMS_QUERY_KEY = ['organizer-problems']

async function fetchProblems() {
  const res = await api.organizer.problems.$get()
  if (!res.ok) throw new Error('failed to load problems')
  return res.json()
}

function toUiLocale(language: string): UiLocale {
  return language === 'es' || language === 'en' ? language : 'pt'
}

function OrganizerProblemsList() {
  const { t, i18n } = useTranslation()
  const uiLocale = toUiLocale(i18n.resolvedLanguage ?? i18n.language)
  const queryClient = useQueryClient()
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null)

  const problems = useQuery({
    queryKey: PROBLEMS_QUERY_KEY,
    queryFn: fetchProblems,
  })

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.organizer.problems[':id'].archive.$post({ param: { id } })
      if (!res.ok) throw new Error('failed to archive problem')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROBLEMS_QUERY_KEY })
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-xl">{t('organizer.problems.heading')}</h2>
        <Button asChild data-testid="organizer-problems-create">
          <Link to="/organizer/problems/new">{t('organizer.problems.createAction')}</Link>
        </Button>
      </div>

      {problems.isPending && (
        <p data-testid="organizer-problems-loading">{t('organizer.problems.loading')}</p>
      )}

      {problems.isError && (
        <div data-testid="organizer-problems-error" className="flex flex-col items-start gap-2">
          <p>{t('organizer.problems.error.message')}</p>
          <Button
            type="button"
            variant="outline"
            data-testid="organizer-problems-error-retry"
            onClick={() => problems.refetch()}
          >
            {t('organizer.problems.error.retry')}
          </Button>
        </div>
      )}

      {problems.data && problems.data.length === 0 && (
        <div
          data-testid="organizer-problems-empty"
          className="flex flex-col items-center gap-4 p-8 text-center"
        >
          <p className="text-muted-foreground">{t('organizer.problems.empty.title')}</p>
          <Button asChild>
            <Link to="/organizer/problems/new">{t('organizer.problems.empty.cta')}</Link>
          </Button>
        </div>
      )}

      {problems.data && problems.data.length > 0 && (
        <Table data-testid="organizer-problems-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t('organizer.problems.columns.title')}</TableHead>
              <TableHead>{t('organizer.problems.columns.difficulty')}</TableHead>
              <TableHead>{t('organizer.problems.columns.points')}</TableHead>
              <TableHead>{t('organizer.problems.columns.status')}</TableHead>
              <TableHead>{t('organizer.problems.columns.testCases')}</TableHead>
              <TableHead>{t('organizer.problems.columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {problems.data.map((problem) => {
              const title = resolveProblemTitle(problem.translations, uiLocale)
              return (
                <TableRow key={problem.id} data-testid={`organizer-problems-row-${problem.id}`}>
                  <TableCell>{title ?? t('organizer.problems.missingTitle')}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {t(`organizer.problems.difficulty.${problem.difficulty}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>{problem.points}</TableCell>
                  <TableCell>
                    <Badge>{t(`organizer.problems.status.${problem.status}`)}</Badge>
                  </TableCell>
                  <TableCell>{problem.testCaseCount}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        to="/organizer/problems/$id/edit"
                        params={{ id: problem.id }}
                        data-testid={`organizer-problems-edit-${problem.id}`}
                        className="text-primary text-sm underline"
                      >
                        {t('organizer.problems.editAction')}
                      </Link>
                      {problem.status !== 'archived' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid={`organizer-problems-archive-${problem.id}`}
                          onClick={() => setArchiveTargetId(problem.id)}
                        >
                          {t('organizer.problems.archiveAction')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <AlertDialog
        open={archiveTargetId !== null}
        onOpenChange={(open) => !open && setArchiveTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('organizer.problems.archiveDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('organizer.problems.archiveDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('organizer.problems.archiveDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="organizer-problems-archive-confirm"
              onClick={() => {
                if (archiveTargetId) archive.mutate(archiveTargetId)
                setArchiveTargetId(null)
              }}
            >
              {t('organizer.problems.archiveDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
