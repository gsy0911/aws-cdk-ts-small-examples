import * as cdk from "@aws-cdk/core";
import * as iam from '@aws-cdk/aws-iam';
import * as events from '@aws-cdk/aws-events';
import * as eventsTargets from '@aws-cdk/aws-events-targets';
import * as lambda from '@aws-cdk/aws-lambda';
import * as logs from '@aws-cdk/aws-logs';
import * as route53 from '@aws-cdk/aws-route53';
import { PythonFunction } from '@aws-cdk/aws-lambda-python';
import { IParameters, defaultParams } from './IParameters';
import { params } from './params';


export class GuardDutyStack extends cdk.Stack {
  	constructor(app: cdk.App, id: string, params: IParameters, props?: cdk.StackProps) {
		super(app, id, props);

		/** Recieve Data from GuardDuty */
		const lambdaRole = new iam.Role(this, 'lambdaRole', {
			assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
		})
		lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'lambdaRoleCwFullAccess', 'arn:aws:iam::aws:policy/CloudWatchFullAccess'))

		const lambdaGuardDutyHandler = new PythonFunction(this, 'lambdaGuardDutyHandler', {
			functionName: "guard_duty_handler",
			entry: './lambda',
			index: 'sample.py',
			handler: 'handler',
			runtime: lambda.Runtime.PYTHON_3_8,
			role: lambdaRole
		})

		/** Add EventTarget */
		const guardDutyEventTarget = new eventsTargets.LambdaFunction(lambdaGuardDutyHandler)
		const trigger = new events.Rule(this, "guard-duty-event", {
			eventPattern: {
				source: [
					"aws.guardduty"
				]
			},
			targets: [guardDutyEventTarget]
		})

		// const hostedZone = route53.HostedZone.fromHostedZoneId(this, "hostedZone", params.hostedZoneId)

		// /** create IAM Role to access DNS Logs */
		// const dnsLogRole = new iam.Role(this, 'dnsLogRole', {
		// 	assumedBy: new iam.ServicePrincipal('route53.amazonaws.com')
		// })
		// dnsLogRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'dnsLogRoleCwFullAccess', 'arn:aws:iam::aws:policy/CloudWatchFullAccess'))

		// /** create Log Group */
		// const logGroup = new logs.LogGroup(this, 'DnsLogGroup', {
		// 	logGroupName: params.dnsLogName,
		// 	retention: logs.RetentionDays.ONE_WEEK,
		// });

 	 }
}

const app = new cdk.App();
new GuardDutyStack(app, "GuardDuty", params, {description: "ts-example"});
app.synth();
