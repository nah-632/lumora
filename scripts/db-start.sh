#!/bin/bash
# scripts/db-start.sh — idempotent LUMORA database startup (pgshim for Android PRoot)
set -e

PGDATA=/var/lib/pgsrv
SOCKDIR=/var/run/postgresql
PGBIN=/usr/lib/postgresql/16/bin
PGSHIM=/opt/pgshim/libshm.so
DB=lumora
DBUSER=lumora_user

# Clean stale state left by previous runs (PRoot has no real SysV IPC)
rm -f "$PGDATA/postmaster.pid"
su postgres -c "rm -f /var/lib/postgresql/shm/k*" 2>/dev/null || true
mkdir -p "$SOCKDIR" 2>/dev/null || true
chown postgres:postgres "$SOCKDIR" 2>/dev/null || true
chmod 775 "$SOCKDIR" 2>/dev/null || true

STATUS=$(su postgres -c "LD_PRELOAD=$PGSHIM $PGBIN/pg_ctl -D $PGDATA status" 2>&1 || true)
if echo "$STATUS" | grep -q "no server running"; then
  echo "[db-start] starting Postgres..."
  su postgres -c "LD_PRELOAD=$PGSHIM $PGBIN/pg_ctl -D $PGDATA -l /tmp/pg.log -w -t 40 start"
else
  echo "[db-start] server already running"
fi

# Create database + role if absent
su postgres -c "LD_PRELOAD=$PGSHIM psql -h $SOCKDIR -tAc \"SELECT 1 FROM pg_database WHERE datname='$DB'\"" | grep -q 1 || \
  su postgres -c "LD_PRELOAD=$PGSHIM psql -h $SOCKDIR -c 'CREATE DATABASE $DB'"

su postgres -c "LD_PRELOAD=$PGSHIM psql -h $SOCKDIR -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$DBUSER'\"" | grep -q 1 || \
  su postgres -c "LD_PRELOAD=$PGSHIM psql -h $SOCKDIR -c \"CREATE ROLE $DBUSER WITH LOGIN PASSWORD 'lumora_pw_dev'\""

su postgres -c "LD_PRELOAD=$PGSHIM psql -h $SOCKDIR -d $DB -c 'GRANT ALL PRIVILEGES ON DATABASE $DB TO $DBUSER'" >/dev/null

echo "[db-start] OK — $DB DB ready on $SOCKDIR"
