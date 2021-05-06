import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from "@aws-cdk/aws-iam";
import * as elb from '@aws-cdk/aws-elasticloadbalancingv2';

export interface IEcrEcsFargateElb {
	vpcId: string
	env: {
		account: string
		region: string
	}
}


export class EcrEcsFargateElbStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, params: IEcrEcsFargateElb, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = ec2.Vpc.fromLookup(this, `existing-vpc-${id}`, {
			vpcId: params.vpcId
		})
		const cluster = new ecs.Cluster(this, 'FargateCluster', {
			vpc: vpc,
			clusterName: "fargate-elb-cluster"
		});

		// create a task definition with CloudWatch Logs
		const logging = new ecs.AwsLogDriver({
			streamPrefix: "myapp",
		})

		const taskRole = new iam.Role(this, 'taskRole', {
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
		})
		taskRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, "ecs_full_access", "arn:aws:iam::aws:policy/AmazonECS_FullAccess"))
		const taskDef = new ecs.FargateTaskDefinition(this, "MyTaskDefinition", {
			memoryLimitMiB: 512,
			cpu: 256,
			taskRole: taskRole
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

		const service = new ecs.FargateService(this, "FargateService", {
			cluster: cluster,
			taskDefinition: taskDef,
			deploymentController: {
				type: ecs.DeploymentControllerType.CODE_DEPLOY
			},
			healthCheckGracePeriod: cdk.Duration.seconds(5),
			assignPublicIp: true,

		})

		const alb = new elb.ApplicationLoadBalancer(this, "ApplicationLoadBalancer", {
			vpc: vpc,
			idleTimeout: cdk.Duration.seconds(30),
			// scheme: true to access from external internet
			internetFacing: true,
		})
		const listener80 = alb.addListener("listener", {
			port: 80,
		})

		listener80.addTargets("ecs-fargate", {
			port: 80,
			deregistrationDelay: cdk.Duration.seconds(30),
			targets: [service],
		})
	}
}
