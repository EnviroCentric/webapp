import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';

const bucket = process.env.WEBSITE_BUCKET;
const distributionId = process.env.DISTRIBUTION_ID;
const region = process.env.AWS_REGION ?? 'us-west-2';
if (!bucket || !distributionId) {
  throw new Error('WEBSITE_BUCKET and DISTRIBUTION_ID are required');
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const s3 = new S3Client({ region });

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

async function files(dir) {
  const entries = await readdir(dir);
  const found = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if ((await stat(full)).isDirectory()) found.push(...await files(full));
    else found.push(full);
  }
  return found;
}

for (const file of await files(root)) {
  const key = path.relative(root, file).replaceAll('\\', '/');
  const immutable = key.startsWith('assets/');
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: await readFile(file),
    ContentType: contentTypes[path.extname(key).toLowerCase()] ?? 'application/octet-stream',
    CacheControl: immutable ? 'public,max-age=31536000,immutable' : 'no-cache',
  }));
  console.log(`Uploaded ${key}`);
}

const cloudfront = new CloudFrontClient({ region: 'us-east-1' });
await cloudfront.send(new CreateInvalidationCommand({
  DistributionId: distributionId,
  InvalidationBatch: {
    CallerReference: `${Date.now()}`,
    Paths: { Quantity: 1, Items: ['/*'] },
  },
}));
console.log('CloudFront invalidation submitted');
