import {
	Stack,
	StackProps,
	aws_iam,
	aws_lambda,
	aws_apigateway,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';

export interface ISamExample {
	S3Path: string
}


export class SamExampleStack extends Stack {
	constructor(scope: Construct, id: string, params: ISamExample, props?: StackProps) {
		super(scope, id, props);

		/** lambda role */
		const role = new aws_iam.Role(this, 'lambdaRole', {
			assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, 'cwLogsAccess', 'arn:aws:iam::aws:policy/CloudWatchFullAccess')
			]
		})

		/** note: when you use the stack, configure the entry path */
		const lambdaSimpleResponse = new PythonFunction(this, 'LambdaFunction', {
			functionName: "simple_response",
			entry: '../stacks/lambda/sam_example',
			index: 'lambda_function.py',
			handler: 'handler',
			runtime: aws_lambda.Runtime.PYTHON_3_8,
			role: role,
			environment: {
				S3_PATH: params.S3Path
			}
		})

		const api = new aws_apigateway.LambdaRestApi(this, 'sample_api', {
			handler: lambdaSimpleResponse,
			proxy: false
		});

		const items = api.root.addResource('sample');
		items.addMethod('GET');
	}
}
