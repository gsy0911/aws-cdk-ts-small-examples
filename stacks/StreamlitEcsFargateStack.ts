import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from "@aws-cdk/aws-iam";
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';

export interface IStreamlitEcsFargate {
	vpcId: string
	env: {
		account: string
		region: string
	}
}


export class StreamlitEcsFargateStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, params: IStreamlitEcsFargate, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = ec2.Vpc.fromLookup(this, `existing-vpc`, {
			vpcId: params.vpcId
		})
		const cluster = new ecs.Cluster(this, 'StreamlitCluster', {
			vpc: vpc,
			clusterName: "streamlit-cluster"
		});

		const taskRole = new iam.Role(this, 'taskRole', {
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromManagedPolicyArn(this, "ecsFullAccess", "arn:aws:iam::aws:policy/AmazonECS_FullAccess")
			]
		})
		const taskDef = new ecs.FargateTaskDefinition(this, "StreamlitTask", {
			memoryLimitMiB: 512,
			cpu: 256,
			taskRole: taskRole,
			family: "streamlit-task"
		})

		taskDef.addContainer("StreamlitContainer", {
			image: ecs.ContainerImage.fromAsset("../stacks/docker/streamlit"),
			portMappings: [
				{
					containerPort: 80,
					hostPort: 80
				}
			],
			command: ["streamlit", "run", "app.py"]
		})

		// Instantiate Fargate Service with just cluster and image
		new ecs_patterns.ApplicationLoadBalancedFargateService(this, "StreamlitService", {
			cluster: cluster,
			assignPublicIp: true,
			taskDefinition: taskDef,
			healthCheckGracePeriod: cdk.Duration.seconds(5),
		});

	}
}
