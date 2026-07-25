# Lean AWS hosting runbook

This directory contains examples and read-only/bootstrap helpers. Never commit a completed `*.local.*` file, `production.env`, database export, password hash, or AWS credential.

## 1. Secure the AWS account

- Confirm root-account MFA and an alternate billing/security contact.
- Use IAM Identity Center or an administrative role for deployment; do not create long-lived root keys.
- Install the AWS CLI on Windows with `winget install Amazon.AWSCLI`, then authenticate with `aws configure sso` (preferred) or your approved organization workflow.
- Restart PowerShell and run `./env/aws/collect-info.ps1`.
- Copy `deployment-inputs.example.json` to the ignored `deployment-inputs.local.json` and replace every placeholder.
- Run `./env/aws/put-secrets.ps1`; it generates strong application/database secrets and prompts privately for the server Google key. Use `-SkipGoogleKey` to prepare the generated secrets first and add the restricted Google key later.

The AWS account ID comes from `aws sts get-caller-identity`. Keep `us-west-2` unless there is a business reason to choose another region.

## 2. Prepare DNS and external APIs

- Follow [squarespace-dns.md](./squarespace-dns.md) to issue the CloudFront certificate in `us-east-1`.
- In Google Cloud Console, create two Places-enabled keys:
  - Browser key: restrict by the production website HTTP referrer and only the required Maps/Places APIs.
  - Server key: restrict to the EC2 Elastic IP after deployment and only the required Places APIs.

## 3. Build and synthesize

From `infrastructure/`, run `npm ci`, `npm run build`, and `npx cdk synth`. Bootstrap each target region once:

```powershell
npx cdk bootstrap aws://ACCOUNT_ID/us-west-2
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1
```

Deploy the billing stack first and confirm the SNS email subscription. Deploy the hosting stack only after reviewing the CloudFormation change set.

## 4. Configure the host

- Use the HostingStack outputs for the Elastic IP, ECR repository, report bucket, backup bucket, and CloudFront distribution.
- Connect only through **EC2 > Connect > Session Manager**. SSH is intentionally not exposed.
- Copy `infrastructure/runtime/` to `/opt/enviro-centric` and run `render-production-env.sh` with the public stack outputs exported as described in its header. It retrieves secrets from SSM and writes the host-only file with mode `0600`.
- Authenticate Docker to ECR, push an ARM64 backend image, and run `docker compose --env-file production.env -f docker-compose.production.yml up -d`.
- Install the supplied backup service/timer and verify an object appears in the backup bucket.

## 5. Preserve exactly user 1

With the local development database running, choose the temporary parameter name shown by the CDK output and run:

```powershell
./env/aws/preserve-user1.ps1 -ParameterName /enviro-centric/bootstrap/user1
```

On the EC2 host, fetch the decrypted value directly into the backend bootstrap script through stdin; do not echo it:

```bash
aws ssm get-parameter --with-decryption --name /enviro-centric/bootstrap/user1 --query Parameter.Value --output text | base64 -d \
  | docker compose --env-file production.env -f docker-compose.production.yml exec -T backend python scripts/bootstrap_user1.py
```

Verify the existing login, a superuser-only endpoint, and `SELECT COUNT(*) FROM users` returning `1`. Then delete the temporary value:

```bash
aws ssm delete-parameter --name /enviro-centric/bootstrap/user1
```

## 6. Frontend and launch checks

- Build with `VITE_API_URL=https://api.your-domain` and the browser-restricted Google key.
- Upload `frontend/dist/` to the website bucket and invalidate CloudFront.
- Verify HTTPS, browser refresh on nested routes, login, PDF upload/download, container restart persistence, S3 backup creation, and Session Manager access.

Local projects, companies, the other users, and the 47 local report files are intentionally not migrated.
