#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { WebsiteStack, HostingConfig } from '../lib/website-stack';
import { BillingStack } from '../lib/billing-stack';

interface DeploymentConfig extends HostingConfig {
  billingEmail?: string;
  monthlyBudgetUsd?: number;
}

function loadConfig(): DeploymentConfig {
  const configPath = process.env.DEPLOYMENT_CONFIG
    ? path.resolve(process.env.DEPLOYMENT_CONFIG)
    : path.resolve(__dirname, '../../env/aws/deployment-inputs.local.json');

  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as DeploymentConfig;
  }

  return {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-west-2',
    appName: 'enviro-centric',
    instanceType: 't4g.small',
  };
}

const app = new cdk.App();
const config = loadConfig();

new WebsiteStack(app, 'EnviroHostingStack', {
  config,
  env: config.account ? { account: config.account, region: config.region } : undefined,
  description: 'Lean Enviro-Centric web, API, report storage, and backup infrastructure',
});

if (config.billingEmail) {
  if (!config.account) {
    throw new Error('account is required when billingEmail is configured');
  }
  new BillingStack(app, 'EnviroBillingStack', {
    billingEmail: config.billingEmail,
    monthlyBudgetUsd: config.monthlyBudgetUsd ?? 30,
    env: { account: config.account, region: 'us-east-1' },
    description: 'Estimated monthly AWS charge alarm',
  });
}
