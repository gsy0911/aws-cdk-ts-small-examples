import {
	Duration,
	Stack,
	StackProps,
	aws_ec2,
	aws_ecs,
	aws_ecs_patterns,
	aws_iam,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';


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
