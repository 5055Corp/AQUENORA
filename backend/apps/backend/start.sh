#!/bin/sh
# Production start: bring the database up to date, then run the server.
set -e

# Only safe changes run automatically. Anything that would delete data (e.g. dropping a link table)
# is skipped and must be run by hand with `npx medusa db:migrate` after a backup.
npx medusa db:migrate --execute-safe-links --execute-safe-search --all-or-nothing

# Store logos and banner photos are saved in ./static unless an S3/R2 bucket is set (S3_BUCKET).
if [ -z "$S3_BUCKET" ]; then
  mkdir -p static 2>/dev/null || true
  if ! touch static/.write-test 2>/dev/null; then
    echo "WARNING: can't save uploaded pictures in ./static. On Railway, add the variable RAILWAY_RUN_UID=0 (see DEPLOY.md)."
  else
    rm -f static/.write-test
  fi
fi

# First admin login: set ADMIN_EMAIL and ADMIN_PASSWORD on the backend service, deploy once,
# log in at /app, then delete ADMIN_PASSWORD. If that admin already exists, nothing changes.
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  if npx medusa user -e "$ADMIN_EMAIL" -p "$ADMIN_PASSWORD" >/dev/null 2>&1; then
    echo "Admin login created for $ADMIN_EMAIL"
  else
    echo "Admin login for $ADMIN_EMAIL already exists (or couldn't be created); nothing changed"
  fi
fi

exec npx medusa start
