import {
	Duration,
	Stack,
	StackProps,
	aws_ec2,
	aws_ecs,
	aws_ecs_patterns,
	aws_iam,
	aws_elasticloadbalancingv2 as aws_elbv2
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {IEcrEcsFargateElb} from "../stacks/EcrEcsMultipleFargateElbStack2";


export interface IEcrEcsFargateStack {
	vpcId: string
}


export class EcrEcsFargateStack extends Stack {
	constructor(scope: Construct, id: string, params: IEcrEcsFargateStack, props?: StackProps) {
		super(scope, id, props);

		const vpc = aws_ec2.Vpc.fromLookup(this, 'existing-vpc', {
			vpcId: params.vpcId
		})
		const cluster = new aws_ecs.Cluster(this, 'FargateCluster', {
			vpc: vpc,
			clusterName: "fargate-cluster"
		});

		// create a task definition with CloudWatch Logs
		const logging = new aws_ecs.AwsLogDriver({
			streamPrefix: "myapp",
		})

		const taskRole = new aws_iam.Role(this, 'taskRole', {
			assumedBy: new aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com')
		})
		taskRole.addManagedPolicy(aws_iam.ManagedPolicy.fromManagedPolicyArn(this, "ecs_full_access", "arn:aws:iam::aws:policy/AmazonECS_FullAccess"))
		const taskDef = new aws_ecs.FargateTaskDefinition(this, "MyTaskDefinition", {
			memoryLimitMiB: 512,
			cpu: 256,
			taskRole: taskRole
		})

		// in Fargate, `Link` is disabled because only `awsvpc` mode supported.
		// So, use `localhost:port` instead.
		taskDef.addContainer("NodeContainer", {
			image: aws_ecs.ContainerImage.fromAsset("./lib/docker/ws_node"),
			portMappings: [
				{
					containerPort: 8080,
					hostPort: 8080
				}
			],
			logging,
		})
		taskDef.addContainer("NginxContainer", {
			image: aws_ecs.ContainerImage.fromAsset("./lib/docker/ws_nginx"),
			portMappings: [
				{
					containerPort: 80,
					hostPort: 80
				}
			],
			logging,
		})

		// Instantiate Fargate Service with just cluster and image
		new aws_ecs_patterns.ApplicationLoadBalancedFargateService(this, "FargateService", {
			cluster: cluster,
			assignPublicIp: true,
			taskDefinition: taskDef,
			deploymentController: {
				// Blue/Green Deployment using CodeDeploy
				type: aws_ecs.DeploymentControllerType.CODE_DEPLOY
			},
            minHealthyPercent: 50,
            maxHealthyPercent: 200,
			healthCheckGracePeriod: Duration.seconds(5),
		});

	}
}


export class EcrEcsMultipleFargateElbStack1 extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		const vpc = new aws_ec2.Vpc(this, `fargate-vpc`, {
			cidr: "10.0.0.0/24",
			subnetConfiguration: [
				{
					name: `${id}-subnet-public`,
					subnetType: aws_ec2.SubnetType.PUBLIC,
					cidrMask: 28,
				}
			],
		})

		const cluster = new aws_ecs.Cluster(this, 'FargateCluster', {
			vpc: vpc,
			clusterName: "fargate-elb-cluster",
			defaultCloudMapNamespace: {
				name: "cdk.ts."
			},
			enableFargateCapacityProviders: true
		});

		// create a task definition with CloudWatch Logs
		const logging = new aws_ecs.AwsLogDriver({
			streamPrefix: "myapp",
		})

		const executionRole = new aws_iam.Role(this, 'executionRole', {
			roleName: "ecsExecutionRole",
			assumedBy: new aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			managedPolicies: [
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, "cloudwatch_logs_access", "arn:aws:iam::aws:policy/AWSOpsWorksCloudWatchLogs"),
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, "ecr_read_access", "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly")
			]
		})

		const taskRole = new aws_iam.Role(this, 'taskRole', {
			roleName: "ecsTaskRole",
			assumedBy: new aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com')
		})

		const taskNginx = new aws_ecs.FargateTaskDefinition(this, "task-nginx", {
			family: "task-nginx",
			memoryLimitMiB: 512,
			cpu: 256,
			executionRole: executionRole,
			taskRole: taskRole,
		})

		// in Fargate, `Link` is disabled because only `awsvpc` mode supported.
		// So, use `localhost:port` instead.
		taskNginx.addContainer("NginxContainer", {
			// hostname is not supported when it is `awsvpc` (i.e. fargate)
			// hostname: "nginx-container",
			image: aws_ecs.ContainerImage.fromAsset("./lib/docker/ws_nginx"),
			portMappings: [
				{
					containerPort: 80,
					hostPort: 80
				}
			],
			logging,
		})

		taskNginx.addContainer("PythonContainer", {
			image: aws_ecs.ContainerImage.fromAsset("./lib/docker/ws_python"),
			logging,
		})

		const serviceNginx = new aws_ecs.FargateService(this, "FargateServiceNginx", {
			cluster: cluster,
			taskDefinition: taskNginx,
			deploymentController: {
				type: aws_ecs.DeploymentControllerType.CODE_DEPLOY
			},
			healthCheckGracePeriod: Duration.seconds(5),
			assignPublicIp: true,
			// internal A-recode like `nginx.cdk.example.com`
			cloudMapOptions: {
				name: "nginx"
			},
		})

		const alb = new aws_elbv2.ApplicationLoadBalancer(this, "ApplicationLoadBalancer", {
			loadBalancerName: "EcsSingleFargateALB",
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
			targets: [serviceNginx],
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

	}
}


