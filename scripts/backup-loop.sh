#!/bin/sh
# Periodic pg_dump of the production database (#275). Runs as the `backup`
# service of docker-compose.prod.yml, on the same image as the database
# (postgres:17-alpine), bind-mounted read-only into the container. POSIX sh on
# purpose: that image is Alpine and ships no bash.
#
# One cycle is: pg_dump -> .tmp file -> sanity check -> atomic rename ->
# rotation. That order is the whole point of this script:
#
#   * `pipefail` is load-bearing. Without it `pg_dump | gzip > f` exits 0 when
#     pg_dump fails, because gzip -- the stage that decides the status -- did
#     succeed. What is left behind is a short, perfectly valid .gz holding an
#     error message, which rotation counts as a good backup and which evicts a
#     real dump.
#   * the dump only takes its final `kumite-*.sql.gz` name after it passes the
#     sanity check, so a half-written dump is never "the most recent backup"
#     and never enters the count.
#   * rotation runs only after a new, valid dump landed. This is the analogue
#     of assertLocalDatabaseUrl (#289): refuse the destructive step before
#     running it, not after. Without it, 48 consecutive failures would delete
#     the 48 good dumps and leave 48 useless files behind -- the worst
#     possible outcome for the issue this script exists for.
#
# A failing cycle never takes the service down: it is logged on stderr, marked
# `[backup] ERRO`, and the loop waits for the next tick.
#
# Environment (all optional, all with defaults):
#   BACKUP_DIR               where dumps land         (default /backups)
#   BACKUP_INTERVAL_SECONDS  seconds between cycles   (default 900 = 15 min)
#   BACKUP_KEEP              how many dumps to keep   (default 48 = 12 h)
#   BACKUP_MIN_BYTES         sanity floor, in bytes   (default 1024)
#   BACKUP_ONCE=1            one cycle, then exit with that cycle's status
#   ROTATE_ONLY=1            rotate without dumping (exercises rotation alone)
# The connection itself comes from pg_dump's own PGHOST / PGUSER / PGDATABASE /
# PGPASSWORD variables, set by the compose service.
set -eu
# Supported by busybox ash (Alpine) as well as bash -- see the note above for
# why the script is wrong without it.
# shellcheck disable=SC3040
set -o pipefail

# The operator scps these files off the VM (deploy checklist S13/S14); 022
# keeps them readable without sudo.
umask 022

log() { echo "[backup] $*"; }
err() { echo "[backup] ERRO $*" >&2; }

# A typo in a numeric env must not stop the backups: fall back to the default
# and say so, loudly. "No backups at all" is the exact failure this service
# exists to prevent, so it is never the reaction to a bad variable.
numeric_or_default() {
  _value="$1"
  _fallback="$2"
  _name="$3"
  case "$_value" in
    '' | *[!0-9]*)
      err "$_name='$_value' nao e um numero; usando $_fallback"
      echo "$_fallback"
      ;;
    *) echo "$_value" ;;
  esac
}

BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_INTERVAL_SECONDS="$(numeric_or_default "${BACKUP_INTERVAL_SECONDS:-900}" 900 BACKUP_INTERVAL_SECONDS)"
BACKUP_KEEP="$(numeric_or_default "${BACKUP_KEEP:-48}" 48 BACKUP_KEEP)"
BACKUP_MIN_BYTES="$(numeric_or_default "${BACKUP_MIN_BYTES:-1024}" 1024 BACKUP_MIN_BYTES)"
BACKUP_ONCE="${BACKUP_ONCE:-}"
ROTATE_ONLY="${ROTATE_ONLY:-}"

# BACKUP_KEEP=0 would make rotation delete every dump it can see, which is the
# one thing this script must never do.
if [ "$BACKUP_KEEP" -lt 1 ]; then
  err "BACKUP_KEEP=$BACKUP_KEEP rotacionaria todos os backups; usando 48"
  BACKUP_KEEP=48
fi

# Rotation only ever considers this cycle's own files:
# kumite-YYYYMMDD-HHMMSS.sql.gz, digits only. The end-of-day dump the deploy
# checklist (S13) has the operator take by hand is kumite-YYYY-MM-DD.sql.gz and
# lands in the same directory -- a looser glob would let this loop delete the
# one backup a human took deliberately.
CYCLE_GLOB='kumite-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9].sql.gz'

