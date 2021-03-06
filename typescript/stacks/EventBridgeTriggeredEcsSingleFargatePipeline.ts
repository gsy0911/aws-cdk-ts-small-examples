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
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as elb from '@aws-cdk/aws-elasticloadbalancingv2';


export interface IEventBridgeTriggeredEcsFargatePipeline {
	vpcId: string
	env: {
		account: string
		region: string
	},
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


export class EventBridgeTriggeredEcsSingleFargatePipeline extends cdk.Stack {
	constructor(scope: cdk.App, id: string, params: IEventBridgeTriggeredEcsFargatePipeline, props?: cdk.StackProps) {
		super(scope, id, props);

		/**
		 * ECS + Fargate Environment
		 */
		const vpc = ec2.Vpc.fromLookup(this, `existing-vpc-${id}`, {
			vpcId: params.vpcId
		})
		const cluster = new ecs.Cluster(this, 'FargateCluster', {
			vpc: vpc,
			clusterName: "fargate-elb-pipeline-cluster",
			defaultCloudMapNamespace: {
				name: "cdk.example.com."
			},
			// only support `FARGATE` or `FARGATE_SPOT`.
			capacityProviders: ["FARGATE_SPOT"]
		});

		// create a task definition with CloudWatch Logs
		const logging = new ecs.AwsLogDriver({
			streamPrefix: "fargate-app",
		})

		const executionRole = new iam.Role(this, 'executionRole', {
			roleName: "ecsExecutionRole",
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
		})
		executionRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, "cloudwatch_logs_access", "arn:aws:iam::aws:policy/AWSOpsWorksCloudWatchLogs"))
		executionRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, "ecr_read_access", "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"))

		const taskRole = new iam.Role(this, 'taskRole', {
			roleName: "ecsTaskRole",
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
		})
		const taskDef = new ecs.FargateTaskDefinition(this, "MyTaskDefinition", {
			memoryLimitMiB: 512,
			cpu: 256,
			executionRole: executionRole,
			taskRole: taskRole,
			// set same name as taskdef.json in repository.
			family: "EcsFargatePipeline",
		})

		// in Fargate, `Link` is disabled because only `awsvpc` mode supported.
		// So, use `localhost:port` instead.
		// set `id` as same as ContainerName of LoadBalancerInfo in `appspec.yaml`
		taskDef.addContainer("NodeContainer", {
			image: ecs.ContainerImage.fromAsset("../stacks/docker/ws_node"),
			portMappings: [
				{
					containerPort: 8080,
					hostPort: 8080
				}
			],
			logging,
		})

		const service = new ecs.FargateService(this, "FargateService", {
			cluster: cluster,
			taskDefinition: taskDef,
			deploymentController: {
				type: ecs.DeploymentControllerType.CODE_DEPLOY
			},
			healthCheckGracePeriod: cdk.Duration.seconds(5),
			assignPublicIp: true,
			// internal A-recode like `node.cdk.example.com`
			cloudMapOptions: {
				name: "node"
			}
		})

		const alb = new elb.ApplicationLoadBalancer(this, "ApplicationLoadBalancer", {
			loadBalancerName: "EcsFargateALB",
			vpc: vpc,
			idleTimeout: cdk.Duration.seconds(30),
			// scheme: true to access from external internet
			internetFacing: true,
		})

		const targetGroupBlue = new elb.ApplicationTargetGroup(this, "http-blue-target", {
			vpc: vpc,
			targetGroupName: "http-blue-target",
			protocol: elb.ApplicationProtocol.HTTP,
			deregistrationDelay: cdk.Duration.seconds(30),
			targetType: elb.TargetType.IP,
			targets: [service],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: cdk.Duration.seconds(10)
			}
		})

		/** MUST set green environment as 2nd target group */
		const targetGroupGreen = new elb.ApplicationTargetGroup(this, "http-green-target", {
			vpc: vpc,
			targetGroupName: "http-green-target",
			protocol: elb.ApplicationProtocol.HTTP,
			deregistrationDelay: cdk.Duration.seconds(30),
			targetType: elb.TargetType.IP,
			targets: [],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: cdk.Duration.seconds(10)
			}
		})

		const listenerHttp1 = alb.addListener("listener-http-1", {
			protocol: elb.ApplicationProtocol.HTTP
		})
		listenerHttp1.addTargetGroups("listener-1-group", {
			targetGroups: [targetGroupBlue]
		})

		const listenerHttp2 = alb.addListener("listener-http-2", {
			port: 8080,
		})
		listenerHttp2.addTargetGroups("listener-2-group", {
			targetGroups: [targetGroupGreen]
		})

		/**
		 * CodePipeline
		 */
		const sourceOutput = new codepipeline.Artifact(`${id}-pipeline-artifact-${params.awsAccountId}`);
		const oauth = cdk.SecretValue.secretsManager(params.gitTokenInSecretManagerARN, {jsonField: params.gitTokenInSecretManagerJsonField});
		const sourceAction = new codepipeline_actions.GitHubSourceAction({
			actionName: 'GitHubSource',
			owner: params.gitOwner,
			repo: params.gitRepoName,
			oauthToken: oauth,
			output: sourceOutput,
			branch: params.gitSourceBranch || 'master',
			trigger: codepipeline_actions.GitHubTrigger.NONE
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
			roleName: `${id}-BuildRole`,
			assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com')
		})
		buildRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'BuildRoleToAccessECR', 'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess'))
		/** Policy to access SecretsManager */
		buildRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'CodeBuildSecretsManagerAccess', 'arn:aws:iam::aws:policy/SecretsManagerReadWrite'))

		// to build docker in CodeBuild, set privileged True
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

		/**
		 * DeployActionRole
		 * see: https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/codedeploy_IAM_role.html
		 */
		const deployActionRole = new iam.Role(this, 'deployActionRole', {
			roleName: `${id}-deployActionRole`,
			assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com')
		})
		deployActionRole.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			resources: ["*"],
			actions: [
				"ecs:DescribeServices",
				"ecs:CreateTaskSet",
				"ecs:UpdateServicePrimaryTaskSet",
				"ecs:DeleteTaskSet",
				"elasticloadbalancing:DescribeTargetGroups",
				"elasticloadbalancing:DescribeListeners",
				"elasticloadbalancing:ModifyListener",
				"elasticloadbalancing:DescribeRules",
				"elasticloadbalancing:ModifyRule",
				"lambda:InvokeFunction",
				"cloudwatch:DescribeAlarms",
				"sns:Publish",
				"s3:GetObject*",
				"s3:GetObjectVersion",
				"s3:GetBucket*",
				"s3:List*"
			],
		}))
		deployActionRole.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			resources: ["*"],
			actions: [
				"iam:PassRole"
			],
			conditions: {
				StringLike: {"iam:PassedToService": "ecs-tasks.amazonaws.com"}
			}
		}))
		deployActionRole.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			resources: ["*"],
			actions: [
				"codedeploy:Get*",
				"codedeploy:RegisterApplicationRevision",
				"kms:Decrypt",
				"kms:DescribeKey"
			],
			sid: "additionalActions"
		}))
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
					actions: [deployAction],
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
