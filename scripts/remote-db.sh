#!/usr/bin/env bash
#
# remote-db.sh — talk to the HOSTED Supabase database from the command line.
#
# The CLI needs the database password for anything that changes the schema, and
# that password is not in this repo. Pass it in the environment:
#
#   DBPW='your-database-password' ./scripts/remote-db.sh push
#
# Commands:
#   push             apply supabase/migrations to the hosted project (records history)
#   check            list the app tables that exist, so you can see whether push worked
#   sql "<query>"    run one SQL statement and print the result
#   url              print the connection string with the password masked
#
# Overrides (rarely needed):
#   PROJECT_REF   default sqxqukrjpccphjixgyhr
#   DB_HOST       default db.$PROJECT_REF.supabase.co
#   DB_USER       default postgres
#   DB_PORT       default 5432
#
# If the direct host does not resolve or times out, your project is IPv6-only on
# that hostname. Use the session-mode pooler instead, which is IPv4:
#
#   DB_HOST='aws-0-ap-southeast-1.pooler.supabase.com' \
#   DB_USER="postgres.$PROJECT_REF" \
#   DBPW='...' ./scripts/remote-db.sh push
#
# The region in that hostname comes from Supabase dashboard > Project Settings >
# Database > Connection pooling.
#
set -euo pipefail

PROJECT_REF="${PROJECT_REF:-sqxqukrjpccphjixgyhr}"
DB_HOST="${DB_HOST:-db.${PROJECT_REF}.supabase.co}"
DB_USER="${DB_USER:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"

if [[ -z "${DBPW:-}" ]]; then
  echo "DBPW is not set. Run: DBPW='your-database-password' $0 ${1:-push}" >&2
  exit 1
fi

# A password with @ : / ? # in it breaks the URL unless it is percent-encoded.
# node is already a dependency of this project, so no extra tooling is needed.
ENCODED_PW="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$DBPW")"
DB_URL="postgresql://${DB_USER}:${ENCODED_PW}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

masked_url() {
  echo "postgresql://${DB_USER}:****@${DB_HOST}:${DB_PORT}/${DB_NAME}"
}

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "$1 is required for this command but is not installed." >&2
    exit 1
  }
}

case "${1:-push}" in
  url)
    masked_url
    ;;

  push)
    need node
    echo "Applying migrations to $(masked_url)"
    pnpm dlx supabase db push --db-url "$DB_URL"
    echo
    echo "Done. Next:"
    echo "  DBPW='...' $0 check"
    echo "  SEED_PROFILE=starter SEED_ALLOW_REMOTE=1 pnpm seed   # needs .env pointing at this project"
    ;;

  check)
    need psql
    psql "$DB_URL" -v ON_ERROR_STOP=1 -P pager=off -c "
      select table_name, (select count(*) from information_schema.columns c
                          where c.table_schema = t.table_schema and c.table_name = t.table_name) as columns
      from information_schema.tables t
      where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
      order by t.table_name;"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -P pager=off -t -c "
      select 'questions: ' || count(*) from public.questions;"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -P pager=off -t -c "
      select 'profiles:  ' || count(*) from public.profiles;"
    ;;

  sql)
    need psql
    if [[ -z "${2:-}" ]]; then
      echo "Usage: $0 sql \"select now();\"" >&2
      exit 1
    fi
    psql "$DB_URL" -v ON_ERROR_STOP=1 -P pager=off -c "$2"
    ;;

  *)
    echo "Unknown command: $1" >&2
    echo "Use one of: push, check, sql, url" >&2
    exit 1
    ;;
esac
