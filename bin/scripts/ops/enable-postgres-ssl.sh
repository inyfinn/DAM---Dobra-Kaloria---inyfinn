#!/bin/sh
# Enable TLS on dam-eta-postgres (Synology Docker). Idempotent.
# Usage on NAS: sh /volume1/docker/dam-eta-postgres/enable-postgres-ssl.sh
set -eu
CTR="${CTR:-dam-eta-postgres}"
DOCKER="${DOCKER:-/usr/local/bin/docker}"

$DOCKER exec -u 0 "$CTR" sh -c '
  apk add --no-cache openssl >/dev/null
  cd /var/lib/postgresql/data
  if [ ! -f server.crt ] || [ ! -f server.key ]; then
    openssl req -new -x509 -days 3650 -nodes -text \
      -out server.crt -keyout server.key \
      -subj /CN=inyfinn.synology.me
    chmod 600 server.key
    chown postgres:postgres server.key server.crt
  fi
'

$DOCKER exec -i -u postgres "$CTR" psql -U dam_eta -d dam_eta <<SQL
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_cert_file = 'server.crt';
ALTER SYSTEM SET ssl_key_file = 'server.key';
SELECT pg_reload_conf();
SQL

$DOCKER restart "$CTR"
sleep 4
$DOCKER exec -i -u postgres "$CTR" psql -U dam_eta -d dam_eta <<SQL
SHOW ssl;
SQL
echo "OK: Postgres TLS enabled on $CTR"
