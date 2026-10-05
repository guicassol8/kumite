import { describe, expect, it } from 'vitest'

import { createEventTally, createSseParser, type SseFrame } from './sse-parser'

function parseAll(chunks: string[]): SseFrame[] {
  const frames: SseFrame[] = []
  const parser = createSseParser((frame) => frames.push(frame))
  for (const chunk of chunks) parser.push(chunk)
  return frames
}

describe('createSseParser', () => {
  it('splits frames on a blank line and reads event and data', () => {
    expect(parseAll(['event: heartbeat\ndata: {"a":1}\n\nevent: x\ndata: 2\n\n'])).toEqual([
      { event: 'heartbeat', data: '{"a":1}', id: null },
      { event: 'x', data: '2', id: null },
    ])
  })

  it('accepts CRLF line endings, even when the pair is split across chunks', () => {
    expect(parseAll(['event: a\r\ndata: 1\r', '\n\r\n', 'data: 2\r\n\r\n'])).toEqual([
      { event: 'a', data: '1', id: null },
      { event: null, data: '2', id: null },
    ])
  })

  it('joins several data lines with a newline', () => {
    expect(parseAll(['data: one\ndata: two\n\n'])).toEqual([
      { event: null, data: 'one\ntwo', id: null },
    ])
  })

  it('ignores comments and dispatches nothing for a block without data', () => {
    expect(parseAll([': keep-alive\n\nevent: only-event\n\n: c\ndata: x\n\n'])).toEqual([
      { event: null, data: 'x', id: null },
    ])
  })

  it('holds a frame split across chunks until it is complete', () => {
    const frames: SseFrame[] = []
    const parser = createSseParser((frame) => frames.push(frame))
    parser.push('event: state.sync\nda')
    parser.push('ta: {"type":"state')
    expect(frames).toEqual([])
    parser.push('.sync"}\n')
    expect(frames).toEqual([])
    parser.push('\nid: 7\ndata: z\n\n')
    expect(frames).toEqual([
      { event: 'state.sync', data: '{"type":"state.sync"}', id: null },
      { event: null, data: 'z', id: '7' },
    ])
  })

  it('keeps the value verbatim after the single optional space', () => {
    expect(parseAll(['data:  two spaces\ndata:none\n\n'])).toEqual([
      { event: null, data: ' two spaces\nnone', id: null },
    ])
  })
})

describe('createEventTally', () => {
  it('counts events by type and measures the gaps between heartbeats from injected times', () => {
    const tally = createEventTally()
    tally.record('state.sync', 0)
    tally.record('ranking.updated', 5)
    tally.record('heartbeat', 1_000)
    tally.record('heartbeat', 2_010)
    tally.record('ranking.updated', 2_500)
    tally.record('heartbeat', 3_500)

    expect(tally.snapshot()).toEqual({
      counts: { 'state.sync': 1, 'ranking.updated': 2, heartbeat: 3 },
      heartbeatIntervalsMs: [1_010, 1_490],
    })
  })

  it('has no interval before the second heartbeat', () => {
    const tally = createEventTally()
    tally.record('heartbeat', 42)
    expect(tally.snapshot().heartbeatIntervalsMs).toEqual([])
  })
})
