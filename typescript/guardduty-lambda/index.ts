import * as cdk from "@aws-cdk/core";
import * as iam from '@aws-cdk/aws-iam';
import * as events from '@aws-cdk/aws-events';
import * as eventsTargets from '@aws-cdk/aws-events-targets';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sns from '@aws-cdk/aws-sns';
import * as chatbot from '@aws-cdk/aws-chatbot';
import { PythonFunction } from '@aws-cdk/aws-lambda-python';
import { IParameters } from './IParameters';
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

		const topic = new sns.Topic(this, 'Topic', {
			topicName: 'GuardDuty-TopicToSlack',
			displayName: 'GuardDuty-TopicToSlack'
		})

		/** Add EventTarget */
		const guardDutyEventTarget = new eventsTargets.LambdaFunction(lambdaGuardDutyHandler)
		const guardDutySnsTarget = new eventsTargets.SnsTopic(topic)

		const trigger = new events.Rule(this, "guard-duty-event", {
			eventPattern: {
				source: [
					"aws.guardduty"
				]
			},
			targets: [guardDutyEventTarget, guardDutySnsTarget]
		})

		const slackChannel = new chatbot.SlackChannelConfiguration(this, 'GuardDutySlackChannel', {
			slackChannelConfigurationName: 'guard-duty-notification',
			slackWorkspaceId: params.slackWorkspaceId,
			slackChannelId: params.slackChannelId,
			notificationTopics: [topic]
		})

		slackChannel.addToRolePolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			actions: [
                "cloudwatch:Describe*",
                "cloudwatch:Get*",
                "cloudwatch:List*"
			],
			resources: ['*']
		}))

 	 }
}

const app = new cdk.App();
new GuardDutyStack(app, "GuardDuty", params, {description: "ts-example"});
app.synth();
