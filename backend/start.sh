#!/bin/sh
set -eu
mkdir -p "${PRIVATE_DOCUMENT_ROOT:-/data/private-documents}"
chown app:app "${PRIVATE_DOCUMENT_ROOT:-/data/private-documents}"
chmod 700 "${PRIVATE_DOCUMENT_ROOT:-/data/private-documents}"
exec gunicorn rayz.wsgi:application --bind "0.0.0.0:${PORT:-8000}" --workers 2 --user app --group app --timeout 120 --access-logfile -