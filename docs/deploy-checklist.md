# Deploy checklist — kumite event hosting

Manual, one-time (per event) steps that live outside this repo's code:
GCP/DNS provisioning, secrets, and the post-event teardown. See
`back/docs/adr/0002-event-hosting.md` for the decision this executes, and
`#62` for the issue that produced this checklist. Everything CI-automatable
(build, push, deploy, migrate, seed) is `.github/workflows/deploy.yml` —
this document only covers what a human has to do by hand.

## 1. Activate the GCP free trial

Self-serve at https://cloud.google.com/free — the $300/90-day trial, no
student or business status required. A credit card is required for
verification; no charge unless usage is explicitly upgraded past the trial.

## 2. Provision the VM

- Instance: `e2-medium`, region `southamerica-east1` (São Paulo).
- Install Docker + the Compose plugin on it (Docker's official install
  script, or the distro's packages — either way, confirm with
  `docker compose version`).

## 3. Two separate SSH keypairs

Do not reuse one key for both roles:

- **GitHub Deploy Key** (read-only): generate a keypair, add the *public*
  half to this repo's Settings → Deploy keys (read-only, no write access
  needed), keep the *private* half on the VPS for `git pull`.
- **VPS Access Key**: generate a second keypair, add the *public* half to
  the VPS's `~/.ssh/authorized_keys`, store the *private* half as the
  `VPS_SSH_KEY` GitHub Actions secret (used by `deploy.yml` to SSH in).

Also set the `VPS_HOST` and `VPS_SSH_USER` GitHub Actions secrets.

## 4. Clone the repo onto the VPS

```bash
git clone git@github.com:<owner>/kumite.git ~/kumite
```
(using the GitHub Deploy Key from step 3 — configure it in the VPS's SSH
config or `GIT_SSH_COMMAND` so `git pull` in `deploy.yml`'s SSH script works
non-interactively.)

## 5. Hand-create the env files on the VPS

Never commit these. Two files, both under `~/kumite`:

**`back/.env`** (app secrets — do *not* set `DATABASE_URL` here;
`docker-compose.prod.yml` overrides it to point at the `db` service):
```
JWT_SECRET=<generate: node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))">
ORGANIZER_EMAIL=<real organizer email>
ORGANIZER_PASSWORD=<real organizer password, >=8 chars>
```

**`.env`** (root — read by `docker-compose.prod.yml`):
```
POSTGRES_PASSWORD=<a real password, not "kumite">
KUMITE_DOMAIN=kumite-api.ligadealgoritmos.com
CADDY_EMAIL=<an email Let's Encrypt can contact about cert issues>
GHCR_OWNER=<github owner, e.g. guicassol8>
```

## 6. Authenticate the VPS to GHCR

One-time, so `docker compose pull` can fetch the private-by-default GHCR
image. Pipe the PAT through stdin, not `-p` — a CLI arg lands in shell
history and `ps`:
```bash
echo <a PAT with read:packages> | docker login ghcr.io -u <github-username> --password-stdin
```

## 7. DNS

Add an A record: `kumite-api.ligadealgoritmos.com` → the VM's public IP.

## 8. First deploy (by hand)

Every later deploy is automated by `deploy.yml`; the very first one is manual
because the VM starts with no image pulled yet and no schema migrated:
```bash
cd ~/kumite
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec -T back pnpm --filter @kumite/back db:migrate
docker compose -f docker-compose.prod.yml exec -T back pnpm --filter @kumite/back db:seed
```

## 9. Point the front at the live back

In the Vercel project settings, update `VITE_API_URL` to
`https://kumite-api.ligadealgoritmos.com` and redeploy the front (front
stays on Vercel — see the ADR's amendment).

## 10. Smoke test (Acceptance: signup, login, a real submission)

Reuse the existing hurl suite against the live host:
```bash
HURL_HOST=https://kumite-api.ligadealgoritmos.com \
ORGANIZER_EMAIL=<the real organizer email> \
ORGANIZER_PASSWORD=<the real organizer password> \
pnpm --filter @kumite/back hurl
```
`auth.hurl` / `problems.hurl` / `submissions.hurl` already cover signup,
login, reading a problem, and a real submission — no new test file needed.

## 11. SSE 10-minute hold check (Acceptance: SSE survives 10 minutes)

```bash
curl -N --max-time 650 -H "Authorization: Bearer <a real JWT>" \
  https://kumite-api.ligadealgoritmos.com/sse
```
Must still be streaming past the 600s mark — not dropped by Caddy or the VM.

## 12. Between activation and the event

- Stop the VM after the initial smoke test to conserve trial credit; resume
  it a few days before the event (`docker compose up -d` picks back up
  where it left off — the named volumes persist data and certs).

## 13. Post-event teardown

- Stop and delete the VM.
- Remove the DNS A record.
- Revoke the GHCR PAT (step 6) and the GitHub Deploy Key (step 3).
- Revert the Vercel `VITE_API_URL` if the event environment shouldn't
  outlive the event.
