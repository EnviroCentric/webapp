import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
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

export class WebsiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebsiteStackProps) {
    super(scope, id, props);

    const { config } = props;
    const prefix = config.appName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [{ noncurrentVersionExpiration: cdk.Duration.days(90) }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const backupsBucket = new s3.Bucket(this, 'BackupsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(35) }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const repository = new ecr.Repository(this, 'BackendRepository', {
      repositoryName: `${prefix}-backend`,
      imageScanOnPush: true,
      encryption: ecr.RepositoryEncryption.AES_256,
      lifecycleRules: [{ maxImageCount: 10 }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    const securityGroup = new ec2.SecurityGroup(this, 'WebSecurityGroup', {
      vpc,
      description: 'Public HTTPS/ACME access for Caddy; no SSH',
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP for ACME redirect');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS API');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(443), 'HTTP/3 API');

    const role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });
    reportsBucket.grantReadWrite(role);
    backupsBucket.grantReadWrite(role);
    repository.grantPull(role);
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:DeleteParameter'],
      resources: [
        `arn:${cdk.Aws.PARTITION}:ssm:${this.region}:${this.account}:parameter/${prefix}/*`,
      ],
    }));

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'dnf install -y docker',
      'systemctl enable --now docker',
      'mkdir -p /usr/local/lib/docker/cli-plugins /opt/enviro-centric',
      'curl -fsSL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-aarch64 -o /usr/local/lib/docker/cli-plugins/docker-compose',
      'chmod 0755 /usr/local/lib/docker/cli-plugins/docker-compose',
      'chmod 0750 /opt/enviro-centric',
    );

    const instance = new ec2.Instance(this, 'ApplicationInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(config.instanceType ?? 't4g.small'),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      securityGroup,
      role,
      userData,
      requireImdsv2: true,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(30, {
          encrypted: true,
          volumeType: ec2.EbsDeviceVolumeType.GP3,
          deleteOnTermination: false,
        }),
      }],
    });

    const cfnInstance = instance.node.defaultChild as ec2.CfnInstance;
    cfnInstance.addPropertyOverride('MetadataOptions.HttpPutResponseHopLimit', 2);

    const elasticIp = new ec2.CfnEIP(this, 'ElasticIp', { domain: 'vpc' });
    new ec2.CfnEIPAssociation(this, 'ElasticIpAssociation', {
      allocationId: elasticIp.attrAllocationId,
      instanceId: instance.instanceId,
    });

    const certificate = config.cloudFrontCertificateArn
      ? acm.Certificate.fromCertificateArn(this, 'WebsiteCertificate', config.cloudFrontCertificateArn)
      : undefined;
    const domainNames = certificate && config.websiteDomain ? [config.websiteDomain] : undefined;

    const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        compress: true,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
      ],
      certificate,
      domainNames,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', { value: websiteBucket.bucketName });
    new cdk.CfnOutput(this, 'ReportsBucketName', { value: reportsBucket.bucketName });
    new cdk.CfnOutput(this, 'BackupsBucketName', { value: backupsBucket.bucketName });
    new cdk.CfnOutput(this, 'BackendRepositoryUri', { value: repository.repositoryUri });
    new cdk.CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'ApiElasticIp', { value: elasticIp.ref });
    new cdk.CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new cdk.CfnOutput(this, 'User1BootstrapParameter', { value: `/${prefix}/bootstrap/user1` });
  }
}
