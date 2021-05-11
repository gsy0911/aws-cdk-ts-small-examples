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


export class EcrEcsMultipleFargateElbStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, params: IEcrEcsFargateElb, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = ec2.Vpc.fromLookup(this, `existing-vpc-${id}`, {
			vpcId: params.vpcId
		})
		const cluster = new ecs.Cluster(this, 'FargateCluster', {
			vpc: vpc,
			clusterName: "fargate-elb-cluster",
			defaultCloudMapNamespace: {
				name: "cdk.example.com."
			},
			// only support `FARGATE` or `FARGATE_SPOT`.
			capacityProviders: ["FARGATE_SPOT"]
		});

		// create a task definition with CloudWatch Logs
		const logging = new ecs.AwsLogDriver({
			streamPrefix: "myapp",
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

		const taskNode = new ecs.FargateTaskDefinition(this, "task-node", {
			family: "task-node",
			memoryLimitMiB: 512,
			cpu: 256,
			executionRole: executionRole,
			taskRole: taskRole,
		})

		// in Fargate, `Link` is disabled because only `awsvpc` mode supported.
		// So, use `localhost:port` instead.
		taskNode.addContainer("NodeContainer", {
			image: ecs.ContainerImage.fromAsset("../stacks/docker/ws_node"),
			portMappings: [
				{
					containerPort: 8080,
					hostPort: 8080
				}
			],
			logging,
		})

		const serviceNode = new ecs.FargateService(this, "FargateServiceNode", {
			cluster: cluster,
			taskDefinition: taskNode,
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

		const taskNginx = new ecs.FargateTaskDefinition(this, "task-nginx", {
			family: "task-nginx",
			memoryLimitMiB: 512,
			cpu: 256,
			executionRole: executionRole,
			taskRole: taskRole,
		})

		// in Fargate, `Link` is disabled because only `awsvpc` mode supported.
		// So, use `localhost:port` instead.
		taskNginx.addContainer("NginxContainer", {
			image: ecs.ContainerImage.fromAsset("../stacks/docker/ws_nginx"),
			portMappings: [
				{
					containerPort: 80,
					hostPort: 80
				}
			],
			logging,

		})

		const serviceNginx = new ecs.FargateService(this, "FargateServiceNginx", {
			cluster: cluster,
			taskDefinition: taskNginx,
			deploymentController: {
				type: ecs.DeploymentControllerType.CODE_DEPLOY
			},
			healthCheckGracePeriod: cdk.Duration.seconds(5),
			assignPublicIp: true,
		})

		const alb = new elb.ApplicationLoadBalancer(this, "ApplicationLoadBalancer", {
			loadBalancerName: "EcsSingleFargateALB",
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
			targets: [serviceNginx],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: cdk.Duration.seconds(10)
			}
		})

		const targetGroupGreen = new elb.ApplicationTargetGroup(this, "http-green-target", {
			vpc: vpc,
			targetGroupName: "http-green-target",
			protocol: elb.ApplicationProtocol.HTTP,
			deregistrationDelay: cdk.Duration.seconds(30),
			targetType: elb.TargetType.IP,
			targets: [serviceNode],
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
	}
}
