import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface BillingStackProps extends cdk.StackProps {
  billingEmail: string;
  monthlyBudgetUsd: number;
}

export class BillingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BillingStackProps) {
    super(scope, id, props);

    const topic = new sns.Topic(this, 'BillingAlertsTopic');
    topic.addSubscription(new subscriptions.EmailSubscription(props.billingEmail));

    const estimatedCharges = new cloudwatch.Metric({
      namespace: 'AWS/Billing',
      metricName: 'EstimatedCharges',
      dimensionsMap: { Currency: 'USD' },
      statistic: 'Maximum',
      period: cdk.Duration.hours(6),
    });

    const alarm = estimatedCharges.createAlarm(this, 'MonthlyEstimatedChargesAlarm', {
      threshold: props.monthlyBudgetUsd,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: `Estimated AWS charges exceeded $${props.monthlyBudgetUsd}`,
    });
    alarm.addAlarmAction(new actions.SnsAction(topic));

    new cdk.CfnOutput(this, 'BillingTopicArn', { value: topic.topicArn });
  }
}
