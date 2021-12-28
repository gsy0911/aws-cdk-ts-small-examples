import {
	Stack,
	StackProps,
	aws_s3,
	aws_iam,
	aws_lambda,
	CfnOutput,
	Aws,
	aws_s3objectlambda,
	RemovalPolicy
} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {PythonFunction} from '@aws-cdk/aws-lambda-python-alpha';

export interface IS3ObjectLambda {
	bucketName: string
	accessPointName: string
	accessPointPrefix: string
}

export const defaultS3ObjectLambdaParams: IS3ObjectLambda = {
	bucketName: "s3-object-lambda-cdk-example-test",
	accessPointName: "ap-cdk-example",
	accessPointPrefix: "prefix"
}

export class S3ObjectLambdaStack extends Stack {
	constructor(scope: Construct, id: string, params: IS3ObjectLambda, props?: StackProps) {
		super(scope, id, props);

		/** bucket to store log from Firehose */
		const s3ObjectTarget = new aws_s3.Bucket(this, "S3ObjectLambdaBucket", {
			bucketName: params.bucketName,
			autoDeleteObjects: true,
			removalPolicy: RemovalPolicy.DESTROY
		})
		s3ObjectTarget.addToResourcePolicy(
			new aws_iam.PolicyStatement({
				effect: aws_iam.Effect.ALLOW,
				principals: [new aws_iam.AnyPrincipal()],
				resources: [s3ObjectTarget.bucketArn, s3ObjectTarget.arnForObjects("*")],
				actions: [
					'*',
				],
				conditions: {
					"StringEquals": {
						"s3:DataAccessPointAccount": Aws.ACCOUNT_ID
					}
				}
			})
		)

		/** lambda role */
		const role = new aws_iam.Role(this, 'lambdaRole', {
			assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, 'cwFullAccess', 'arn:aws:iam::aws:policy/CloudWatchFullAccess')
			],
			inlinePolicies: {
				"accessPointS3": new aws_iam.PolicyDocument({
					statements: [
						new aws_iam.PolicyStatement({
							effect: aws_iam.Effect.ALLOW,
							resources: [s3ObjectTarget.bucketArn, s3ObjectTarget.arnForObjects("*")],
							actions: [
								's3-object-lambda:WriteGetObjectResponse',
							]
						})
					]
				})
			}
		})

		/** note: when you use the stack, configure the entry path */
		const lambdaS3Object = new PythonFunction(this, 'lambdaSimpleResponse', {
			functionName: "simple_response",
			entry: './lib/lambda/s3_object_lambda',
			index: '__init__.py',
			handler: 'lambda_handler',
			runtime: aws_lambda.Runtime.PYTHON_3_8,
			role: role
		})

		const s3ObjectAccessPoint = new aws_s3objectlambda.CfnAccessPoint(this, "s3ObjectAccessPoint", {
			name: "access-point",
			objectLambdaConfiguration: {
				supportingAccessPoint: `arn:aws:s3:${Aws.REGION}:${Aws.ACCOUNT_ID}:accesspoint/${params.accessPointName}`,
				transformationConfigurations: [{
					actions: ["GetObject"],
					contentTransformation: {
						"AwsLambda": {
							"FunctionArn": lambdaS3Object.functionArn
						}
					}
				}]
			}
		})

		const lambda_s3_access_point_policy_doc = {
		    "Version": "2012-10-17",
		    "Statement": [
		        {
		            "Effect": "Allow",
		            "Principal": {
		                "AWS": [
		                    lambdaS3Object.role?.roleArn,
		                ]
		            },
		            "Action": ["s3:GetObject", "s3:PutObject"],
		            "Resource": `arn:aws:s3:${Aws.REGION}:${Aws.ACCOUNT_ID}:accesspoint/${params.accessPointName}/object/${params.accessPointPrefix}/*`
		        }
		    ]
		}
		const s3AccessPoint = new aws_s3.CfnAccessPoint(this, "accessPoint", {
			bucket: s3ObjectTarget.bucketName,
			name: params.accessPointName,
			policy: lambda_s3_access_point_policy_doc
		})

		new CfnOutput(this, "S3ObjectLambda", {
			value: `https://console.aws.amazon.com/lambda/home?region=${Aws.REGION}#/functions/${lambdaS3Object.functionName}`
		})
		new CfnOutput(this, "S3ObjectArn", {
			value: s3ObjectAccessPoint.attrArn
		})
	}
}