export class EcrEcsMultipleFargateElbStack2 extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		const vpc = new aws_ec2.Vpc(this, `fargate-vpc`, {
			cidr: "10.0.0.0/24",
			subnetConfiguration: [
				{
					name: `${id}-subnet-public`,
					subnetType: aws_ec2.SubnetType.PUBLIC,
					cidrMask: 28,
				}
			],
			enableDnsHostnames: true,
			enableDnsSupport: true
		})

		const cluster = new aws_ecs.Cluster(this, 'FargateCluster', {
			vpc: vpc,
			clusterName: "fargate-elb-cluster",
			defaultCloudMapNamespace: {
				name: "cdk.ts."
			},
			// only support `FARGATE` or `FARGATE_SPOT`.
			enableFargateCapacityProviders: true
		});

		// create a task definition with CloudWatch Logs
		const logging = new aws_ecs.AwsLogDriver({
			streamPrefix: "myapp",
		})

		const executionRole = new aws_iam.Role(this, 'executionRole', {
			roleName: "ecsExecutionRole",
			assumedBy: new aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com')
		})
		executionRole.addManagedPolicy(aws_iam.ManagedPolicy.fromManagedPolicyArn(this, "cloudwatch_logs_access", "arn:aws:iam::aws:policy/AWSOpsWorksCloudWatchLogs"))
		executionRole.addManagedPolicy(aws_iam.ManagedPolicy.fromManagedPolicyArn(this, "ecr_read_access", "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"))

		const taskRole = new aws_iam.Role(this, 'taskRole', {
			roleName: "ecsTaskRole",
			assumedBy: new aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com')
		})

		const taskNginx = new aws_ecs.FargateTaskDefinition(this, "task-nginx", {
			family: "task-nginx",
			memoryLimitMiB: 512,
			cpu: 256,
			executionRole: executionRole,
			taskRole: taskRole,
		})

		// in Fargate, `Link` is disabled because only `awsvpc` mode supported.
		// So, use `localhost:port` instead.
		taskNginx.addContainer("NginxContainer", {
			// hostname is not supported when it is `awsvpc` (i.e. fargate)
			image: aws_ecs.ContainerImage.fromAsset("./lib/docker/ws_nginx"),
			portMappings: [
				{
					containerPort: 80,
					hostPort: 80
				}
			],
			logging,
		})

		const serviceNginx = new aws_ecs.FargateService(this, "FargateServiceNginx", {
			cluster: cluster,
			taskDefinition: taskNginx,
			deploymentController: {
				type: aws_ecs.DeploymentControllerType.CODE_DEPLOY
			},
			healthCheckGracePeriod: Duration.seconds(5),
			assignPublicIp: true,
		})

		const taskApp = new aws_ecs.FargateTaskDefinition(this, "task-app", {
			family: "task-app",
			memoryLimitMiB: 512,
			cpu: 256,
			executionRole: executionRole,
			taskRole: taskRole,
		})

		// in Fargate, `Link` is disabled because only `awsvpc` mode supported.
		taskApp.addContainer("PythonContainer", {
			image: aws_ecs.ContainerImage.fromAsset("./lib/docker/ws_python"),
			portMappings: [
				{
					containerPort: 8000,
					protocol: aws_ecs.Protocol.TCP,
					hostPort: 8000
				}
			],
			logging,
		})

		const serviceApp = new aws_ecs.FargateService(this, "FargateServiceApp", {
			cluster: cluster,
			taskDefinition: taskApp,
			assignPublicIp: true,
			// internal A-recode like `app.cdk.ts`
			cloudMapOptions: {
				name: "app",
			},
		})

		const alb = new aws_elbv2.ApplicationLoadBalancer(this, "ApplicationLoadBalancer", {
			loadBalancerName: "EcsSingleFargateALB",
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
			targets: [serviceNginx],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: Duration.seconds(10)
			}
		})

		const targetGroupGreen = new aws_elbv2.ApplicationTargetGroup(this, "http-green-target", {
			vpc: vpc,
			targetGroupName: "http-green-target",
			protocol: aws_elbv2.ApplicationProtocol.HTTP,
			deregistrationDelay: Duration.seconds(30),
			targetType: aws_elbv2.TargetType.IP,
			targets: [serviceNginx],
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
	}
}
