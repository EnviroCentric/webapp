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

## Website contact emails

The public `POST /api/v1/contact` endpoint sends service requests through Amazon SES in `AWS_REGION` to `info@enviro-centric.com`. The same address is the sender; the visitor's validated email is Reply-To. Credentials remain on the backend through the EC2 role. The frontend uses `VITE_API_URL` plus `/api/v1/contact`, or an explicit `VITE_CONTACT_FORM_URL` override.

Before enabling production submissions:

1. Sign in to AWS with `aws login` if the session has expired.
2. Verify `info@enviro-centric.com` (or the `enviro-centric.com` domain) in SES in `us-west-2`. Email verification requires clicking the link AWS sends to the inbox. Sandbox mode can deliver this form because both sender and recipient are the verified company address.
3. Deploy the hosting stack to grant its EC2 role the scoped `ses:SendEmail` permission, then deploy the updated backend and frontend using the existing deployment process.
4. Submit a real request and confirm it reaches the inbox and Reply targets the visitor. SES acceptance alone does not confirm inbox delivery.

The endpoint validates required fields and lengths, rejects invalid email addresses, and includes a hidden honeypot. Delivery failures return 503 so the form retains entries and does not claim success. Add rate limiting at the public edge if abuse occurs.
