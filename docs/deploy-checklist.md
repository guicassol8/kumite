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

**e. While still in the sandbox, verify the bug-report inbox too.** The
sandbox restricts *recipients*, not just senders, and in-app bug reports
(#145) are sent **to** `BUG_REPORT_TO_EMAIL` — `ligadealgoritmos@gmail.com` by
default. Until item d is granted, create an email-address identity for that
inbox as well (SES → Identities → the address, then click the link AWS mails
to it), otherwise every report fails at send time and the participant sees a
502 in the dialog. Once production access is granted this stops mattering.

## 6. Hand-create the env files on the VPS

Never commit these. Two files, both under `~/kumite`:

**`back/.env`** (app secrets — do *not* set `DATABASE_URL` here;
`docker-compose.prod.yml` overrides it to point at the `db` service):
```
JWT_SECRET=<generate: node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))">
APP_BASE_URL=https://kumite.ligadealgoritmos.com
ORGANIZER_EMAIL=<real organizer email>
ORGANIZER_PASSWORD=<real organizer password, >=8 chars>
SES_REGION=us-east-1
SES_ACCESS_KEY_ID=<the IAM access key from step 5c>
SES_SECRET_ACCESS_KEY=<its secret>
SES_FROM_EMAIL=Liga de Algoritmos - PUCRS <contato@ligadealgoritmos.com>
BUG_REPORT_TO_EMAIL=ligadealgoritmos@gmail.com
```
`SES_REGION` must be the region of step 5, and `SES_FROM_EMAIL` the identity
verified there. `SES_FROM_EMAIL` is optional — the value above is already the
default in `back/src/config.ts`; set it only if the sender changes. So is
`BUG_REPORT_TO_EMAIL`, the inbox that receives in-app bug reports (#145) —
listed here because it is the one address a *recipient*-side sandbox
restriction applies to (step 5e).

`APP_BASE_URL` is the public front URL (the Vercel deploy of step 10) and is
what the password-reset email turns into a clickable link
(`${APP_BASE_URL}/reset-password`, #162). Leave it out and the email still
sends, pointing everyone at `http://localhost:5173` — the default. Since #273
that no longer goes unnoticed: the same value is the CORS allowlist (below),
so the production front is blocked outright.

It is also the back's CORS allowlist (#273): the API answers
`Access-Control-Allow-Origin` only to `APP_BASE_URL` and to
`http://localhost:5173` (always allowed, for local dev). So it must be the
**exact** origin the browser shows for the front: scheme + host (+ port if
any), no path. A mistake here is not silent: every call the front makes gets
blocked by CORS in the browser. A front served from any other host (a
`*.vercel.app` preview, a `www.` variant) is refused too; point the domain
at one origin, or add that origin in `back/src/config.ts` (`CORS_ORIGINS`).

Miss any one of the three SES credentials and the failure is silent: the back
falls back to logging the OTP inside the container and
`POST /auth/request-password-reset` still answers 204 (ADR-0003), so nobody
resets a password and nothing looks broken. Confirm with
`docker compose -f docker-compose.prod.yml logs back | grep notifications` —
a `[notifications] password reset OTP for ...` line means SES is *not*
configured.

Every remaining back setting (`JUDGE_*`, `SUBMISSION_*`, `PASSWORD_RESET_*`,
`BUG_REPORT_COOLDOWN_MS`)
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
(default `latest`, pin a commit sha to roll a deploy back — see **Rolling
back** in §9) are the only
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
# Create the backup directory BEFORE the first `up -d`. It is a bind mount, so
# if it does not exist Docker creates it owned by root, and the by-hand dump in
# §13 then cannot write into it. Created here, it belongs to you and the
# container (root) still writes into it fine.
mkdir -p backups
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec -T back pnpm --filter @kumite/back db:migrate
docker compose -f docker-compose.prod.yml exec -T back pnpm --filter @kumite/back db:seed
```

`db:seed` is insert-if-missing everywhere (#287): `deploy.yml` re-runs it on
every release, and it never overwrites the organizer account, the event codes
or the event configuration the organizer changed in the panel. `db:reset`
(the local, wipe-everything variant) refuses any non-local database, so it
cannot be pointed at this one by accident.

**Disk cleanup on every deploy (#429).** `deploy.yml` runs
`docker image prune -f` twice: right before
`docker compose -f docker-compose.prod.yml pull back`, to remove the leftover
of an aborted deploy, and after `db:seed`, to remove the image `up -d` just
replaced. The back image is ~2 GB and the VM disk 9.7 GB, and on v0.5.0 the
`pull` no longer fit. The prune removes only dangling images, the untagged ones
no container uses. It leaves alone the named volumes (`db-data-prod`,
`caddy-data`, `caddy-config`), the `./backups` bind mount and the images in use
by `db`, `backup` and `caddy`. To check it after a release:
```bash
docker images -f dangling=true   # empty
docker images                    # one kumite-back, plus postgres:17-alpine and caddy:2-alpine
df -h /
```

**Caddyfile changes need a recreate (#438).** `deploy.yml` runs `git pull` and
`up -d`, and `up -d` does not recreate the `caddy` container when only the
Caddyfile changed. The Caddyfile is a single-file bind mount, and `git pull`
writes the new version as a new inode, so the running container keeps reading
the old file. After a release that touches the Caddyfile, apply it by hand:
```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate caddy
```
The `keepalive 2m` that #438 pinned equals Caddy's default, so that release
needs no recreate: the value is already the one running.

**Rolling back.** Pin the previous release's full 40-character commit sha
(the tag `deploy.yml` pushes; a short sha matches no tag) in the root `.env`,
then pull, recreate and untag the bad `latest`:
```bash
# in ~/kumite/.env
TAG=<sha>
```
```bash
docker compose -f docker-compose.prod.yml pull back
docker compose -f docker-compose.prod.yml up -d
docker image rm ghcr.io/<owner>/kumite-back:latest
```
The image comes from GHCR, not from the VM: the deploy prune already removed
the previous local copy. The pull needs the login from §7. It works because
`deploy.yml` publishes every release as both `:latest` and `:<sha>`, and
nothing deletes the sha tags. Rolling the image back does not undo migrations.

The `docker image rm` of `:latest` is not optional. After `up -d` no container
uses that image, but it still has its tag, so it is not dangling and no prune
removes it. Left there, the next release holds three back images during its
`pull` (that `latest`, the pinned sha in use and the new one), and three no
longer fit on the disk.

Remove `TAG` from `.env` before the next release (while it is pinned, the
deploy pulls the pinned sha, not the new `latest`). Once that release is up,
delete the sha image by hand: it is tagged, so the prune keeps it, and before
that release it is still in use, so `docker image rm` refuses it:
```bash
docker image rm ghcr.io/<owner>/kumite-back:<sha>
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

- **Dump at the end of each day of the event, and copy it off the VM — before
  stopping anything.** Stopping the VM is the point of no return here, not
  deleting it: once it is stopped there is nothing running to dump from, and a
  stopped VM that never comes back (trial expired, project deleted) takes the
  submissions, the ranking and the participant list with it — exactly what the
  organisation needs for the certificates and the report with Mérida. On the
  VM:
  ```bash
  cd ~/kumite
  mkdir -p backups
  # On a VM deployed before the backup service existed, Docker created
  # ./backups itself and it belongs to root — the redirect below would then
  # fail with "Permission denied". This makes it yours; it is a no-op once done.
  [ -w backups ] || sudo chown "$USER" backups
  docker compose -f docker-compose.prod.yml exec -T db \
    pg_dump -U kumite kumite | gzip > backups/kumite-$(date +%F).sql.gz
  ```
  then, **from your own machine** (that is where `gcloud` is authenticated):
  ```bash
  gcloud compute scp <vm>:~/kumite/backups/kumite-<date>.sql.gz . \
    --zone southamerica-east1-b
  ```
  The dashes in that name (`kumite-2026-10-03.sql.gz`) are deliberate:
  automatic rotation only ever deletes `kumite-YYYYMMDD-HHMMSS.sql.gz`, so a
  dump you took by hand is never rotated away.

- The `backup` service dumps the database every 15 minutes on its own and
  keeps the newest 48 — a 12-hour window — in `~/kumite/backups`
  (`BACKUP_INTERVAL_SECONDS` and `BACKUP_KEEP` in `.env.example` widen it
  without a code deploy). Those copies are on the VM's disk only: they cover a
  wrong `docker compose down -v`, a bad migration or a full disk, **not**
  losing the VM. That is what the daily `scp` above is for. Check on them with:
  ```bash
  docker compose -f docker-compose.prod.yml logs --tail 20 backup
  ls -lh ~/kumite/backups
  ```
  Every cycle logs the file it wrote and the free space left. A cycle that
  fails logs `[backup] ERRO …`, deletes nothing and leaves the `back`
  container alone — it never drops a good dump to make room for a bad one, so
  a run of failures shows up as dumps that stop getting newer, never as an
  empty directory.

- Stop the VM after the initial smoke test to conserve trial credit; resume
  it a few days before the event (`docker compose up -d` picks back up
  where it left off — the named volumes persist data and certs).

## 14. Post-event teardown

**0. Dump first. Everything below this line is irreversible.** The automatic
dumps live in `~/kumite/backups` *on the VM*, so deleting the VM deletes them
too. Take a final dump and copy the whole rotated set out before touching
anything else:
```bash
# on the VM
cd ~/kumite
mkdir -p backups
# Docker may have created ./backups as root (see §13) — the redirect below
# fails with "Permission denied" until this runs. No-op if already yours.
[ -w backups ] || sudo chown "$USER" backups
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U kumite kumite | gzip > backups/kumite-final-$(date +%F).sql.gz
```
```bash
# from your own machine — the whole directory, not just the last file
gcloud compute scp --recurse <vm>:~/kumite/backups . \
  --zone southamerica-east1-b
```
Check the copy actually landed locally, and that the final dump is not
suspiciously small, before going on. Restoring one of these is §15.

- Stop and delete the VM.
- Remove the DNS A record.
- Revoke the GHCR PAT (step 7) and the GitHub Deploy Key (step 3).
- Revert the Vercel `VITE_API_URL` if the event environment shouldn't
  outlive the event.

## 15. Restore a dump onto a fresh VM

Verified end to end for #275 against two throwaway Postgres 17 containers
(evidence on that PR). The order is the whole procedure:

0. Prerequisites, if the VM really is new: §1–§12 first, up to and including
   the clone into `~/kumite` and its `.env` — this section restores data onto a
   working deploy, it does not create one. Then put the dump on the VM (it is
   on your machine, from the §13/§14 `scp`):
   ```bash
   # from your own machine
   gcloud compute scp kumite-<date>.sql.gz <vm>:~/kumite/ \
     --zone southamerica-east1-b
   ```
1. Bring up **only** the database:
   ```bash
   cd ~/kumite
   mkdir -p backups
   docker compose -f docker-compose.prod.yml up -d db
   ```
2. **Do not run `db:migrate` first.** These are plain SQL dumps of the entire
   database: they carry the schema *and* drizzle's own ledger
   (`drizzle.__drizzle_migrations`). Restoring one over an already-migrated
   database collides with `relation already exists`. The target is the empty
   database a fresh `db` container comes up with.
3. Restore:
   ```bash
   gunzip -c kumite-<date>.sql.gz | docker compose -f docker-compose.prod.yml \
     exec -T db psql -U kumite -d kumite -v ON_ERROR_STOP=1
   ```
4. Check it before trusting it — row counts per table, and a migration ledger
   holding as many rows as `back/drizzle/meta/_journal.json` has entries (21
   as of this writing):
   ```bash
   docker compose -f docker-compose.prod.yml exec -T db psql -U kumite -d kumite -c "
     select table_name,
            (xpath('/row/c/text()', query_to_xml(
               format('select count(*) as c from %I.%I', table_schema, table_name),
               false, true, '')))[1]::text::int as rows
     from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE' order by 1;"
   docker compose -f docker-compose.prod.yml exec -T db psql -U kumite -d kumite \
     -c 'select count(*) from drizzle.__drizzle_migrations;'
   ```
5. Only then bring the rest of the stack up:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```
   `db:migrate` afterwards is a no-op, and that is what proves the ledger came
   across. It prints two `NOTICE` blocks — `schema "drizzle" already exists`
   and `relation "__drizzle_migrations" already exists` — and applies nothing;
   that is drizzle-kit's own `CREATE … IF NOT EXISTS`, not a failure.
6. `db:reset` is **not** part of this. It refuses any non-local database
   (#287/#289) and is the local wipe-everything helper; the path here is an
   empty database plus `psql`.
