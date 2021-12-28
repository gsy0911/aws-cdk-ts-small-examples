import {
	Duration,
	Stack,
	StackProps,
	SecretValue,
	Tags,
	aws_ec2,
	aws_ecs,
	aws_lambda,
	aws_codepipeline,
	aws_codepipeline_actions,
	aws_codebuild,
	aws_codedeploy,
	aws_iam,
	aws_events,
	aws_events_targets,
	aws_elasticloadbalancingv2 as aws_elbv2
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PythonFunction } from '@aws-cdk/aws-lambda-python-alpha';


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


export class EventBridgeTriggeredEcsSingleFargatePipelineStack extends Stack {
	constructor(scope: Construct, id: string, params: IEventBridgeTriggeredEcsFargatePipeline, props?: StackProps) {
		super(scope, id, props);

		/**
		 * ECS + Fargate Environment
		 */
		const vpc = aws_ec2.Vpc.fromLookup(this, `existing-vpc-${id}`, {
			vpcId: params.vpcId
		})
		const cluster = new aws_ecs.Cluster(this, 'FargateCluster', {
			vpc: vpc,
			clusterName: "fargate-elb-pipeline-cluster",
			defaultCloudMapNamespace: {
				name: "cdk.example.com."
			},
			enableFargateCapacityProviders: true
		});

		// create a task definition with CloudWatch Logs
		const logging = new aws_ecs.AwsLogDriver({
			streamPrefix: "fargate-app",
		})

		const executionRole = new aws_iam.Role(this, 'executionRole', {
			roleName: "ecsExecutionRole",
			assumedBy: new aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			managedPolicies: [
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, "cwLogsAccess", "arn:aws:iam::aws:policy/AWSOpsWorksCloudWatchLogs"),
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, "ecrReadAccess", "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly")
			]
		})

		const taskRole = new aws_iam.Role(this, 'taskRole', {
			roleName: "ecsTaskRole",
			assumedBy: new aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com')
		})
		const taskDef = new aws_ecs.FargateTaskDefinition(this, "MyTaskDefinition", {
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
			image: aws_ecs.ContainerImage.fromAsset("../stacks/docker/ws_node"),
			portMappings: [
				{
					containerPort: 8080,
					hostPort: 8080
				}
			],
			logging,
		})

		const service = new aws_ecs.FargateService(this, "FargateService", {
			cluster: cluster,
			taskDefinition: taskDef,
			deploymentController: {
				type: aws_ecs.DeploymentControllerType.CODE_DEPLOY
			},
			healthCheckGracePeriod: Duration.seconds(5),
			assignPublicIp: true,
			// internal A-recode like `node.cdk.example.com`
			cloudMapOptions: {
				name: "node"
			}
		})

		const alb = new aws_elbv2.ApplicationLoadBalancer(this, "ApplicationLoadBalancer", {
			loadBalancerName: "EcsFargateALB",
			vpc: vpc,
			idleTimeout: Duration.seconds(30),
			// scheme: true to access from external internet
			internetFacing: true,
		})

		const targetGroupBlue = new aws_elbv2.ApplicationTargetGroup(this, "http-blue-target", {
			vpc: vpc,
			targetGroupName: "http-blue-target",
			protocol: aws_elbv2.ApplicationProtocol.HTTP,
			deregistrationDelay: Duration.seconds(30),
			targetType: aws_elbv2.TargetType.IP,
			targets: [service],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: Duration.seconds(10)
			}
		})

		/** MUST set green environment as 2nd target group */
		const targetGroupGreen = new aws_elbv2.ApplicationTargetGroup(this, "http-green-target", {
			vpc: vpc,
			targetGroupName: "http-green-target",
			protocol: aws_elbv2.ApplicationProtocol.HTTP,
			deregistrationDelay: Duration.seconds(30),
			targetType: aws_elbv2.TargetType.IP,
			targets: [],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: Duration.seconds(10)
			}
		})

		const listenerHttp1 = alb.addListener("listener-http-1", {
			protocol: aws_elbv2.ApplicationProtocol.HTTP
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
		const sourceOutput = new aws_codepipeline.Artifact(`${id}-pipeline-artifact-${params.awsAccountId}`);
		const oauth = SecretValue.secretsManager(params.gitTokenInSecretManagerARN, {jsonField: params.gitTokenInSecretManagerJsonField});
		const sourceAction = new aws_codepipeline_actions.GitHubSourceAction({
			actionName: 'GitHubSource',
			owner: params.gitOwner,
			repo: params.gitRepoName,
			oauthToken: oauth,
			output: sourceOutput,
			branch: params.gitSourceBranch || 'master',
			trigger: aws_codepipeline_actions.GitHubTrigger.NONE
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
			runtime: aws_lambda.Runtime.PYTHON_3_8,
		})
		Tags.of(lambdaCurrentDate).add("runtime", "python")
		const getCurrentDateAction = new aws_codepipeline_actions.LambdaInvokeAction({
			actionName: 'getCurrentDate',
			lambda: lambdaCurrentDate,
			variablesNamespace: 'BuildVariables'
		})

		/**
		 * Build action
		 */
		const buildRole = new aws_iam.Role(this, 'BuildRole', {
			roleName: `${id}-BuildRole`,
			assumedBy: new aws_iam.ServicePrincipal('codebuild.amazonaws.com'),
			managedPolicies: [
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, 'BuildRoleToAccessECR', 'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess'),
				/** Policy to access SecretsManager */
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, 'CodeBuildSecretsManagerAccess', 'arn:aws:iam::aws:policy/SecretsManagerReadWrite')
			]
		})

		// to build docker in CodeBuild, set privileged True
		const codeBuildCache = aws_codebuild.Cache.local(aws_codebuild.LocalCacheMode.DOCKER_LAYER)
		const project = new aws_codebuild.PipelineProject(this, 'MyProject', {
			environment: {
				buildImage: aws_codebuild.LinuxBuildImage.AMAZON_LINUX_2,
				privileged: true
			},
			cache: codeBuildCache,
			environmentVariables: {
				"AWS_ACCOUNT": {
					type: aws_codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: params.awsAccountId,
				},
				// overwrite values in BuildAction
				"IMAGE_TAG": {
					type: aws_codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: getCurrentDateAction.variable('current_date')
				},
				"LOG_STREAM_NAME": {
					type: aws_codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: params.cloudwatchLogsLogStreamName
				}
			},
			role: buildRole
		});

		const buildAction = new aws_codepipeline_actions.CodeBuildAction({
			actionName: 'CodeBuild',
			project,
			input: sourceOutput, // The build action must use the CodeCommitSourceAction output as input.
			outputs: [new aws_codepipeline.Artifact()], // optional
			runOrder: 2,
			environmentVariables: {
				"IMAGE_TAG": {
					type: aws_codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: getCurrentDateAction.variable('current_date')
				}
			}
		});

		const deployApplication = new aws_codedeploy.EcsApplication(this, "ecs-application", {
			applicationName: "ecs-blue-green-deployment"
		})

		/**
		 * Currently, deployment group is not automatically created.
		 * You should create deployment group after `$ cdk deploy`
		 */
		const deploymentGroup = aws_codedeploy.EcsDeploymentGroup.fromEcsDeploymentGroupAttributes(this, "group", {
			application: deployApplication,
			deploymentGroupName: "code-deploy",
			deploymentConfig: aws_codedeploy.EcsDeploymentConfig.ALL_AT_ONCE
		})

		/**
		 * DeployActionRole
		 * see: https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/codedeploy_IAM_role.html
		 */
		const deployActionRole = new aws_iam.Role(this, 'deployActionRole', {
			roleName: `${id}-deployActionRole`,
			assumedBy: new aws_iam.ServicePrincipal('codedeploy.amazonaws.com')
		})
		deployActionRole.addToPolicy(new aws_iam.PolicyStatement({
			effect: aws_iam.Effect.ALLOW,
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
		deployActionRole.addToPolicy(new aws_iam.PolicyStatement({
			effect: aws_iam.Effect.ALLOW,
			resources: ["*"],
			actions: [
				"iam:PassRole"
			],
			conditions: {
				StringLike: {"iam:PassedToService": "ecs-tasks.amazonaws.com"}
			}
		}))
		deployActionRole.addToPolicy(new aws_iam.PolicyStatement({
			effect: aws_iam.Effect.ALLOW,
			resources: ["*"],
			actions: [
				"codedeploy:Get*",
				"codedeploy:RegisterApplicationRevision",
				"kms:Decrypt",
				"kms:DescribeKey"
			],
			sid: "additionalActions"
		}))
		const deployAction = new aws_codepipeline_actions.CodeDeployEcsDeployAction({
			actionName: "CodeDeploy",
			deploymentGroup: deploymentGroup,
			taskDefinitionTemplateFile: sourceOutput.atPath("taskdef.json"),
			appSpecTemplateFile: sourceOutput.atPath("appspec.yaml"),
		})

		const pipeline = new aws_codepipeline.Pipeline(this, 'DeployPipeline', {
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

		new aws_events.Rule(this, "pipeline-trigger-event", {
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
			targets: [new aws_events_targets.CodePipeline(pipeline)],
		})
	}
}
