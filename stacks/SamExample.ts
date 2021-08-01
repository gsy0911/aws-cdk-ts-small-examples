import * as cdk from "@aws-cdk/core";
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from "@aws-cdk/aws-apigateway";
import { PythonFunction } from '@aws-cdk/aws-lambda-python';

export interface ISamExample {
	S3Path: string
}


export class SamExample extends cdk.Stack {
	constructor(scope: cdk.Construct, id: string, params: ISamExample, props?: cdk.StackProps) {
		super(scope, id, props);

		/** lambda role */
		const role = new iam.Role(this, 'lambdaRole', {
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromManagedPolicyArn(this, 'cwLogsAccess', 'arn:aws:iam::aws:policy/CloudWatchFullAccess')
			]
		})

		/** note: when you use the stack, configure the entry path */
		const lambdaSimpleResponse = new PythonFunction(this, 'LambdaFunction', {
			functionName: "simple_response",
			entry: '../stacks/lambda/sam_example',
			index: 'lambda_function.py',
			handler: 'handler',
			runtime: lambda.Runtime.PYTHON_3_8,
			role: role,
			environment: {
				S3_PATH: params.S3Path
			}
		})

		const api = new apigw.LambdaRestApi(this, 'sample_api', {
			handler: lambdaSimpleResponse,
			proxy: false
		});

		const items = api.root.addResource('sample');
		items.addMethod('GET');
	}
}
