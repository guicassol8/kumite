import { useEffect, useRef, useState } from 'react'

// How long a row stays highlighted after its rank changes (#220 telão spec
// item 7: "realçada em --brand-soft por ~3s, esvaindo").
const HIGHLIGHT_MS = 3_000

/**
 * Tracks which rows just changed rank, for the telão's "never a silent
 * redraw" rule. Compares each render's ranks against the previous one and
 * flags a team the moment its rank differs, clearing the flag on its own
 * timer a few seconds later — independent per team, so an unrelated row
 * changing rank later does not reset an already-running highlight.
 */
export function useRankChangeHighlight(rows: { teamId: string; rank: number }[]): Set<string> {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())
  const previousRanksRef = useRef<Map<string, number>>(new Map())
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const previousRanks = previousRanksRef.current
    const changed = rows.filter((row) => {
      const previousRank = previousRanks.get(row.teamId)
      return previousRank !== undefined && previousRank !== row.rank
    })

    if (changed.length > 0) {
      setHighlighted((prev) => new Set([...prev, ...changed.map((row) => row.teamId)]))
      for (const row of changed) {
        const existing = timersRef.current.get(row.teamId)
        if (existing) clearTimeout(existing)
        const timer = setTimeout(() => {
          setHighlighted((prev) => {
            const next = new Set(prev)
            next.delete(row.teamId)
            return next
          })
          timersRef.current.delete(row.teamId)
        }, HIGHLIGHT_MS)
        timersRef.current.set(row.teamId, timer)
      }
    }

    previousRanksRef.current = new Map(rows.map((row) => [row.teamId, row.rank]))
  }, [rows])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
    }
  }, [])

  return highlighted
}
