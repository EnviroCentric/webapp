# Squarespace DNS and TLS

The domain remains registered and DNS-managed by Squarespace. Do not change its nameservers.

1. In AWS Certificate Manager, switch to **US East (N. Virginia) / us-east-1**.
2. Request a public certificate for the website hostname and its `www` variant.
3. Open the certificate and copy each DNS validation CNAME name and value.
4. In Squarespace, open **Settings > Domains > your domain > DNS Settings** and add those CNAME records.
5. Wait for ACM to show **Issued**, then copy its ARN into `deployment-inputs.local.json`.
6. After CDK deployment, add the website CNAME/ALIAS supported by Squarespace to the CloudFront domain from the stack output.
7. Add an `A` record for `api` pointing to the EC2 Elastic IP from the stack output.

Caddy obtains and renews the API certificate automatically after the `api` record resolves publicly. Keep ports 80 and 443 open so certificate issuance succeeds.

If Squarespace refuses a CNAME at the domain apex, use `www` as `websiteDomain` and configure Squarespace domain forwarding from the apex to `www`.
