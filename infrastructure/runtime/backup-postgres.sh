#!/usr/bin/env bash
set -euo pipefail

cd /opt/enviro-centric

bucket="$(awk -F= '$1 == "BACKUPS_BUCKET" { print substr($0, index($0, "=") + 1) }' production.env | tail -n 1)"
if [[ -z "$bucket" ]]; then
  echo "BACKUPS_BUCKET is not configured" >&2
  exit 1
fi

timestamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
docker compose --env-file production.env -f docker-compose.production.yml exec -T db \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | aws s3 cp - "s3://${bucket}/postgres/${timestamp}.dump" --sse AES256 --only-show-errors

echo "Uploaded encrypted PostgreSQL backup: postgres/${timestamp}.dump"
