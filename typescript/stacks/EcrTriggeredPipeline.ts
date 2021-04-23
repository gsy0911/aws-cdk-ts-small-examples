import * as cdk from '@aws-cdk/core';
// import * as ec2 from '@aws-cdk/aws-ec2';
// import * as ecs from '@aws-cdk/aws-ecs';
// import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as events from '@aws-cdk/aws-events';
import * as eventsTargets from '@aws-cdk/aws-events-targets';
import * as iam from "@aws-cdk/aws-iam";
import * as codebuild from "@aws-cdk/aws-codebuild";
import {PythonFunction} from "@aws-cdk/aws-lambda-python";
import * as lambda from "@aws-cdk/aws-lambda";
// import * as codebuild from '@aws-cdk/aws-codebuild';
// import * as lambda from '@aws-cdk/aws-lambda';
// import { PythonFunction } from '@aws-cdk/aws-lambda-python';
// import * as iam from '@aws-cdk/aws-iam';
// import {getParams} from "../codepipeline-eb-blue-green-deploy/params";

export interface IEcrTriggeredPipeline {
	awsAccountId: string,
	cloudwatchLogsLogStreamName: string,
	gitTokenInSecretManagerARN: string,
	gitTokenInSecretManagerJsonField: string,
	gitOwner: string,
	gitRepoName: string,
	gitSourceBranch: string,
	ecrRepositoryName: string,
	ecrRepositoryImageTag: string
}


export class EcrTriggeredPipeline extends cdk.Stack {
	constructor(scope: cdk.App, id: string, params: IEcrTriggeredPipeline, props?: cdk.StackProps) {
		super(scope, id, props);

		const pipeline = new codepipeline.Pipeline(this, 'DeployPipeline', {
            pipelineName: "MyPipeline"
        });

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
        pipeline.addStage({
            stageName: 'Source',
            actions: [sourceAction],
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
		pipeline.addStage({
            stageName: 'GetDockerImageTag',
            actions: [getCurrentDateAction],
        });

		/**
		 * deploy action
		 */
		const buildRole = new iam.Role(this, 'BuildRole', {
			assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com')
		})
		buildRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'BuildRoleToAccessECR', 'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess'))

		// to build docker in CodeBuild, set priviledged True
		const codeBuildCache = codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER)
        const project = new codebuild.PipelineProject(this, 'MyProject', {
			environment: {
				buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2,
				privileged: true
			},
			cache: codeBuildCache,
			environmentVariables: {
				"AWS_ACCOUNT": {
					type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: params.awsAccountId,
				},
				// overwrite values in BuildAction
				"IMAGE_TAG": {
					type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: getCurrentDateAction.variable('current_date')
				},
				"LOG_STREAM_NAME": {
					type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
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
					type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: getCurrentDateAction.variable('current_date')
				}
			}
        });
		pipeline.addStage({
            stageName: 'BuildDockerAndDeployEB',
            actions: [buildAction],
        });

		// const vpc = ec2.Vpc.fromLookup(this, `existing-vpc-${id}`, {
		// 	vpcId: params.vpcId
		// })
		// const cluster = new ecs.Cluster(this, 'FargateCluster', {
		// 	vpc: vpc,
		// 	clusterName: "fargate-cluster"
		// });
		//
		// // create a task definition with CloudWatch Logs
		// const logging = new ecs.AwsLogDriver({
		// 	streamPrefix: "myapp",
		// })
		//
		// const taskDef = new ecs.FargateTaskDefinition(this, "MyTaskDefinition", {
		// 	memoryLimitMiB: 512,
		// 	cpu: 256,
		// })
		//
		// // in Fargate, `Link` is disabled because only `awsvpc` mode supported.
		// // So, use `localhost:port` instead.
		// taskDef.addContainer("NodeContainer", {
		// 	image: ecs.ContainerImage.fromAsset("../stacks/docker/ws_node"),
		// 	portMappings: [
		// 		{
		// 			containerPort: 8080,
		// 			hostPort: 8080
		// 		}
		// 	],
		// 	logging,
		// })
		// taskDef.addContainer("NginxContainer", {
		// 	image: ecs.ContainerImage.fromAsset("../stacks/docker/ws_nginx"),
		// 	portMappings: [
		// 		{
		// 			containerPort: 80,
		// 			hostPort: 80
		// 		}
		// 	],
		// 	logging,
		// })
		//
		// // Instantiate Fargate Service with just cluster and image
		// new ecs_patterns.ApplicationLoadBalancedFargateService(this, "FargateService", {
		// 	cluster: cluster,
		// 	assignPublicIp: true,
		// 	taskDefinition: taskDef,
		// 	deploymentController: {
		// 		// Blue/Green Deployment using CodeDeploy
		// 		type: ecs.DeploymentControllerType.CODE_DEPLOY
		// 	},
		// 	circuitBreaker: {rollback: true}
		// });

		new events.Rule(this, "security-hub-event", {
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
