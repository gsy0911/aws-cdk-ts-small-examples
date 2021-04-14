import * as cdk from "@aws-cdk/core";
import * as iam from '@aws-cdk/aws-iam';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecrAssets from '@aws-cdk/aws-ecr-assets';
import * as batch from '@aws-cdk/aws-batch';
import * as stepfunctions from '@aws-cdk/aws-stepfunctions';
import * as stepfunctions_tasks from '@aws-cdk/aws-stepfunctions-tasks';

export interface IBatchLogSfn {
	environment: string
	vpcCidr: string
}


export class BatchSfnStack extends cdk.Stack {
  constructor(app: cdk.App, id: string, params: IBatchLogSfn, props?: cdk.StackProps) {
    super(app, id, props);

		const vpc = new ec2.Vpc(this, `${params.environment}-vpc`, {
			cidr: params.vpcCidr,
			subnetConfiguration: [
				{
					name: `${params.environment}-subnet-public`,
					subnetType: ec2.SubnetType.PUBLIC,
					cidrMask: 28,
				}
			]
		})

		const securityGroup = new ec2.SecurityGroup(this, `${params.environment}-security-group`, {
			vpc: vpc,
			securityGroupName: `${params.environment}-security-group`,
			allowAllOutbound: true
		})

		/** role for batch execution */
		const batchRole = new iam.Role(this, `${params.environment}-batch-role`, {
			roleName: `${params.environment}-batch-role`,
			assumedBy: new iam.ServicePrincipal('batch.amazonaws.com')
		})
		batchRole.addManagedPolicy(
			iam.ManagedPolicy.fromManagedPolicyArn(
				this, `AWSBatchServiceRole-${params.environment}`, "arn:aws:iam::aws:policy/service-role/AWSBatchServiceRole"
			)
		)
		batchRole.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			resources: ['*'],
			actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents', 'logs:DescribeLogStreams']
		}))

		/** */
		const instanceRole = new iam.Role(this, `${params.environment}-instance-role`, {
			roleName: `${params.environment}-instance-role`,
			assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
		})
		instanceRole.addManagedPolicy(
			iam.ManagedPolicy.fromManagedPolicyArn(
				this, `AmazonEC2ContainerServiceforEC2Role-${params.environment}`, "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
			)
		)
		instanceRole.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			resources: ['*'],
			actions: ['s3:*']
		}))
		instanceRole.addToPolicy(new iam.PolicyStatement({
			effect: iam.Effect.ALLOW,
			resources: ['*'],
			actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents', 'logs:DescribeLogStreams']
		}))
		/** */
		const instanceProfile = new iam.CfnInstanceProfile(this, `${params.environment}-instance-profile`, {
			instanceProfileName: `${params.environment}-instance-profile`,
			roles: [instanceRole.roleName]
		})

		const dockerImage = new ecrAssets.DockerImageAsset(this, "docker-image", {
			directory: "./docker"
		})

		/**
		 * container image
		 * tag: params.environment
		 */
		const containerImage = ecs.ContainerImage.fromDockerImageAsset(dockerImage)

		/** batch */
		const batchComputeEnvironment = new batch.ComputeEnvironment(this, `${params.environment}-batch-environment`, {
			computeEnvironmentName: `${params.environment}-batch-environment`,
			computeResources: {
				vpc: vpc,
				maxvCpus: 4,
				minvCpus: 0,
				securityGroups: [securityGroup],
				instanceRole: instanceProfile.attrArn,
				type: batch.ComputeResourceType.SPOT
			}
		})

		/** */
		const jobRole = new iam.Role(this, `${params.environment}-batch-job-role`, {
			roleName: `${params.environment}-batch-job-role`,
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
		})
		jobRole.addManagedPolicy(
			iam.ManagedPolicy.fromManagedPolicyArn(
				this, `AmazonECSTaskExecutionRolePolicy_${params.environment}`, "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
			)
		)
		jobRole.addManagedPolicy(
			iam.ManagedPolicy.fromManagedPolicyArn(
				this, `AmazonS3FullAccess_${params.environment}`, "arn:aws:iam::aws:policy/AmazonS3FullAccess"
			)
		)
		jobRole.addManagedPolicy(
			iam.ManagedPolicy.fromManagedPolicyArn(
				this, `CloudWatchLogsFullAccess_${params.environment}`, "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
			)
		)

		/** */
		const batchJobQueue = new batch.JobQueue(this, `${params.environment}-batch-job-queue`, {
			jobQueueName: `${params.environment}-batch-job-queue`,
			computeEnvironments: [
				{
					computeEnvironment: batchComputeEnvironment,
					order: 1
				}
			],
			priority: 1
		})

		/** Batch Job Definition */
		const batchJobDefinition = new batch.JobDefinition(this, `${params.environment}-batch-job-definition`, {
			jobDefinitionName: `${params.environment}-batch-job-definition`,
			container: {
				image: containerImage,
				environment: {
					"STACK_ENV": params.environment
				},
				jobRole: jobRole,
				vcpus: 1,
				memoryLimitMiB: 1024
			}
		})

		/**  */
		const sfnBatchTask = new stepfunctions_tasks.BatchSubmitJob(this, `${params.environment}-sfn-task-batch`, {
			jobDefinition: batchJobDefinition,
			jobName: `${params.environment}-batch-job-environment`,
			jobQueue: batchJobQueue,
			containerOverrides: {
				command: [
					"python", "example.py",
					"--time", "Ref::time",
				]
			},
			payload: stepfunctions.TaskInput.fromObject({
				"time.$": "$.time"
			})
		})

		/** */
		const sfnStockProcess = new stepfunctions.StateMachine(this, `${params.environment}-sfn-sm`, {
			definition: sfnBatchTask
		})
  }
}

