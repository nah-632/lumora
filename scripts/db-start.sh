#!/bin/sh
# scripts/db-start.sh — idempotent SERVO database startup (pgshim for Android PRoot)
set -e
export LD_PRELOAD=/opt/pgshim/libshm.so
PGDATA=/var/lib/pgsrv
SOCKDIR=/var/run/postgresql

# Socket dir with correct ownership (pgshim needs it for the Unix socket)
if [ ! -d "$SOCKDIR" ]; then
  mkdir -p "$SOCKDIR"
fi
chown postgres:postgres "$SOCKDIR" 2>/dev/null || true
chmod 775 "$SOCKDIR" 2>/dev/null || true

# Data dir
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "[db-start] initializing new data dir..."
  mkdir -p "$PGDATA"
  chown postgres:postgres "$PGDATA"
  su postgres -c "LD_PRELOAD=/opt/pgshim/libshm.so /usr/lib/postgresql/16/bin/initdb -D $PGDATA --encoding=UTF8 --locale=C.UTF-8" > /dev/null
  echo "listen_addresses = ''" >> "$PGDATA/postgresql.conf"
  chown postgres:postgres "$PGDATA/postgresql.conf"
fi

# Config guard: ensure listen_addresses='' is present (fresh initdb resets it)
if ! grep -q "^listen_addresses = ''" "$PGDATA/postgresql.conf"; then
  echo "listen_addresses = ''" >> "$PGDATA/postgresql.conf"
fi
chown postgres:postgres "$PGDATA/postgresql.conf"

# Start if not running
STATUS=$(su postgres -c "LD_PRELOAD=/opt/pgshim/libshm.so /usr/lib/postgresql/16/bin/pg_ctl -D $PGDATA status" 2>&1 || true)
case "$STATUS" in
  *"no server running"*|*"does not exist"*)
    su postgres -c "LD_PRELOAD=/opt/pgshim/libshm.so /usr/lib/postgresql/16/bin/pg_ctl -D $PGDATA -l /tmp/pg.log -w -t 30 start" > /dev/null 2>&1
    echo "[db-start] server started"
    ;;
  *)
    echo "[db-start] server already running"
    ;;
esac

# Ensure database and app role exist
psql -U postgres -h $SOCKDIR -tc "SELECT 1 FROM pg_database WHERE datname='servo'" | grep -q 1 || \
  psql -U postgres -h $SOCKDIR -c "CREATE DATABASE servo" > /dev/null
psql -U postgres -h $SOCKDIR -tc "SELECT 1 FROM pg_roles WHERE rolname='servo_user'" | grep -q 1 || \
  psql -U postgres -h $SOCKDIR -c "CREATE ROLE servo_user WITH LOGIN PASSWORD 'servo_pw_dev'" > /dev/null
psql -U postgres -h $SOCKDIR -d servo -tc "SELECT 1 FROM pg_roles WHERE rolname='servo_user' AND rolcanlogin" | grep -q 1 || \
  psql -U postgres -h $SOCKDIR -d servo -c "GRANT ALL PRIVILEGES ON DATABASE servo TO servo_user" > /dev/null

echo "[db-start] OK — servo DB ready on $SOCKDIR"
