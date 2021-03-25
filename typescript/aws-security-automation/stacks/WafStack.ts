import * as cdk from "@aws-cdk/core";
import * as wafv2 from "@aws-cdk/aws-wafv2";
import * as firehose from "@aws-cdk/aws-kinesisfirehose";
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';

import { IWafv2Stack } from '../IParameters';

export class WafStack extends cdk.Stack {
	constructor(scope: cdk.Construct, id: string, params: IWafv2Stack, props?: cdk.StackProps) {
		super(scope, id, props);

		/** bucket to store log from Firehose */
		const logS3 = new s3.Bucket(this, "log-bucket-aws-cdk-example", {
			bucketName: "log-bucket-aws-cdk-example",
			autoDeleteObjects: true,
			removalPolicy: cdk.RemovalPolicy.DESTROY
		})
		const firehoseAccessS3Role = new iam.Role(this, `firehose-access-s3-role`, {
			roleName: `firehose-access-s3-role`,
			assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com')
		})

		firehoseAccessS3Role.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			resources: [`arn:aws:s3:::${logS3.bucketName}`, `arn:aws:s3:::${logS3.bucketName}/*`],
			actions: [
				's3:*',
			]
		}))

		/**
		 * Kinesis Firehose to stream logs from WAFv2
		 *
		 * stream name must start with `aws-waf-logs-`
		 */
		const wafLogFirehose = new firehose.CfnDeliveryStream(this, "SampleFirehose", {
			deliveryStreamName: "aws-waf-logs-sample",
			s3DestinationConfiguration: {
				bucketArn: logS3.bucketArn,
				roleArn: firehoseAccessS3Role.roleArn,
				prefix: "raw/dt=!{timestamp:yyyy}-!{timestamp:MM}-!{timestamp:dd}",
				errorOutputPrefix: "raw-error/!{firehose:error-output-type}/dt=!{timestamp:yyyy}-!{timestamp:MM}-!{timestamp:dd}"
			}
		})

		// WebACL
		const webAcl = new wafv2.CfnWebACL(this, "SampleWafAcl", {
			defaultAction: { allow: {} },
			name: "sample-waf-web-acl",
			rules: [

				{
					priority: 1,
					overrideAction: { none: {} },
					visibilityConfig: {
						sampledRequestsEnabled: true,
						cloudWatchMetricsEnabled: true,
						metricName: "AWS-ManagedRulesCommonRuleSet"
					},
					name: "AWSManagedRulesCommonRuleSet",
					statement: {
						managedRuleGroupStatement: {
						vendorName: "AWS",
						name: "AWSManagedRulesCommonRuleSet"
						}
					}
				},
				{
					priority: 2,
					overrideAction: { none: {} },
					visibilityConfig: {
						sampledRequestsEnabled: true,
						cloudWatchMetricsEnabled: true,
						metricName: "AWS-ManagedRulesKnownBadInputsRuleSet"
					},
					name: "AWSManagedRulesKnownBadInputsRuleSet",
					statement: {
						managedRuleGroupStatement: {
							vendorName: "AWS",
							name: "AWSManagedRulesKnownBadInputsRuleSet"
						}
					}
				},
				{
					priority: 3,
					overrideAction: { none: {} },
					visibilityConfig: {
						sampledRequestsEnabled: true,
						cloudWatchMetricsEnabled: true,
						metricName: "AWS-ManagedRulesAdminProtectionRuleSet"
					},
					name: "AWSManagedRulesAdminProtectionRuleSet",
					statement: {
						managedRuleGroupStatement: {
							vendorName: "AWS",
							name: "AWSManagedRulesAdminProtectionRuleSet"
						}
					}
				},
				{
					priority: 4,
					overrideAction: { none: {} },
					visibilityConfig: {
						sampledRequestsEnabled: true,
						cloudWatchMetricsEnabled: true,
						metricName: "AWS-AWSManagedRulesSQLiRuleSet"
					},
					name: "AWSAWSManagedRulesSQLiRuleSet",
					statement: {
						managedRuleGroupStatement: {
							vendorName: "AWS",
							name: "AWSManagedRulesSQLiRuleSet"
						}
					}
				},
				{
					priority: 5,
					overrideAction: { none: {} },
					visibilityConfig: {
						sampledRequestsEnabled: true,
						cloudWatchMetricsEnabled: true,
						metricName: "AWS-ManagedRulesLinuxRuleSet"
					},
					name: "AWSManagedRulesLinuxRuleSet",
					statement: {
						managedRuleGroupStatement: {
							vendorName: "AWS",
							name: "AWSManagedRulesLinuxRuleSet"
						}
					}
				}
			],
			scope: "REGIONAL",
			visibilityConfig: {
				cloudWatchMetricsEnabled: true,
				metricName: "sample-waf-web-acl",
				sampledRequestsEnabled: true
			},
		});
	}
}
