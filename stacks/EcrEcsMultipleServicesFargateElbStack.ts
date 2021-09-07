import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from "@aws-cdk/aws-iam";
import * as elb from '@aws-cdk/aws-elasticloadbalancingv2';


export class EcrEcsMultipleServicesFargateElbStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = new ec2.Vpc(this, `fargate-vpc`, {
			cidr: "10.0.0.0/24",
			subnetConfiguration: [
				{
					name: `${id}-subnet-public`,
					subnetType: ec2.SubnetType.PUBLIC,
					cidrMask: 28,
				}
			],
		})

		const cluster = new ecs.Cluster(this, 'FargateCluster', {
			vpc: vpc,
			clusterName: "multiple-services-fargate-elb-cluster",
			// only support `FARGATE` or `FARGATE_SPOT`.
			capacityProviders: ["FARGATE_SPOT"]
		});

		// create a task definition with CloudWatch Logs
		const logging = new ecs.AwsLogDriver({
			streamPrefix: "myapp",
		})

		const executionRole = new iam.Role(this, 'executionRole', {
			roleName: "ecsExecutionRole",
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromManagedPolicyArn(this, "cloudwatch_logs_access", "arn:aws:iam::aws:policy/AWSOpsWorksCloudWatchLogs"),
				iam.ManagedPolicy.fromManagedPolicyArn(this, "ecr_read_access", "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly")
			]
		})

		const taskRole = new iam.Role(this, 'taskRole', {
			roleName: "ecsTaskRole",
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
		})

		const taskDef = new ecs.FargateTaskDefinition(this, "MyTaskDefinition", {
			memoryLimitMiB: 512,
			cpu: 256,
			executionRole: executionRole,
			taskRole: taskRole,
		})

		taskDef.addContainer("StreamlitContainer", {
			image: ecs.ContainerImage.fromAsset("../../stacks/docker/streamlit"),
			portMappings: [
				{
					containerPort: 80,
					hostPort: 80
				}
			],
			command: ["streamlit", "run", "app.py"],
			logging
		})

		const service1 = new ecs.FargateService(this, "StreamlitService", {
			cluster: cluster,
			taskDefinition: taskDef,
			deploymentController: {
				type: ecs.DeploymentControllerType.CODE_DEPLOY
			},
			healthCheckGracePeriod: cdk.Duration.seconds(5),
			assignPublicIp: true,
		})

		const taskDef2 = new ecs.FargateTaskDefinition(this, "MyTaskDefinition2", {
			memoryLimitMiB: 512,
			cpu: 256,
			executionRole: executionRole,
			taskRole: taskRole,
		})

		taskDef2.addContainer("StreamlitContainer2", {
			image: ecs.ContainerImage.fromAsset("../../stacks/docker/streamlit_2"),
			portMappings: [
				{
					containerPort: 80,
					hostPort: 80
				}
			],
			command: ["streamlit", "run", "app.py"],
			logging
		})

		const service2 = new ecs.FargateService(this, "StreamlitService2", {
			cluster: cluster,
			taskDefinition: taskDef2,
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

		const service1TargetGroupBlue = new elb.ApplicationTargetGroup(this, "http-blue-target", {
			vpc: vpc,
			targetGroupName: "service-1-http-blue-target",
			protocol: elb.ApplicationProtocol.HTTP,
			deregistrationDelay: cdk.Duration.seconds(30),
			targetType: elb.TargetType.IP,
			targets: [service1],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: cdk.Duration.seconds(10)
			}
		})

		const service2TargetGroupBlue = new elb.ApplicationTargetGroup(this, "http-blue-target-2", {
			vpc: vpc,
			targetGroupName: "service-2-http-blue-target",
			protocol: elb.ApplicationProtocol.HTTP,
			deregistrationDelay: cdk.Duration.seconds(30),
			targetType: elb.TargetType.IP,
			targets: [service2],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: cdk.Duration.seconds(10)
			}
		})

		const listenerHttp1 = alb.addListener("listener-http-1", {
			protocol: elb.ApplicationProtocol.HTTP
		})
		listenerHttp1.addTargetGroups("listener-1-group", {
			targetGroups: [service1TargetGroupBlue]
		})
		listenerHttp1.addTargetGroups("streamlit-2", {
			targetGroups: [service2TargetGroupBlue],
			conditions: [elb.ListenerCondition.pathPatterns(["/streamlit2"])],
			priority: 1
		})

	}
}
