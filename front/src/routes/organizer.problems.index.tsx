import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PANEL_DIALOG_TITLE } from '@/components/organizer/panel-form'
import { PanelTable } from '@/components/organizer/panel-table'
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
import { api } from '@/lib/api'
import { resolveProblemTitle, type UiLocale } from '@/lib/resolve-problem-title'

export const Route = createFileRoute('/organizer/problems/')({
  component: OrganizerProblemsList,
})

const PROBLEMS_QUERY_KEY = ['organizer-problems']

// Identity § 5: difficulty is the outlined trio — Fácil green, Médio in
// --warning-text (--warning itself is 2,0:1 and may never carry text),
// Difícil crimson.
const DIFFICULTY_VARIANT = {
  easy: 'success',
  medium: 'warning',
  hard: 'destructive',
} as const

// Publicado is the only solid one (ink); Rascunho and Arquivado are grey, and
// Arquivado is struck through so the state does not rest on colour alone.
const STATUS_VARIANT = {
  published: 'default',
  draft: 'secondary',
  archived: 'secondary',
} as const

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display font-semibold text-2xl uppercase tracking-[0.01em]">
          {t('organizer.problems.heading')}
        </h2>
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
        <PanelTable
          testId="organizer-problems-table"
          rows={problems.data}
          rowKey={(problem) => problem.id}
          rowTestId={(problem) => `organizer-problems-row-${problem.id}`}
          columns={[
            {
              id: 'title',
              header: t('organizer.problems.columns.title'),
              width: 'w-[28%]',
              cell: (problem) => (
                <span className="font-medium">
                  {resolveProblemTitle(problem.translations, uiLocale) ??
                    t('organizer.problems.missingTitle')}
                </span>
              ),
            },
            {
              id: 'difficulty',
              header: t('organizer.problems.columns.difficulty'),
              width: 'w-[14%]',
              cell: (problem) => (
                <Badge
                  variant={DIFFICULTY_VARIANT[problem.difficulty]}
                  data-testid={`organizer-problems-difficulty-${problem.id}`}
                >
                  {t(`organizer.problems.difficulty.${problem.difficulty}`)}
                </Badge>
              ),
            },
            {
              id: 'points',
              header: t('organizer.problems.columns.points'),
              width: 'w-[10%]',
              cell: (problem) => (
                <span className="font-display font-semibold tabular-nums">{problem.points}</span>
              ),
            },
            {
              id: 'status',
              header: t('organizer.problems.columns.status'),
              width: 'w-[14%]',
              cell: (problem) => (
                <Badge
                  variant={STATUS_VARIANT[problem.status]}
                  data-testid={`organizer-problems-status-${problem.id}`}
                  className={problem.status === 'archived' ? 'line-through' : undefined}
                >
                  {t(`organizer.problems.status.${problem.status}`)}
                </Badge>
              ),
            },
            {
              id: 'testCases',
              header: t('organizer.problems.columns.testCases'),
              width: 'w-[10%]',
              cell: (problem) => (
                <span className="font-display font-semibold tabular-nums">
                  {problem.testCaseCount}
                </span>
              ),
            },
            {
              id: 'actions',
              header: t('organizer.problems.columns.actions'),
              width: 'w-[24%]',
              mobileLabelVisible: false,
              cell: (problem) => (
                <>
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
                </>
              ),
            },
          ]}
        />
      )}

      <AlertDialog
        open={archiveTargetId !== null}
        onOpenChange={(open) => !open && setArchiveTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={PANEL_DIALOG_TITLE}>
              {t('organizer.problems.archiveDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('organizer.problems.archiveDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('organizer.problems.archiveDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
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
