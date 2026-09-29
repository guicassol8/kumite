import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { X } from 'lucide-react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { useSession } from '@/hooks/use-session'
import { fetchPracticeProblems, practiceProblemsQueryKey } from '@/lib/problems-query'

import { TOUR_STEPS, type TourStep, tourStepKeys } from './tour-steps'

/** How long a step waits for its target before opening centered (#213). */
export const TOUR_TARGET_TIMEOUT_MS = 5000

/** The attribute `index.css` outlines — inline `style` is off limits here. */
const HIGHLIGHT_ATTR = 'data-tour-highlight'

type TourContextValue = {
  active: boolean
  startTour: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function useTour(): TourContextValue {
  const value = useContext(TourContext)
  if (value === null) throw new Error('useTour must be used within a TourProvider')
  return value
}

function toApiLocale(language: string): 'pt' | 'es' | 'en' {
  return language === 'es' || language === 'en' ? language : 'pt'
}

function isVisible(element: HTMLElement): boolean {
  // jsdom has no layout and no `checkVisibility`; there, present = visible.
  return typeof element.checkVisibility === 'function' ? element.checkVisibility() : true
}

function findTarget(targets: readonly string[]): HTMLElement | null {
  for (const id of targets) {
    for (const element of document.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)) {
      if (isVisible(element)) return element
    }
  }
  return null
}

/** The first visible target, as soon as the screen renders one; null on timeout. */
function waitForTarget(
  targets: readonly string[],
  signal: AbortSignal,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const found = findTarget(targets)
    if (found) {
      resolve(found)
      return
    }
    const observer = new MutationObserver(() => {
      const element = findTarget(targets)
      if (element) done(element)
    })
    const timer = setTimeout(() => done(null), TOUR_TARGET_TIMEOUT_MS)
    const onAbort = () => done(null)
    function done(element: HTMLElement | null) {
      observer.disconnect()
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve(element)
    }
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    signal.addEventListener('abort', onAbort)
  })
}

// The anchor when a step's target never showed up: a zero-size point a third
// of the way down the viewport, so the popover sits roughly centered.
const centeredAnchor = {
  getBoundingClientRect: () => {
    const x = window.innerWidth / 2
    const y = window.innerHeight / 3
    return {
      x,
      y,
      top: y,
      left: x,
      right: x,
      bottom: y,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    } as DOMRect
  },
}

type TourState = { stepIndex: number; originHref: string }
// undefined while the step is navigating / waiting; null = centered fallback.
type Resolved = { stepIndex: number; element: HTMLElement | null }

