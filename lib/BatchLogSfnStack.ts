import {
	Stack,
	StackProps,
	aws_ec2,
	aws_ecs,
	aws_iam,
	aws_ecr_assets,
	aws_stepfunctions,
	aws_stepfunctions_tasks
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as batch from '@aws-cdk/aws-batch-alpha';


export interface IBatchSfnStack {
	environment: string
}


export class BatchSfnStack extends Stack {
	constructor(app: Construct, id: string, params: IBatchSfnStack, props?: StackProps) {
		super(app, id, props);

		const vpc = new aws_ec2.Vpc(this, "vpc", {
			cidr: "10.0.0.0/24",
			subnetConfiguration: [
				{
					name: `${params.environment}-subnet-public`,
					subnetType: aws_ec2.SubnetType.PUBLIC,
					cidrMask: 28,
				}
			]
		})

		const securityGroup = new aws_ec2.SecurityGroup(this, `${params.environment}-security-group`, {
			vpc: vpc,
			securityGroupName: `${params.environment}-security-group`,
			allowAllOutbound: true
		})

		/** role for batch execution */
		const batchRole = new aws_iam.Role(this, "batch-role", {
			roleName: `${params.environment}-batch-role`,
			assumedBy: new aws_iam.ServicePrincipal('batch.amazonaws.com'),
			managedPolicies: [
				aws_iam.ManagedPolicy.fromManagedPolicyArn(
					this, "AWSBatchServiceRole", "arn:aws:iam::aws:policy/service-role/AWSBatchServiceRole"
				),
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, 'batchRoleCwFullAccess', 'arn:aws:iam::aws:policy/CloudWatchFullAccess')
			]
		})

		/** */
		const instanceRole = new aws_iam.Role(this, "instance-role", {
			roleName: `${params.environment}-instance-role`,
			assumedBy: new aws_iam.ServicePrincipal('ec2.amazonaws.com'),
			managedPolicies: [

				aws_iam.ManagedPolicy.fromManagedPolicyArn(
					this, "AmazonEC2ContainerServiceforEC2Role", "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
				),

				aws_iam.ManagedPolicy.fromManagedPolicyArn(
					this, "instanceS3FullAccess", "arn:aws:iam::aws:policy/AmazonS3FullAccess"
				),
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, 'instanceCwFullAccess', 'arn:aws:iam::aws:policy/CloudWatchFullAccess')
			]
		})

		/** */
		const instanceProfile = new aws_iam.CfnInstanceProfile(this, "instance-profile", {
			instanceProfileName: `${params.environment}-instance-profile`,
			roles: [instanceRole.roleName]
		})

		const dockerImage = new aws_ecr_assets.DockerImageAsset(this, "docker-image", {
			directory: "./lib/docker/simple_py"
		})

		/**
		 * container image
		 * tag: params.environment
		 */
		const containerImage = aws_ecs.ContainerImage.fromDockerImageAsset(dockerImage)

		/** batch */
		const batchComputeEnvironment = new batch.ComputeEnvironment(this, "batch-environment", {
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
		const jobRole = new aws_iam.Role(this, "batch-job-role", {
			roleName: `${params.environment}-batch-job-role`,
			assumedBy: new aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			managedPolicies: [
				aws_iam.ManagedPolicy.fromManagedPolicyArn(
					this, "AmazonECSTaskExecutionRolePolicy", "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
				),
				aws_iam.ManagedPolicy.fromManagedPolicyArn(
					this, "jobS3FullAccess", "arn:aws:iam::aws:policy/AmazonS3FullAccess"
				),
				aws_iam.ManagedPolicy.fromManagedPolicyArn(
					this, "jobCwLogsFullAccess", "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
				)

			]
		})

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
		const sfnBatchTask = new aws_stepfunctions_tasks.BatchSubmitJob(this, `${params.environment}-sfn-task-batch`, {
			jobDefinitionArn: batchJobDefinition.jobDefinitionArn,
			jobName: `${params.environment}-batch-job-environment`,
			jobQueueArn: batchJobQueue.jobQueueArn,
			containerOverrides: {
				command: [
					"python", "example.py",
					"--time", "Ref::time",
				]
			},
			payload: aws_stepfunctions.TaskInput.fromObject({
				"time.$": "$.time"
			})
		})

		/** */
		const sfnStockProcess = new aws_stepfunctions.StateMachine(this, `${params.environment}-sfn-sm`, {
			definition: sfnBatchTask
		})
	}
}

