import {
	Duration,
	Stack,
	StackProps,
	aws_iam as iam,
	aws_lambda as lambda,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';


export class SqsLambda extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		/** lambda role */
		const role = new iam.Role(this, 'lambdaRole', {
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromManagedPolicyArn(this, 'cwLogsAccess', 'arn:aws:iam::aws:policy/CloudWatchFullAccess')
			]
		})

		/** note: when you use the stack, configure the entry path */
		const lambdaSimpleResponse = new lambda.DockerImageFunction(this, 'LambdaFunction', {
			code: lambda.DockerImageCode.fromImageAsset("../"),
			functionName: "stock-project-api-endpoint",
			timeout: Duration.seconds(20),
			memorySize: 512,
			role: role
		})

	}
}
