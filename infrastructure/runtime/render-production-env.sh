#!/usr/bin/env bash
set -euo pipefail

: "${APP_NAME:=enviro-centric}"
: "${AWS_REGION:=us-west-2}"
: "${API_DOMAIN:?Set API_DOMAIN}"
: "${WEBSITE_ORIGIN:?Set WEBSITE_ORIGIN, including https://}"
: "${REPORTS_BUCKET:?Set REPORTS_BUCKET from CDK output}"
: "${BACKUPS_BUCKET:?Set BACKUPS_BUCKET from CDK output}"
: "${BACKEND_IMAGE:?Set BACKEND_IMAGE from CDK output, including tag}"

get_secret() {
  aws ssm get-parameter \
    --region "$AWS_REGION" \
    --with-decryption \
    --name "/${APP_NAME}/$1" \
    --query 'Parameter.Value' \
    --output text
}

umask 077
tmp="$(mktemp /opt/enviro-centric/production.env.XXXXXX)"
trap 'rm -f "$tmp"' EXIT

postgres_password="$(get_secret database/password)"
jwt_access="$(get_secret jwt/access)"
jwt_refresh="$(get_secret jwt/refresh)"
admin_creation="$(get_secret admin-creation)"
google_server="$(get_secret google/server)"

cat > "$tmp" <<EOF
APP_NAME=${APP_NAME}
AWS_REGION=${AWS_REGION}
API_DOMAIN=${API_DOMAIN}
POSTGRES_USER=enviro_app
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=enviro_production
DATABASE_URL=postgresql://enviro_app:${postgres_password}@db:5432/enviro_production
JWT_SECRET_KEY=${jwt_access}
JWT_REFRESH_SECRET_KEY=${jwt_refresh}
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=43200
ADMIN_CREATION_SECRET=${admin_creation}
ALLOWED_ORIGINS=["${WEBSITE_ORIGIN}"]
BACKEND_PORT=8000
GOOGLE_MAPS_API_KEY=${google_server}
REPORTS_BUCKET=${REPORTS_BUCKET}
BACKUPS_BUCKET=${BACKUPS_BUCKET}
BACKEND_IMAGE=${BACKEND_IMAGE}
EOF

chmod 0600 "$tmp"
mv "$tmp" /opt/enviro-centric/production.env
trap - EXIT
unset postgres_password jwt_access jwt_refresh admin_creation google_server
echo "Wrote /opt/enviro-centric/production.env with mode 0600"
