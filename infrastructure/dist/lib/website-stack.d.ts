import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export interface HostingConfig {
    account?: string;
    region: string;
    appName: string;
    domainName?: string;
    websiteDomain?: string;
    apiDomain?: string;
    cloudFrontCertificateArn?: string;
    instanceType?: string;
}
export interface WebsiteStackProps extends cdk.StackProps {
    config: HostingConfig;
}
export declare class WebsiteStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: WebsiteStackProps);
}
