# AWS deployment status

Last updated: 2026-06-19 (America/Los_Angeles)

## Live resources

- AWS account: `083635830460`
- Hosting region: `us-west-2`
- Website preview: `https://d1viiy6vl5de2z.cloudfront.net`
- CloudFront distribution: `E26KFFO620YS4Q`
- EC2 instance: `i-028cb0392c8a3f24c`
- API Elastic IP: `184.33.133.157`
- ECR: `083635830460.dkr.ecr.us-west-2.amazonaws.com/enviro-centric-backend`
- Website bucket: `envirohostingstack-websitebucket75c24d94-a3vvrhxb2vwn`
- Reports bucket: `envirohostingstack-reportsbucket4e7c5994-idvsadphxtsn`
- Backups bucket: `envirohostingstack-backupsbucketc69911ed-a30bizrtlasg`
- Billing stack: deployed in `us-east-1`, $30 estimated-charge alarm

## Verified

- CloudFront returns the React application over HTTPS.
- FastAPI and PostgreSQL are healthy on EC2.
- Production contains exactly one user: preserved local `users.id = 1` with superuser/admin access.
- The temporary encrypted user bootstrap parameter was deleted.
- Nightly backup timer is active and the first PostgreSQL dump exists in private S3.
- Generated database/JWT/admin secrets are encrypted in SSM.

## External actions still required

1. Add the ACM validation CNAME in Squarespace:
   - Host: `_9a3e453e6f634c41d09434151e343782.www`
   - Value: `_745424061d094afac8b7a84fc725d4c9.jkddzztszm.acm-validations.aws`
2. Confirm the AWS SNS subscription sent to `sarah@enviro-centric.com`.
3. After ACM is issued and the hosting stack is updated, replace the existing `www` CNAME (`ghs.googlehosted.com`) with `d1viiy6vl5de2z.cloudfront.net`.
4. Add an `A` record for `api` pointing to `184.33.133.157`; then start Caddy so it can issue the API certificate.
5. Configure apex-domain forwarding to `https://www.enviro-centric.com`.
6. Supply separate restricted Google Places keys. Until then, manual address entry remains available and Google integration is not production-ready.
