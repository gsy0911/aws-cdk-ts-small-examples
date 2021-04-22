import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';

export interface IEcrEcsFargate {
	vpcId: string
	env: {
		account: string
		region: string
	}
}


export class EcrEcsFargateStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, params: IEcrEcsFargate, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = ec2.Vpc.fromLookup(this, `existing-vpc-${id}`, {
			vpcId: params.vpcId
		})
		const cluster = new ecs.Cluster(this, 'FargateCluster', {
			vpc: vpc,
			clusterName: "fargate-cluster"
		});

		// create a task definition with CloudWatch Logs
		const logging = new ecs.AwsLogDriver({
			streamPrefix: "myapp",
		})

		const taskDef = new ecs.FargateTaskDefinition(this, "MyTaskDefinition", {
			memoryLimitMiB: 512,
			cpu: 256,
		})

		// in Fargate, `Link` is disabled because only `awsvpc` mode supported.
		// So, use `localhost:port` instead.
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
		taskDef.addContainer("NginxContainer", {
			image: ecs.ContainerImage.fromAsset("../stacks/docker/ws_nginx"),
			portMappings: [
				{
					containerPort: 80,
					hostPort: 80
				}
			],
			logging,
		})

		// Instantiate Fargate Service with just cluster and image
		new ecs_patterns.ApplicationLoadBalancedFargateService(this, "FargateService", {
			cluster: cluster,
			assignPublicIp: true,
			taskDefinition: taskDef,
			deploymentController: {
				// Blue/Green Deployment using CodeDeploy
				type: ecs.DeploymentControllerType.CODE_DEPLOY
			},
			circuitBreaker: {rollback: true}
		});
	}
}