import { describe, expect, it } from 'vitest'

import { createSemaphore } from './semaphore'

type Deferred = {
  promise: Promise<string>
  resolve: (value: string) => void
  reject: (error: Error) => void
}

function deferred(): Deferred {
  let resolve: (value: string) => void = () => {}
  let reject: (error: Error) => void = () => {}
  const promise = new Promise<string>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// Lets every pending promise callback run.
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

describe('createSemaphore (#447)', () => {
  it('runs at most `limit` tasks at once and queues the rest', async () => {
    const semaphore = createSemaphore(3)
    const tasks = Array.from({ length: 5 }, () => deferred())
    const started: number[] = []

    const results = tasks.map((task, i) =>
      semaphore.run(() => {
        started.push(i)
        return task.promise
      }),
    )

    expect(started).toEqual([0, 1, 2])
    expect(semaphore.load()).toEqual({ inFlight: 3, waiting: 2 })

    tasks[1]?.resolve('one')
    await flush()
    expect(started).toEqual([0, 1, 2, 3])
    expect(semaphore.load()).toEqual({ inFlight: 3, waiting: 1 })

    for (const task of tasks) task.resolve('done')
    await expect(Promise.all(results)).resolves.toEqual(['done', 'one', 'done', 'done', 'done'])
    expect(semaphore.load()).toEqual({ inFlight: 0, waiting: 0 })
  })

  it('starts a task synchronously when a slot is free', () => {
    const semaphore = createSemaphore(1)
    let started = false

    void semaphore.run(async () => {
      started = true
    })

    expect(started).toBe(true)
  })

  it('serves the queue in arrival order', async () => {
    const semaphore = createSemaphore(1)
    const tasks = Array.from({ length: 4 }, () => deferred())
    const started: number[] = []

    const results = tasks.map((task, i) =>
      semaphore.run(() => {
        started.push(i)
        return task.promise
      }),
    )

    for (const [i, task] of tasks.entries()) {
      expect(started).toEqual(Array.from({ length: i + 1 }, (_, k) => k))
      task.resolve(`t${i}`)
      await flush()
    }
    await expect(Promise.all(results)).resolves.toEqual(['t0', 't1', 't2', 't3'])
  })

  it('never lets a newcomer overtake a waiter when a slot frees', async () => {
    const semaphore = createSemaphore(1)
    const first = deferred()
    const started: string[] = []

    void semaphore.run(() => first.promise)
    void semaphore.run(async () => {
      started.push('waiter')
    })
    first.resolve('done')
    // Arrives in the same tick the first task settles, before any flush.
    void semaphore.run(async () => {
      started.push('newcomer')
    })
    await flush()

    expect(started).toEqual(['waiter', 'newcomer'])
  })

  it('frees the slot when a task rejects', async () => {
    const semaphore = createSemaphore(1)
    const failing = deferred()
    const failed = semaphore.run(() => failing.promise)
    const next = semaphore.run(async () => 'next')

    failing.reject(new Error('boom'))

    await expect(failed).rejects.toThrow('boom')
    await expect(next).resolves.toBe('next')
    expect(semaphore.load()).toEqual({ inFlight: 0, waiting: 0 })
  })

  it('frees the slot when a task throws synchronously', async () => {
    const semaphore = createSemaphore(1)
    const thrown = semaphore.run((): Promise<string> => {
      throw new Error('sync boom')
    })
    const next = semaphore.run(async () => 'next')

    await expect(thrown).rejects.toThrow('sync boom')
    await expect(next).resolves.toBe('next')
    expect(semaphore.load()).toEqual({ inFlight: 0, waiting: 0 })
  })

  it('frees the slot when a queued task throws synchronously', async () => {
    const semaphore = createSemaphore(1)
    const first = deferred()
    void semaphore.run(() => first.promise)
    const thrown = semaphore.run((): Promise<string> => {
      throw new Error('queued sync boom')
    })
    const last = semaphore.run(async () => 'last')

    first.resolve('done')

    await expect(thrown).rejects.toThrow('queued sync boom')
    await expect(last).resolves.toBe('last')
    expect(semaphore.load()).toEqual({ inFlight: 0, waiting: 0 })
  })

  it.each([0, -1, 1.5, Number.NaN])('refuses a limit of %s', (limit) => {
    expect(() => createSemaphore(limit)).toThrow(/positive integer/)
  })
})
