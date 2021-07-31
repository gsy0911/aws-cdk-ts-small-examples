import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from "@aws-cdk/aws-iam";
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';
import * as elb from "@aws-cdk/aws-elasticloadbalancingv2";
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as route53 from '@aws-cdk/aws-route53';
import * as target from '@aws-cdk/aws-route53-targets';

export interface IStreamlitEcsFargate {
	vpcId: string
	env: {
		account: string
		region: string
	}
}


export interface IStreamlitEcsFargateHttpsOnlyCloudFront {
	vpcId: string
	env: {
		account: string
		region: string
	},
	alb: {
		route53DomainName: string
		certificate: string
	}
	cloudfront: {
		route53DomainName: string
		certificate: string,
		domainNames: string[]
	}
	// certificates: {
	// 	usEast1: string
	// 	apNortheast1: string
	// },
	// domainNames: string[],
	// albDomain: string

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
			image: ecs.ContainerImage.fromAsset("../../stacks/docker/streamlit"),
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


export class StreamlitEcsFargateHttpsOnlyCloudFrontStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, params: IStreamlitEcsFargateHttpsOnlyCloudFront, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = ec2.Vpc.fromLookup(this, `existing-vpc-${id}`, {
			vpcId: params.vpcId
		})
		const cluster = new ecs.Cluster(this, 'FargateCluster', {
			vpc: vpc,
			clusterName: "streamlit-cluster",
		});

		// create a task definition with CloudWatch Logs
		const logging = new ecs.AwsLogDriver({
			streamPrefix: "myapp",
		})

		const taskRole = new iam.Role(this, 'taskRole', {
			assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromManagedPolicyArn(this, "ecsFullAccess", "arn:aws:iam::aws:policy/AmazonECS_FullAccess")
			]
		})
		const taskDef = new ecs.FargateTaskDefinition(this, "MyTaskDefinition", {
			memoryLimitMiB: 512,
			cpu: 256,
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
			command: ["streamlit", "run", "app.py"]
		})

		const service = new ecs.FargateService(this, "StreamlitService", {
			cluster: cluster,
			taskDefinition: taskDef,
			deploymentController: {
				type: ecs.DeploymentControllerType.CODE_DEPLOY
			},
			healthCheckGracePeriod: cdk.Duration.seconds(5),
			assignPublicIp: true,
		})

		const alb = new elb.ApplicationLoadBalancer(this, "ApplicationLoadBalancer", {
			loadBalancerName: "StreamlitALB",
			vpc: vpc,
			idleTimeout: cdk.Duration.seconds(30),
			// scheme: true to access from external internet
			internetFacing: true,
		})

		const listenerHttp1 = alb.addListener("listener-https", {
			protocol: elb.ApplicationProtocol.HTTPS,
			certificates: [elb.ListenerCertificate.fromArn(params.alb.certificate)]
		})

		listenerHttp1.addTargets("http-blue-target", {
			targetGroupName: "http-blue-target",
			protocol: elb.ApplicationProtocol.HTTP,
			deregistrationDelay: cdk.Duration.seconds(30),
			targets: [service],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: cdk.Duration.seconds(10)
			}
		})
		// httpアクセスがあった場合httpsに転送する
		alb.addListener("listenerRedirect", {
			protocol: elb.ApplicationProtocol.HTTP,
			defaultAction: elb.ListenerAction.redirect({
				port: "443",
				protocol: elb.ApplicationProtocol.HTTPS,
			})
		})

		const listenerHttp2 = alb.addListener("listener-http-2", {
			port: 8080,
		})
		listenerHttp2.addTargets("http-green-target", {
			targetGroupName: "http-green-target",
			port: 8080,
			deregistrationDelay: cdk.Duration.seconds(30),
			targets: [service],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: cdk.Duration.seconds(10)
			}
		})

		const certificate = acm.Certificate.fromCertificateArn(this, "virginiaCertificate", params.cloudfront.certificate)
		const distribution = new cloudfront.Distribution(this, "streamlit-distribution", {
			defaultBehavior: {
				origin: new origins.HttpOrigin(params.alb.route53DomainName),
				viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY
			},
			domainNames: params.cloudfront.domainNames,
			certificate: certificate
		})

		// Route 53 for alb
		const albHostedZone = route53.HostedZone.fromLookup(this, "alb-hosted-zone", {
			domainName: params.alb.route53DomainName
		})
		new route53.ARecord(this, "alb-a-record", {
			zone: albHostedZone,
			target: route53.RecordTarget.fromAlias(new target.LoadBalancerTarget(alb))
		})

		// Route 53 fro cloudfront
		const cloudfrontHostedZone = route53.HostedZone.fromLookup(this, "cloudfront-hosted-zone", {
			domainName: params.cloudfront.route53DomainName
		})
		new route53.ARecord(this, "cloudfront-a-record", {
			zone: cloudfrontHostedZone,
			target: route53.RecordTarget.fromAlias(new target.CloudFrontTarget(distribution))
		})
	}
}
