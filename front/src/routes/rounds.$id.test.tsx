import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: {
    rounds: Object.assign(vi.fn(), {
      ':id': { $get: vi.fn() },
    }),
  },
}))

const connectEventStream = vi.fn()
vi.mock('@/lib/sse-client', () => ({
  connectEventStream: (...args: unknown[]) => connectEventStream(...args),
}))

import '@/i18n'

import { api } from '@/lib/api'
import { clearSession, type SessionUser, setSession } from '@/lib/session'
import type { SseConnectionStatus } from '@/lib/sse-client'
import type { SseEvent } from '@/lib/sse-schema'
import { routeTree } from '@/routeTree.gen'

const mockedGet = vi.mocked(api.rounds[':id'].$get)
const sseUnsubscribe = vi.fn()

function emitSse(event: SseEvent) {
  const onEvent = connectEventStream.mock.calls.at(-1)?.[0] as (e: SseEvent) => void
  act(() => onEvent(event))
}

function emitStatus(status: SseConnectionStatus) {
  const onStatusChange = connectEventStream.mock.calls.at(-1)?.[1] as (
    s: SseConnectionStatus,
  ) => void
  act(() => onStatusChange(status))
}

// biome-ignore lint/suspicious/noExplicitAny: minimal fetch Response stubs
function jsonResponse(status: number, body: unknown): any {
  return { status, json: async () => body }
}

const fakeUser: SessionUser = {
  id: 'u1',
  email: 'ada@edu.pucrs.br',
  role: 'participant',
  university: 'pucrs',
  active: true,
  mustChangePassword: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

function roundDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    name: 'Rodada 1',
    status: 'open',
    durationMinutes: 30,
    openedAt: '2026-09-02T12:00:00.000Z',
    closesAt: '2026-09-02T12:30:00.000Z',
    closedAt: null,
    problems: [
      {
        problemId: 'p1',
        position: 0,
        title: 'Soma',
        difficulty: 'easy',
        points: 10,
        bestScore: null,
      },
    ],
    ...overrides,
  }
}

function renderRound(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/rounds/r1'] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, queryClient }
}

beforeEach(() => {
  mockedGet.mockReset()
  connectEventStream.mockReset()
  connectEventStream.mockReturnValue(sseUnsubscribe)
  sseUnsubscribe.mockClear()
  setSession(fakeUser, 'tok-1')
})

afterEach(() => {
  cleanup()
  clearSession('manual')
})

describe('RoundDetailScreen', () => {
  it('shows a loading state before the round resolves', async () => {
    mockedGet.mockReturnValue(new Promise(() => {}))

    renderRound()

    expect(await screen.findByTestId('round-detail-loading')).toBeDefined()
  })

  it('renders the not-found state for an unknown round', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(404, { error: 'not_found', message: 'Round not found' }),
    )

    renderRound()

    expect(await screen.findByTestId('round-detail-not-found')).toBeDefined()
  })

  it('renders the same not-found state for a malformed round id (#94)', async () => {
    mockedGet.mockResolvedValue(jsonResponse(422, { error: 'validation_failed', issues: {} }))

    renderRound()

    expect(await screen.findByTestId('round-detail-not-found')).toBeDefined()
  })

  it('hides every score and shows the live countdown for an open round tracked by the event stream', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, roundDetail()))

    renderRound()

    expect(await screen.findByTestId('round-problem-p1')).toBeDefined()
    expect(screen.getByTestId('round-problem-p1').textContent).toContain('—')
    expect(screen.queryByTestId('round-countdown')).toBeNull()
    expect(screen.getByTestId('round-problem-p1').querySelector('a')?.getAttribute('href')).toBe(
      '/problem/p1',
    )

    emitSse({
      type: 'state.sync',
      serverTime: new Date('2026-09-02T12:10:00.000Z'),
      round: { id: 'r1', closesAt: new Date('2026-09-02T12:30:00.000Z') },
    })

    expect(await screen.findByTestId('round-countdown')).toBeDefined()
  })

  it('shows the real best score, or the placeholder for a never-submitted problem, once closed', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(
        200,
        roundDetail({
          status: 'closed',
          closedAt: '2026-09-02T13:00:00.000Z',
          problems: [
            {
              problemId: 'p1',
              position: 0,
              title: 'Soma',
              difficulty: 'easy',
              points: 10,
              bestScore: 8,
            },
            {
              problemId: 'p2',
              position: 1,
              title: 'Produto',
              difficulty: 'medium',
              points: 20,
              bestScore: null,
            },
          ],
        }),
      ),
    )

    renderRound()

    expect(await screen.findByTestId('round-problem-p1')).toBeDefined()
    expect(screen.getByTestId('round-problem-p1').textContent).toContain('8')
    expect(screen.getByTestId('round-problem-p2').textContent).toContain('—')
    expect(screen.queryByTestId('round-countdown')).toBeNull()
    expect(screen.getByTestId('round-problem-p1').querySelector('a')?.getAttribute('href')).toBe(
      '/problem/p1',
    )
    expect(screen.getByTestId('round-problem-p2').querySelector('a')?.getAttribute('href')).toBe(
      '/problem/p2',
    )
  })

  it('shows and hides the connection indicator as the event stream status changes', async () => {
    mockedGet.mockResolvedValue(jsonResponse(200, roundDetail()))

    renderRound()
    await screen.findByTestId('round-problem-p1')

    expect(screen.queryByTestId('round-connection-status')).toBeNull()

    emitStatus('reconnecting')
    expect(screen.getByTestId('round-connection-status')).toBeDefined()

    emitStatus('open')
    expect(screen.queryByTestId('round-connection-status')).toBeNull()
  })

  it('shows the just-closed notice exactly once when the round flips to closed, and it can be dismissed', async () => {
    mockedGet
      .mockResolvedValueOnce(jsonResponse(200, roundDetail()))
      .mockResolvedValueOnce(
        jsonResponse(200, roundDetail({ status: 'closed', closedAt: '2026-09-02T13:00:00.000Z' })),
      )

    renderRound()
    await screen.findByTestId('round-problem-p1')
    expect(screen.queryByTestId('round-just-closed-notice')).toBeNull()

    emitSse({
      type: 'round.closed',
      serverTime: new Date('2026-09-02T13:00:00.000Z'),
      roundId: 'r1',
    })

    await waitFor(() => {
      expect(screen.getByTestId('round-just-closed-notice')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Dispensar'))
    expect(screen.queryByTestId('round-just-closed-notice')).toBeNull()
  })

  it('does not show the just-closed notice when the round is already closed on first load', async () => {
    mockedGet.mockResolvedValue(
      jsonResponse(200, roundDetail({ status: 'closed', closedAt: '2026-09-02T13:00:00.000Z' })),
    )

    renderRound()

    await screen.findByTestId('round-problem-p1')
    expect(screen.queryByTestId('round-just-closed-notice')).toBeNull()
  })
})
