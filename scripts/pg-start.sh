#!/bin/bash
# Starts/ensures Postgres 16 is running via pgshim socket
set -e
rm -f /var/lib/pgsrv/postmaster.pid
su postgres -c "rm -f /var/lib/postgresql/shm/k*" 2>/dev/null || true
STATUS=$(su postgres -c "LD_PRELOAD=/opt/pgshim/libshm.so /usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/pgsrv status" 2>&1 || true)
if echo "$STATUS" | grep -q "no server running"; then
  su postgres -c "LD_PRELOAD=/opt/pgshim/libshm.so /usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/pgsrv -l /tmp/pg.log -w -t 30 start"
fi
