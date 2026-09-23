// Shared by the `/sse` specs that count reconnects (#189, #291).
//
// React StrictMode (dev) runs every effect twice, so each attempt leaves as
// two near-simultaneous requests and the extra connection is aborted within a
// few ms — `e2e/sse-single-connection.spec.ts` documents the same artifact.
// Measured in #189: offsets [0, 5, 2029, 6038] for one run, i.e. the twin at
// +5ms and then the real retries at +2s and +4s. Collapsing requests that
// land inside this window counts retry *rounds*, which is what the backoff is
// about; the raw request count would just be measuring StrictMode.
export const STRICT_MODE_WINDOW_MS = 500

export function retryRounds(attempts: number[]): number[] {
  const rounds: number[] = []
  for (const at of attempts) {
    const last = rounds.at(-1)
    if (last === undefined || at - last > STRICT_MODE_WINDOW_MS) rounds.push(at)
  }
  return rounds
}