# Deletes everything past the newest BACKUP_KEEP cycle dumps. Only ever called
# once a new, valid dump has landed.
rotate() {
  # Ordered by FILE NAME, not by mtime. The name is this script's own identity
  # for the file -- the same key CYCLE_GLOB matches on -- and is a zero-padded
  # UTC stamp, so sorting it is exactly chronological. mtime is metadata any
  # cp/scp/rsync rewrites (restoring a rotated set onto a fresh VM, S15, gives
  # every file the same fresh mtime), and when mtimes tie `ls -t` falls back to
  # name-ascending, which this loop would read as newest-first and delete the
  # NEWEST dumps. The destructive step must not depend on metadata it does not
  # own.
  _stale="$(ls -1 "$BACKUP_DIR"/$CYCLE_GLOB 2>/dev/null | sort -r | tail -n +"$((BACKUP_KEEP + 1))")" || _stale=''
  [ -n "$_stale" ] || return 0
  echo "$_stale" | while IFS= read -r _old; do
    [ -n "$_old" ] || continue
    rm -f -- "$_old"
    log "rotacionado: $(basename "$_old")"
  done
}

# Takes one dump and, only if it is sane, publishes it and rotates. Returns
# non-zero on any failure, having removed the partial file first.
run_cycle() {
  _final="$BACKUP_DIR/kumite-$(date -u +%Y%m%d-%H%M%S).sql.gz"
  _tmp="$_final.tmp"
  _name="$(basename "$_final")"

  if ! pg_dump | gzip -c > "$_tmp"; then
    rm -f -- "$_tmp"
    err "pg_dump falhou ($_name); nada foi rotacionado, os backups anteriores seguem intactos"
    return 1
  fi

  if ! gzip -t "$_tmp" 2>/dev/null; then
    rm -f -- "$_tmp"
    err "dump novo nao e um gzip valido ($_name); nada foi rotacionado"
    return 1
  fi

  _size="$(wc -c < "$_tmp" | tr -d ' ')"
  if [ "$_size" -lt "$BACKUP_MIN_BYTES" ]; then
    rm -f -- "$_tmp"
    err "dump novo tem $_size bytes, abaixo de BACKUP_MIN_BYTES=$BACKUP_MIN_BYTES ($_name); nada foi rotacionado"
    return 1
  fi

  # `grep -c >/dev/null` and not `grep -q`: -q exits at the first match, gzip
  # then dies of SIGPIPE, and under pipefail that turns a successful check into
  # a failed one.
  if ! gzip -dc "$_tmp" | grep -c -F 'COPY public.submissions' > /dev/null; then
    rm -f -- "$_tmp"
    err "dump novo nao contem 'COPY public.submissions' ($_name); nada foi rotacionado"
    return 1
  fi

  # Same directory, so the rename is atomic: readers see either no file at all
  # or a complete, validated one.
  mv -- "$_tmp" "$_final"
  log "gravado $_name ($_size bytes)"
  rotate
  # Disk pressure shows up here before it becomes an incident.
  log "disco: $(df -h "$BACKUP_DIR" | tail -n 1)"
}

mkdir -p -- "$BACKUP_DIR"

# A dump interrupted mid-write -- `docker stop` falling through to SIGKILL, a
# VM reboot, the OOM killer -- leaves its .tmp behind. That name never matches
# CYCLE_GLOB, so rotation would never reclaim it: without this sweep one
# full-dump-sized file leaks per hard kill, and a full disk is one of the loss
# scenarios #275 exists for.
for _orphan in "$BACKUP_DIR"/kumite-*.sql.gz.tmp; do
  [ -e "$_orphan" ] || continue
  rm -f -- "$_orphan"
  log "descartado dump incompleto de uma execucao anterior: $(basename "$_orphan")"
done

if [ -n "$ROTATE_ONLY" ]; then
  log "ROTATE_ONLY=1: rotacionando $BACKUP_DIR para os $BACKUP_KEEP mais recentes, sem dumpar"
  rotate
  exit 0
fi

log "iniciando: dir=$BACKUP_DIR intervalo=${BACKUP_INTERVAL_SECONDS}s keep=$BACKUP_KEEP min_bytes=$BACKUP_MIN_BYTES"

while :; do
  _status=0
  run_cycle || _status=$?
  if [ -n "$BACKUP_ONCE" ]; then
    exit "$_status"
  fi
  sleep "$BACKUP_INTERVAL_SECONDS"
done
