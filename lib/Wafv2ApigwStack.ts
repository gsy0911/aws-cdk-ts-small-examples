import {
	Stack,
	StackProps,
	aws_s3,
	aws_iam,
	aws_lambda,
	aws_apigateway,
	aws_kinesisfirehose,
	aws_wafv2,
	RemovalPolicy
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';

export interface IWafv2ApigwStack {
	/** Maximum number of bytes allowed in the URI component of the HTTP request. Generally the maximum possible value is determined by the server operating system (maps to file system paths), the web server software, or other middleware components. Choose a value that accomodates the largest URI segment you use in practice in your web application. */
	maxExpectedURISize: number
	/** Maximum number of bytes allowed in the query string component of the HTTP request. Normally the  of query string parameters following the "?" in a URL is much larger than the URI , but still bounded by the  of the parameters your web application uses and their values. */
	maxExpectedQueryStringSize: number
	/** Maximum number of bytes allowed in the body of the request. If you do not plan to allow large uploads, set it to the largest payload value that makes sense for your web application. Accepting unnecessarily large values can cause performance issues, if large payloads are used as an attack vector against your web application. */
    maxExpectedBodySize: number
	/** Maximum number of bytes allowed in the cookie header. The maximum size should be less than 4096, the size is determined by the amount of information your web application stores in cookies. If you only pass a session token via cookies, set the size to no larger than the serialized size of the session token and cookie metadata. */
    maxExpectedCookieSize: number
	/** The custom HTTP request header, where the CSRF token value is expected to be encountered */
    csrfExpectedHeader: string
	/** The size in bytes of the CSRF token value. For example if it's a canonically formatted UUIDv4 value the expected size would be 36 bytes/ASCII characters */
    csrfExpectedSize: number
}

export const defaultWafv2ApigwParams: IWafv2ApigwStack = {
	maxExpectedURISize: 512,
	maxExpectedQueryStringSize: 4096,
	maxExpectedBodySize: 4096,
	maxExpectedCookieSize: 4096,
	csrfExpectedHeader: 'x-csrf-token',
	csrfExpectedSize: 36,
}

export class Wafv2ApigwStack extends Stack {
	constructor(scope: Construct, id: string, params: IWafv2ApigwStack, props?: StackProps) {
		super(scope, id, props);

		/** lambda role */
		const role = new aws_iam.Role(this, 'lambdaRole', {
			assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, 'cwFullAccess', 'arn:aws:iam::aws:policy/CloudWatchFullAccess')
			]
		})

		/** note: when you use the stack, configure the entry path */
		const lambdaSimpleResponse = new PythonFunction(this, 'lambdaSimpleResponse', {
			functionName: "simple_response",
			entry: './lib/lambda/wafv2_apigw',
			index: 'sample.py',
			handler: 'handler',
			runtime: aws_lambda.Runtime.PYTHON_3_8,
			role: role
		})

		const api = new aws_apigateway.LambdaRestApi(this, 'sample_api', {
			handler: lambdaSimpleResponse,
			proxy: false
		});

		const items = api.root.addResource('sample');
		items.addMethod('GET');

		/** bucket to store log from Firehose */
		const logS3 = new aws_s3.Bucket(this, "log-bucket-aws-cdk-example", {
			bucketName: "log-bucket-aws-cdk-example",
			autoDeleteObjects: true,
			removalPolicy: RemovalPolicy.DESTROY
		})
		const firehoseAccessS3Role = new aws_iam.Role(this, `firehose-access-s3-role`, {
			roleName: `firehose-access-s3-role`,
			assumedBy: new aws_iam.ServicePrincipal('firehose.amazonaws.com')
		})

		firehoseAccessS3Role.addToPolicy(new aws_iam.PolicyStatement({
			effect: aws_iam.Effect.ALLOW,
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
		new aws_kinesisfirehose.CfnDeliveryStream(this, "SampleFirehose", {
			deliveryStreamName: "aws-waf-logs-docker_lambda",
			s3DestinationConfiguration: {
				bucketArn: logS3.bucketArn,
				roleArn: firehoseAccessS3Role.roleArn,
				prefix: "raw/dt=!{timestamp:yyyy}-!{timestamp:MM}-!{timestamp:dd}/",
				errorOutputPrefix: "raw-error/!{firehose:error-output-type}/dt=!{timestamp:yyyy}-!{timestamp:MM}-!{timestamp:dd}/"
			}
		})

		/**
		 * Document
		 * @see https://docs.aws.amazon.com/ja_jp/waf/latest/APIReference/API_All.html
		 * example
		 * @see https://docs.amazonaws.cn/en_us/AWSCloudFormation/latest/UserGuide/aws-resource-wafv2-rulegroup.html
		 */
		// Custom Rule
		const customRule = new aws_wafv2.CfnRuleGroup(this, 'customRule', {
			capacity: 100,
			scope: "REGIONAL",
			visibilityConfig: {
				sampledRequestsEnabled: true,
				cloudWatchMetricsEnabled: true,
				metricName: "customRulesCommonRuleSet"
			},
			name: 'customBlockRule',
			description: "override custom rule for AWSManagedRulesCommonRuleSet",
			rules: [
				{
					name: "uriSize",
					priority: 1,
					action: { block: {} },
					statement: {
						sizeConstraintStatement: {
							comparisonOperator: "GT",
							fieldToMatch: {
								queryString: {}
							},
							size: params.maxExpectedQueryStringSize,
							textTransformations: [
								{priority: 0, type: "NONE"}
							]
						}
					},
					visibilityConfig: {
						sampledRequestsEnabled: true,
						cloudWatchMetricsEnabled: true,
						metricName: "uriSize"
					}
				}
			]
		})

		// WebACL
		const webAcl = new aws_wafv2.CfnWebACL(this, "SampleWafAcl", {
			defaultAction: { allow: {} },
			name: "docker_lambda-waf-web-acl",
			rules: [
				/** Custom Rules below */
				{
					priority: 1,
					name: 'customRulesCommonRuleSet',
					overrideAction: { none: {}},
					visibilityConfig: {
						sampledRequestsEnabled: true,
						cloudWatchMetricsEnabled: true,
						metricName: "customRulesCommonRuleSet"
					},
					statement: {
						ruleGroupReferenceStatement: {
							arn: customRule.attrArn
						}
					}
				},
				/** Managed Rules below */
				{
					priority: 2,
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
							name: "AWSManagedRulesCommonRuleSet",
							excludedRules: [
								{
									"name": "SizeRestrictions_QUERYSTRING"
								}
							]
						}
					}
				},
				{
					priority: 3,
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
					priority: 4,
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
					priority: 5,
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
					priority: 6,
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
				metricName: "docker_lambda-waf-web-acl",
				sampledRequestsEnabled: true
			},
		});

		new aws_wafv2.CfnWebACLAssociation(this, "apigw-webAcl-associate", {
			resourceArn: api.arnForExecuteApi(),
			webAclArn: webAcl.attrArn
		})
	}
}
