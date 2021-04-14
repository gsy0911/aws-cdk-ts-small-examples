import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import ecs_patterns = require('@aws-cdk/aws-ecs-patterns');

export class EcsFargateStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = new ec2.Vpc(this, 'MyVpc', {maxAzs: 2});
		const cluster = new ecs.Cluster(this, 'Ec2Cluster', {vpc});

		// create a task definition with CloudWatch Logs
		const logging = new ecs.AwsLogDriver({
			streamPrefix: "myapp",
		})

		const taskDef = new ecs.FargateTaskDefinition(this, "MyTaskDefinition", {
			memoryLimitMiB: 512,
			cpu: 256,
		})

		taskDef.addContainer("AppContainer", {
			image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
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
			cluster,
			taskDefinition: taskDef,
		});
	}
}
