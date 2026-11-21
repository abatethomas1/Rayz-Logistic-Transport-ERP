#!/bin/sh
set -eu
if [ -n "${MIGRATION_DATABASE_URL:-}" ]; then
  export DATABASE_URL="$MIGRATION_DATABASE_URL"
fi
exec python manage.py migrate --noinput