# ADR-0002: Event hosting

- **Status:** Accepted
- **Date:** 2026-09-06
- **Deciders:** guicassol8 (product/eng), Claude (spike research)

## Context

kumite runs for a small, days-long event (hundreds of users, end of Oct
2026), not as a continuously-operated production service. `#62`'s leaderboard
holds SSE connections open for up to 10 minutes per client — a hard
requirement that rules out any host that idles or recycles long-lived HTTP
connections. `docker-compose.yml` already models the app's shape for local
dev: `back` + Postgres, no other moving parts.

Given that shape, the two real options are a single VPS running that same
compose file, or a PaaS (Fly.io / Railway / Render). Criteria, in the order
they matter for this event: cost for a few days of uptime, verified support
for 10-minute SSE holds, whether Postgres needs to be managed separately,
setup/teardown simplicity, and latency for users in Porto Alegre and Mérida.

## Decision

We will host the event on a **single VPS on Google Cloud Platform**
(`e2-small`, `southamerica-east1` / São Paulo), provisioned under GCP's
$300/90-day free trial (self-serve signup, no student or business status
required — the user's GitHub Student Pack DigitalOcean credit expired
2026-08-01 and no longer applies).

The VM runs the existing `docker-compose.yml` (back + Postgres) plus a
reverse proxy — Caddy, for automatic HTTPS — serving the built front. This is
an extension of the compose file that already exists for local dev, not a
new architecture.

High-level steps:
1. Activate the GCP free trial (self-serve).
2. Provision the `e2-small` VM in `southamerica-east1`.
3. `docker compose up` on the VM: `back` + Postgres + Caddy (reverse proxy +
   TLS) serving the built front.
4. Point DNS (or the front's `VITE_API_URL`, if no custom domain) at the VM.
5. Smoke test end to end.
6. Stop the VM after the initial smoke test; resume it a few days before the
   event.
7. Tear down after the event.

`#62` (blocked by this issue) builds the actual production compose file,
Caddyfile, seed script, and teardown checklist — this ADR only fixes *where*
and *how* the event is hosted, not the deploy scripting itself.

## Alternatives considered

### Fly.io
No free tier since October 2024; managed Postgres starts at $38/mo. Rejected
on cost for an event that only needs a few days of uptime.

### Render
The free web service tier spins down after 15 minutes idle, which breaks the
10-minute SSE hold-open requirement outright. The paid tier avoids the
spin-down but still routes traffic through Render's own proxy — its behavior
under a 10-minute held-open connection is unverified and not worth the risk
for this event.

### Railway
Workable: $5/mo hobby plan plus usage-based Postgres. Still adds a proxy
layer with unverified SSE idle-timeout behavior, for no real benefit over a
VPS we already have a working compose file for.

### Oracle Cloud Always Free
$0 forever, but the always-free tier was just cut (4 OCPU/24GB → 2 OCPU/12GB,
June 2026) and the platform has a known flaky signup / capacity-allocation
reputation. Too risky to depend on inside a one-session timebox with no
fallback window.

### Azure for Students
$100 self-serve credit, no credit card required. Rejected on setup weight:
Azure's compute provisioning is heavier than standing up a plain VM for a
workload this small.

### Plain paid VPS (Hetzner / DigitalOcean)
Also viable — roughly $5-10 total for the event regardless of credits. GCP's
trial covers the same workload at $0 and adds a São Paulo region (better
latency for Porto Alegre and Mérida than a US/EU-only provider), so GCP is
preferred. This remains the fallback if the GCP trial signup has friction.

## Consequences

### Positive
- Near-zero cost: the whole event fits inside the $300/90-day GCP trial.
- Full control of the reverse proxy's timeouts, so the 10-minute SSE
  requirement can be configured and verified directly, instead of trusting
  an opaque PaaS proxy.
- Reuses the existing `docker-compose.yml` instead of introducing a second
  deploy shape to maintain.
- São Paulo region keeps latency reasonable for both Porto Alegre and
  Mérida relative to a US-only or EU-only host.

### Negative / costs
- GCP account and billing setup has some overhead (trial activation, billing
  profile) compared to a PaaS's `git push`-to-deploy flow.
- The 90-day trial clock starts at activation, not at event time — not an
  issue here since the event is roughly seven weeks out, but the VM must be
  explicitly torn down after the event so usage doesn't drift into paid
  billing once the trial ends.
- Unlike a managed-Postgres PaaS, Postgres backups/upgrades are the team's
  own responsibility for the VM's lifetime — acceptable given the event is
  days long, not an ongoing production service.

### Follow-ups
- `#62` defines the production `docker-compose.yml` overrides, the Caddyfile,
  the seed script, and the post-event teardown checklist.
- `#62` should verify the 10-minute SSE hold-open behavior end to end through
  Caddy before the event, not just assume it from the proxy's config.

## Amendment (2026-09-06)

`#62`'s planning session corrected this ADR's scope: the front stays on
**Vercel**, where it is already live and auto-deploys on push to `main`
(`docs/workflow.md` § Releases already treats `main` as the release branch
Vercel deploys from). It is not served by Caddy from the VPS as the
"serving the built front" language above implied.

The VPS/Caddy therefore only host **back + Postgres**. `docker-compose.prod.yml`
reflects this: three services (`db`, `back`, `caddy`), no static file serving
for the front. The front's `VITE_API_URL` is repointed at the VPS's domain
(`kumite-api.ligadealgoritmos.com`) instead of the VPS serving both halves —
this is a one-line Vercel env var change, not a deploy architecture change.

The rest of this ADR (region, VM size, trial, cost/criteria analysis) is
unaffected — only the "what the VPS serves" scope narrows.
