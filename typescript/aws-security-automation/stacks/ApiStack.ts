import * as cdk from "@aws-cdk/core";
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from "@aws-cdk/aws-apigateway";
import { PythonFunction } from '@aws-cdk/aws-lambda-python';


export class DummyApiStack extends cdk.Stack {
  constructor(app: cdk.App, id: string, props?: cdk.StackProps) {
    super(app, id, props);

	const role = new iam.Role(this, 'lambdaRole', {
		assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
	})
	role.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'SwapRoleToAccessEB', 'arn:aws:iam::aws:policy/CloudWatchFullAccess'))

	/**
	 * lambda to get current date as docker-image-tag
	 *
	 * lambda returns '2021-01-01'.
	 */
	const lambdaSimpleResponse = new PythonFunction(this, 'lambdaSimpleResponse', {
		functionName: "simple_response",
		entry: './lambda',
		index: 'sample.py',
		handler: 'handler',
		runtime: lambda.Runtime.PYTHON_3_8,
		role: role
	})

	const api = new apigw.LambdaRestApi(this, 'sample_api', {
		handler: lambdaSimpleResponse,
		proxy: false
	});

	const items = api.root.addResource('sample');
	items.addMethod('GET');
  }
}
