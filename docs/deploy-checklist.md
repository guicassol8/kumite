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

## 5. Configure AWS SES (transactional email)

The back sends the password-reset OTP through SES. Do this **before** writing
the env files of step 6 — you need the access key to put in them — and start
it days before the event, not on the eve: leaving the sandbox (item d) waits
on AWS approval.

**a. Pick the region.** `us-east-1` is the recommended one. An SES identity,
the sandbox exit and `SES_REGION` are all per region and must be the *same*
region — verifying the sender in one region and pointing `SES_REGION` at
another fails every send.

**b. Verify the sender identity.** In SES → Identities, create an identity for
the domain `ligadealgoritmos.com` and publish the three DKIM CNAME records it
gives you in the domain's DNS. Wait for the status to reach "Verified".
Fallback when there is no DNS access: create an *email address* identity for
`contato@ligadealgoritmos.com` instead and click the link AWS mails to it —
that verifies the single address, enough for `SES_FROM_EMAIL`, but it does not
prove the domain.

**c. Create a dedicated IAM user for sending.** Never use an admin credential
here: the access key ends up in a plaintext file on the VPS. Create an IAM
user with programmatic access only, attach this inline policy, then generate
its access key — that pair is `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ses:SendEmail",
      "Resource": "*"
    }
  ]
}
```

**d. Request production access (leave the sandbox).** In SES → Account
dashboard, request production access for that region. A sandboxed account can
only send *to* verified addresses — the participants sign up with arbitrary
e-mails, so every reset OTP would silently fail. AWS takes up to a business
day or so to answer, which is why this step is not a day-before task.

## 6. Hand-create the env files on the VPS

Never commit these. Two files, both under `~/kumite`:

**`back/.env`** (app secrets — do *not* set `DATABASE_URL` here;
`docker-compose.prod.yml` overrides it to point at the `db` service):
```
JWT_SECRET=<generate: node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))">
ORGANIZER_EMAIL=<real organizer email>
ORGANIZER_PASSWORD=<real organizer password, >=8 chars>
SES_REGION=us-east-1
SES_ACCESS_KEY_ID=<the IAM access key from step 5c>
SES_SECRET_ACCESS_KEY=<its secret>
SES_FROM_EMAIL=Liga de Algoritmos - PUCRS <contato@ligadealgoritmos.com>
```
`SES_REGION` must be the region of step 5, and `SES_FROM_EMAIL` the identity
verified there. `SES_FROM_EMAIL` is optional — the value above is already the
default in `back/src/config.ts`; set it only if the sender changes.

Miss any one of the three SES credentials and the failure is silent: the back
falls back to logging the OTP inside the container and
`POST /auth/request-password-reset` still answers 204 (ADR-0003), so nobody
resets a password and nothing looks broken. Confirm with
`docker compose -f docker-compose.prod.yml logs back | grep notifications` —
a `[notifications] password reset OTP for ...` line means SES is *not*
configured.

Every remaining back setting (`JUDGE_*`, `SUBMISSION_*`, `PASSWORD_RESET_*`)
has a default and only needs an entry to override it — they are documented in
`back/.env.example`.

**`.env`** (root — read by `docker-compose.prod.yml`):
```
POSTGRES_PASSWORD=<a real password, not "kumite">
KUMITE_DOMAIN=kumite-api.ligadealgoritmos.com
CADDY_EMAIL=<an email Let's Encrypt can contact about cert issues>
GHCR_OWNER=<github owner, e.g. guicassol8>
```
The first three are required. `GHCR_OWNER` (default `guicassol8`) and `TAG`
(default `latest`, pin a commit sha to roll a deploy back) are the only
optional ones — see `.env.example` at the repo root, which lists exactly what
`docker-compose.prod.yml` reads.

## 7. Authenticate the VPS to GHCR

One-time, so `docker compose pull` can fetch the private-by-default GHCR
image. Pipe the PAT through stdin, not `-p` — a CLI arg lands in shell
history and `ps`:
```bash
echo <a PAT with read:packages> | docker login ghcr.io -u <github-username> --password-stdin
```

## 8. DNS

Add an A record: `kumite-api.ligadealgoritmos.com` → the VM's public IP.

## 9. First deploy (by hand)

Every later deploy is automated by `deploy.yml`; the very first one is manual
because the VM starts with no image pulled yet and no schema migrated:
```bash
cd ~/kumite
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec -T back pnpm --filter @kumite/back db:migrate
docker compose -f docker-compose.prod.yml exec -T back pnpm --filter @kumite/back db:seed
```

## 10. Point the front at the live back

In the Vercel project settings, update `VITE_API_URL` to
`https://kumite-api.ligadealgoritmos.com` and redeploy the front (front
stays on Vercel — see the ADR's amendment).

## 11. Smoke test (Acceptance: signup, login, a real submission)

Reuse the existing hurl suite against the live host:
```bash
HURL_HOST=https://kumite-api.ligadealgoritmos.com \
ORGANIZER_EMAIL=<the real organizer email> \
ORGANIZER_PASSWORD=<the real organizer password> \
pnpm --filter @kumite/back hurl
```
`auth.hurl` / `problems.hurl` / `submissions.hurl` already cover signup,
login, reading a problem, and a real submission — no new test file needed.

## 12. SSE 10-minute hold check (Acceptance: SSE survives 10 minutes)

```bash
curl -N --max-time 650 -H "Authorization: Bearer <a real JWT>" \
  https://kumite-api.ligadealgoritmos.com/sse
```
Must still be streaming past the 600s mark — not dropped by Caddy or the VM.

## 13. Between activation and the event

- Stop the VM after the initial smoke test to conserve trial credit; resume
  it a few days before the event (`docker compose up -d` picks back up
  where it left off — the named volumes persist data and certs).

## 14. Post-event teardown

- Stop and delete the VM.
- Remove the DNS A record.
- Revoke the GHCR PAT (step 7) and the GitHub Deploy Key (step 3).
- Revert the Vercel `VITE_API_URL` if the event environment shouldn't
  outlive the event.
