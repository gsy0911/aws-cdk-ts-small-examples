import {
	Stack,
	StackProps,
	aws_iam,
	aws_lambda,
	aws_sns,
	aws_chatbot,
	aws_events,
	aws_events_targets
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';

export interface IGuardDutyLambda {
	/** To get the ID, open Slack, right click on the channel name in the left pane, then choose Copy Link. The channel ID is the 9-character string at the end of the URL. */
	slackChannelId: string
	/** The ID of the Slack workspace authorized with AWS Chatbot */
	slackWorkspaceId: string
}


export const defaultGuardDutyLambdaParams: IGuardDutyLambda = {
	slackChannelId: "ABCBBLZZZ",
	slackWorkspaceId: "YOUR_SLACK_WORKSPACE_ID"
}



export class GuardDutyLambdaStack extends Stack {
  	constructor(app: Construct, id: string, params: IGuardDutyLambda, props?: StackProps) {
		super(app, id, props);

		/** Receive Data from GuardDuty */
		const lambdaRole = new aws_iam.Role(this, 'lambdaRole', {
			assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com')
		})
		lambdaRole.addManagedPolicy(aws_iam.ManagedPolicy.fromManagedPolicyArn(this, 'lambdaRoleCwFullAccess', 'arn:aws:iam::aws:policy/CloudWatchFullAccess'))

		const lambdaGuardDutyHandler = new PythonFunction(this, 'lambdaGuardDutyHandler', {
			functionName: "guard_duty_handler",
			entry: './lambda',
			index: 'sample.py',
			handler: 'handler',
			runtime: aws_lambda.Runtime.PYTHON_3_8,
			role: lambdaRole
		})

		const topic = new aws_sns.Topic(this, 'Topic', {
			topicName: 'GuardDuty-TopicToSlack',
			displayName: 'GuardDuty-TopicToSlack'
		})

		/** Add EventTarget */
		const guardDutyEventTarget = new aws_events_targets.LambdaFunction(lambdaGuardDutyHandler)
		const guardDutySnsTarget = new aws_events_targets.SnsTopic(topic)

		const trigger = new aws_events.Rule(this, "guard-duty-event", {
			eventPattern: {
				source: [
					"aws.guardduty"
				]
			},
			targets: [guardDutyEventTarget, guardDutySnsTarget]
		})

		const slackChannel = new aws_chatbot.SlackChannelConfiguration(this, 'GuardDutySlackChannel', {
			slackChannelConfigurationName: 'guard-duty-notification',
			slackWorkspaceId: params.slackWorkspaceId,
			slackChannelId: params.slackChannelId,
			notificationTopics: [topic]
		})

		slackChannel.addToRolePolicy(new aws_iam.PolicyStatement({
			effect: aws_iam.Effect.ALLOW,
			actions: [
                "cloudwatch:Describe*",
                "cloudwatch:Get*",
                "cloudwatch:List*"
			],
			resources: ['*']
		}))

 	 }
}
