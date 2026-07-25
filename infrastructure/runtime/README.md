# EC2 runtime assets

Copy this directory to `/opt/enviro-centric` through Session Manager. Add the ignored `production.env`, authenticate Docker to the ECR registry, and start the stack:

```bash
chmod 0750 render-production-env.sh backup-postgres.sh install-backup-timer.sh
docker compose --env-file production.env -f docker-compose.production.yml pull
docker compose --env-file production.env -f docker-compose.production.yml up -d
curl --fail https://api.example.com/health
```

Install and immediately test the nightly backup:

```bash
sudo ./install-backup-timer.sh
aws s3 ls "s3://${BACKUPS_BUCKET}/postgres/"
```

Do not expose PostgreSQL or port 8000 publicly. Caddy is the only public container entrypoint.
