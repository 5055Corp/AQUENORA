#!/bin/sh
# Production start: bring the database up to date, then run the server.
set -e

# Only safe changes run automatically. Anything that would delete data (e.g. dropping a link table)
# is skipped and must be run by hand with `npx medusa db:migrate` after a backup.
npx medusa db:migrate --execute-safe-links --execute-safe-search --all-or-nothing

exec npx medusa start
