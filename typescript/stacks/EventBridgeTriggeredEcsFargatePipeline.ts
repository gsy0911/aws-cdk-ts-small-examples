import * as cdk from '@aws-cdk/core';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as events from '@aws-cdk/aws-events';
import * as eventsTargets from '@aws-cdk/aws-events-targets';
import * as iam from "@aws-cdk/aws-iam";
import * as codeBuild from "@aws-cdk/aws-codebuild";
import * as codeDeploy from '@aws-cdk/aws-codedeploy';
import {PythonFunction} from "@aws-cdk/aws-lambda-python";
import * as lambda from "@aws-cdk/aws-lambda";


export interface IEventBridgeTriggeredEcsFargatePipeline {
	awsAccountId: string,
	cloudwatchLogsLogStreamName: string,
	gitTokenInSecretManagerARN: string,
	gitTokenInSecretManagerJsonField: string,
	gitOwner: string,
	gitRepoName: string,
	gitSourceBranch: string,
	ecrRepositoryName: string,
	ecrRepositoryImageTag: string,
}


export class EventBridgeTriggeredEcsFargatePipeline extends cdk.Stack {
	constructor(scope: cdk.App, id: string, params: IEventBridgeTriggeredEcsFargatePipeline, props?: cdk.StackProps) {
		super(scope, id, props);

		// S3 location
		const sourceOutput = new codepipeline.Artifact();
		const oauth = cdk.SecretValue.secretsManager(params.gitTokenInSecretManagerARN, {jsonField: params.gitTokenInSecretManagerJsonField});
		const sourceAction = new codepipeline_actions.GitHubSourceAction({
			actionName: 'GitHub_Source',
			owner: params.gitOwner,
			repo: params.gitRepoName,
			oauthToken: oauth,
			output: sourceOutput,
			branch: params.gitSourceBranch || 'master',
		});

		/**
		 * lambda to get current date as docker-image-tag
		 *
		 * lambda returns '2021-01-01'.
		 */
		const lambdaCurrentDate = new PythonFunction(this, 'lambdaCurrentDate', {
			functionName: "PipelineCurrentDate",
			entry: '../stacks/lambda/pipeline',
			index: 'get_current_date.py',
			handler: 'handler',
			runtime: lambda.Runtime.PYTHON_3_8,
		})
		cdk.Tags.of(lambdaCurrentDate).add("runtime", "python")
		const getCurrentDateAction = new codepipeline_actions.LambdaInvokeAction({
			actionName: 'getCurrentDate',
			lambda: lambdaCurrentDate,
			variablesNamespace: 'BuildVariables'
		})

		/**
		 * Build action
		 */
		const buildRole = new iam.Role(this, 'BuildRole', {
			assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com')
		})
		buildRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'BuildRoleToAccessECR', 'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess'))
		/** Policy to access SecretsManager */
		buildRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'CodeBuildSecretsManagerAccess', 'arn:aws:iam::aws:policy/SecretsManagerReadWrite'))

		// to build docker in CodeBuild, set priviledged True
		const codeBuildCache = codeBuild.Cache.local(codeBuild.LocalCacheMode.DOCKER_LAYER)
		const project = new codeBuild.PipelineProject(this, 'MyProject', {
			environment: {
				buildImage: codeBuild.LinuxBuildImage.AMAZON_LINUX_2,
				privileged: true
			},
			cache: codeBuildCache,
			environmentVariables: {
				"AWS_ACCOUNT": {
					type: codeBuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: params.awsAccountId,
				},
				// overwrite values in BuildAction
				"IMAGE_TAG": {
					type: codeBuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: getCurrentDateAction.variable('current_date')
				},
				"LOG_STREAM_NAME": {
					type: codeBuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: params.cloudwatchLogsLogStreamName
				}
			},
			role: buildRole
		});

		const buildAction = new codepipeline_actions.CodeBuildAction({
			actionName: 'CodeBuild',
			project,
			input: sourceOutput, // The build action must use the CodeCommitSourceAction output as input.
			outputs: [new codepipeline.Artifact()], // optional
			runOrder: 2,
			environmentVariables: {
				"IMAGE_TAG": {
					type: codeBuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: getCurrentDateAction.variable('current_date')
				}
			}
		});

		const deployApplication = new codeDeploy.EcsApplication(this, "ecs-application", {
			applicationName: "ecs-blue-green-deployment"
		})

		/**
		 * Currently, deployment group is not automatically created.
		 * You should create deployment group after `$ cdk deploy`
		 */
		const deploymentGroup = codeDeploy.EcsDeploymentGroup.fromEcsDeploymentGroupAttributes(this, "group", {
			application: deployApplication,
			deploymentGroupName: "code-deploy",
			deploymentConfig: codeDeploy.EcsDeploymentConfig.ALL_AT_ONCE
		})

		const deployAction = new codepipeline_actions.CodeDeployEcsDeployAction({
			actionName: "CodeDeploy",
			deploymentGroup: deploymentGroup,
			taskDefinitionTemplateFile: sourceOutput.atPath("taskdef.json"),
			appSpecTemplateFile: sourceOutput.atPath("appspec.yaml"),
		})

		const pipeline = new codepipeline.Pipeline(this, 'DeployPipeline', {
			pipelineName: "EventBridgeTriggeredDeployPipeline",
			stages: [
				{
					stageName: 'Source',
					actions: [sourceAction],
				},
				{
					stageName: 'GetDockerImageTag',
					actions: [getCurrentDateAction],
				},
				{
					stageName: 'BuildDocker',
					actions: [buildAction],
				},
				{
					stageName: 'DeployEcs',
					actions: [deployAction]
				}
			]
		});

		new events.Rule(this, "pipeline-trigger-event", {
			eventPattern: {
				source: [
					"aws.ecr",
					"example"
				],
				detailType: [
					"ECR Image Action"
				],
				detail: {
					"action-type": [
						"PUSH"
					],
					result: [
						"SUCCESS"
					],
					"repository-name": [
						params.ecrRepositoryName
					],
					"image-tag": [
						params.ecrRepositoryImageTag
					]
				}
			},
			targets: [new eventsTargets.CodePipeline(pipeline)],
		})
	}
}