export function TourProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { status } = useSession()
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const [tour, setTour] = useState<TourState | null>(null)
  const [resolved, setResolved] = useState<Resolved | undefined>(undefined)
  // Set once a step has landed: any later change of path that the tour did not
  // make is the user leaving on their own, which ends the tour where they are.
  const expectedPathRef = useRef<string | null>(null)
  const nextButtonRef = useRef<HTMLButtonElement>(null)

  const startTour = useCallback(() => {
    setResolved(undefined)
    expectedPathRef.current = null
    setTour((current) => ({
      stepIndex: 0,
      // Restarting mid-tour keeps the place the user first left from.
      originHref: current?.originHref ?? router.state.location.href,
    }))
  }, [router])

  const endTour = useCallback(
    (returnToOrigin: boolean) => {
      const origin = tour?.originHref
      setTour(null)
      setResolved(undefined)
      expectedPathRef.current = null
      if (returnToOrigin && origin && router.state.location.href !== origin) {
        void router.navigate({ href: origin, replace: true })
      }
    },
    [router, tour],
  )

  const stepIndex = tour?.stepIndex ?? null

  // Lands each step: navigate if the screen differs, then wait for its target.
  useEffect(() => {
    if (stepIndex === null) return
    const landingIndex = stepIndex
    const step = TOUR_STEPS[landingIndex] as TourStep
    const controller = new AbortController()
    expectedPathRef.current = null
    setResolved(undefined)

    async function land() {
      let path: string
      let go: () => Promise<void>
      let targets: readonly string[] = step.targets
      const destination = step.destination
      if (destination.kind === 'path') {
        path = destination.to
        go = () => router.navigate({ to: destination.to })
      } else {
        const locale = toApiLocale(i18n.resolvedLanguage ?? i18n.language)
        // A read through the same cache entry /practice fills — the tour
        // itself never writes anything.
        const first = await queryClient
          .fetchQuery({
            queryKey: practiceProblemsQueryKey(locale),
            queryFn: () => fetchPracticeProblems(locale),
            staleTime: 60_000,
          })
          .then((problems) => problems[0] ?? null)
          .catch(() => null)
        if (controller.signal.aborted) return
        if (first) {
          path = `/practice/${first.id}`
          go = () => router.navigate({ to: '/practice/$id', params: { id: first.id } })
        } else {
          path = destination.fallback.to
          targets = destination.fallback.targets
          const to = destination.fallback.to
          go = () => router.navigate({ to })
        }
      }

      if (router.state.location.pathname !== path) await go()
      if (controller.signal.aborted) return
      expectedPathRef.current = router.state.location.pathname
      const element = await waitForTarget(targets, controller.signal)
      if (controller.signal.aborted) return
      setResolved({ stepIndex: landingIndex, element })
    }

    void land()
    return () => controller.abort()
    // `i18n` is the singleton instance, so switching language mid-step
    // re-renders the texts without re-landing the step.
  }, [stepIndex, router, queryClient, i18n])

  const element = resolved?.element ?? null

  // Highlight + bring into view; cleared on the next step and on exit.
  useEffect(() => {
    if (!element) return
    element.setAttribute(HIGHLIGHT_ATTR, '')
    element.scrollIntoView?.({ block: 'center', inline: 'nearest' })
    return () => element.removeAttribute(HIGHLIGHT_ATTR)
  }, [element])

  // The user navigated elsewhere on their own: the tour just ends, there.
  useEffect(() => {
    if (tour && expectedPathRef.current !== null && pathname !== expectedPathRef.current) {
      endTour(false)
    }
  }, [pathname, tour, endTour])

  // Logged out mid-tour: nothing left to show.
  useEffect(() => {
    if (tour && status !== 'authenticated') endTour(false)
  }, [status, tour, endTour])

  const anchorRef = useMemo(() => ({ current: element ?? centeredAnchor }), [element])
  const value = useMemo(() => ({ active: tour !== null, startTour }), [tour, startTour])

  const open = tour !== null && resolved !== undefined && resolved.stepIndex === tour.stepIndex
  const step = tour ? TOUR_STEPS[tour.stepIndex] : undefined
  const isFirst = tour?.stepIndex === 0
  const isLast = tour?.stepIndex === TOUR_STEPS.length - 1
  const keys = step ? tourStepKeys(step.id) : null

  return (
    <TourContext.Provider value={value}>
      {children}
      {tour && step && keys && (
        <Popover open={open}>
          <PopoverAnchor virtualRef={anchorRef} />
          <PopoverContent
            data-testid="tour-popover"
            data-tour-step={step.id}
            aria-label={t('onboarding.tour.label')}
            side="bottom"
            collisionPadding={16}
            className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              nextButtonRef.current?.focus()
            }}
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={() => endTour(true)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <span
                  data-testid="tour-step-indicator"
                  className="font-display text-muted-foreground text-xs uppercase tracking-wide"
                >
                  {t('onboarding.tour.position', {
                    current: tour.stepIndex + 1,
                    total: TOUR_STEPS.length,
                  })}
                </span>
                <h2 data-testid="tour-step-title" className="font-display font-semibold text-lg">
                  {t(keys.title)}
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="tour-exit"
                aria-label={t('onboarding.tour.exit')}
                className="-mt-1 -mr-2 shrink-0"
                onClick={() => endTour(true)}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <p data-testid="tour-step-body" className="text-sm">
              {t(keys.body)}
            </p>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="tour-prev"
                disabled={isFirst}
                onClick={() =>
                  setTour((current) =>
                    current ? { ...current, stepIndex: Math.max(0, current.stepIndex - 1) } : null,
                  )
                }
              >
                {t('onboarding.tour.prev')}
              </Button>
              {isLast ? (
                <Button
                  ref={nextButtonRef}
                  type="button"
                  size="sm"
                  data-testid="tour-finish"
                  onClick={() => endTour(true)}
                >
                  {t('onboarding.tour.finish')}
                </Button>
              ) : (
                <Button
                  ref={nextButtonRef}
                  type="button"
                  size="sm"
                  data-testid="tour-next"
                  onClick={() =>
                    setTour((current) =>
                      current ? { ...current, stepIndex: current.stepIndex + 1 } : null,
                    )
                  }
                >
                  {t('onboarding.tour.next')}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </TourContext.Provider>
  )
}
