import {
	Duration,
	Stack,
	StackProps,
	aws_ec2,
	aws_ecs,
	aws_ecs_patterns,
	aws_iam,
	aws_elasticloadbalancingv2 as aws_elbv2,
	aws_elasticloadbalancingv2_actions as elbv2_actions,
	aws_cloudfront,
	aws_cloudfront_origins,
	aws_certificatemanager as aws_acm,
	aws_route53,
	aws_route53_targets,
	aws_cognito,
	RemovalPolicy
} from 'aws-cdk-lib';
import { Construct } from 'constructs';


export interface IStreamlitEcsFargate {
	vpcId: string
	env: {
		account: string
		region: string
	}
}


export interface IStreamlitEcsFargateCognito {
	vpcId: string
	env: {
		account: string
		region: string
	},
	alb: {
		route53DomainName: string
		certificate: string
	}
	cognito: {
		callbackUrls: string[]
		logoutUrls: string[]
		domainPrefix: string
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
}


export class StreamlitEcsFargateStack extends Stack {
	constructor(scope: Construct, id: string, params: IStreamlitEcsFargate, props?: StackProps) {
		super(scope, id, props);

		const vpc = aws_ec2.Vpc.fromLookup(this, `existing-vpc`, {
			vpcId: params.vpcId
		})
		const cluster = new aws_ecs.Cluster(this, 'StreamlitCluster', {
			vpc: vpc,
			clusterName: "streamlit-cluster"
		});

		const taskRole = new aws_iam.Role(this, 'taskRole', {
			assumedBy: new aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			managedPolicies: [
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, "ecsFullAccess", "arn:aws:iam::aws:policy/AmazonECS_FullAccess")
			]
		})
		const taskDef = new aws_ecs.FargateTaskDefinition(this, "StreamlitTask", {
			memoryLimitMiB: 512,
			cpu: 256,
			taskRole: taskRole,
			family: "streamlit-task"
		})

		taskDef.addContainer("StreamlitContainer", {
			image: aws_ecs.ContainerImage.fromAsset("../../stacks/docker/streamlit"),
			portMappings: [
				{
					containerPort: 80,
					hostPort: 80
				}
			],
			command: ["streamlit", "run", "app.py"]
		})

		// Instantiate Fargate Service with just cluster and image
		new aws_ecs_patterns.ApplicationLoadBalancedFargateService(this, "StreamlitService", {
			cluster: cluster,
			assignPublicIp: true,
			taskDefinition: taskDef,
			healthCheckGracePeriod: Duration.seconds(5),
		});

	}
}


export class StreamlitEcsFargateCognitoStack extends Stack {
	constructor(scope: Construct, id: string, params: IStreamlitEcsFargateCognito, props?: StackProps) {
		super(scope, id, props);

		const userPool = new aws_cognito.UserPool(this, "userPool", {
			userPoolName: "streamlit-user-pool-test",
			// signUp
			// By default, self sign up is disabled. Otherwise use userInvitation
			selfSignUpEnabled: true,
			userVerification: {
				emailSubject: "Verify email message",
				emailBody: "Thanks for signing up! Your verification code is {####}",
				emailStyle: aws_cognito.VerificationEmailStyle.CODE,
				smsMessage: "Thanks for signing up! Your verification code is {####}"
			},
			// sign in
			signInAliases: {
				username: true,
				email: true
			},
			// user attributes
			standardAttributes: {
				// email: {
				//     required: true
				// },
				nickname: {
					required: true,
					// `mutable` means changeable
					mutable: true
				}
			},
			// role, specify if you want
			// ...
			mfa: aws_cognito.Mfa.OPTIONAL,
			mfaSecondFactor: {
				sms: true,
				otp: true
			},
			passwordPolicy: {
				minLength: 8,
				requireLowercase: true,
				requireUppercase: true,
				requireDigits: true,
				requireSymbols: true,
				tempPasswordValidity: Duration.days(3)
			},
			accountRecovery: aws_cognito.AccountRecovery.EMAIL_ONLY,
			removalPolicy: RemovalPolicy.DESTROY
			// emails, by default `no-reply@verificationemail.com` used
		})

		// only available domain
		const userPoolDomain = userPool.addDomain("cognito-domain", {
			// customDomain: {
			// 	domainName: params.cognito.domainName,
			// 	certificate: acm.Certificate.fromCertificateArn(this, "virginiaCertificate", params.cognito.certificate)
			// }
			cognitoDomain: {
				domainPrefix: params.cognito.domainPrefix
			}
		})

		// App Clients
		const app1 = userPool.addClient("appClient1", {
			userPoolClientName: "appClient1",
			generateSecret: true,
			authFlows: {
				userPassword: true,
				userSrp: true
			},
			oAuth: {
				callbackUrls: params.cognito.callbackUrls,
				logoutUrls: params.cognito.logoutUrls
			}
		})

		const vpc = aws_ec2.Vpc.fromLookup(this, "existing-vpc", {
			vpcId: params.vpcId
		})
		const cluster = new aws_ecs.Cluster(this, 'FargateCluster', {
			vpc: vpc,
			clusterName: "streamlit-cluster",
		});

		// create a task definition with CloudWatch Logs
		const logging = new aws_ecs.AwsLogDriver({
			streamPrefix: "myapp",
		})

		const taskRole = new aws_iam.Role(this, 'taskRole', {
			assumedBy: new aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			managedPolicies: [
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, "ecsFullAccess", "arn:aws:iam::aws:policy/AmazonECS_FullAccess")
			]
		})
		const taskDef = new aws_ecs.FargateTaskDefinition(this, "MyTaskDefinition", {
			memoryLimitMiB: 512,
			cpu: 256,
			taskRole: taskRole,
		})

		taskDef.addContainer("StreamlitContainer", {
			image: aws_ecs.ContainerImage.fromAsset("../../stacks/docker/streamlit"),
			portMappings: [
				{
					containerPort: 80,
					hostPort: 80
				}
			],
			command: ["streamlit", "run", "app.py"],
			logging
		})

		const ecsServiceSecurityGroup = new aws_ec2.SecurityGroup(this, "ecs-service-sg", {
			vpc,
			securityGroupName: "streamlit-service-sg",
			description: "security group to allow IdP",
		})

		const service = new aws_ecs.FargateService(this, "StreamlitService", {
			cluster: cluster,
			taskDefinition: taskDef,
			deploymentController: {
				type: aws_ecs.DeploymentControllerType.CODE_DEPLOY
			},
			healthCheckGracePeriod: Duration.seconds(5),
			assignPublicIp: true,
			securityGroups: [ecsServiceSecurityGroup]
		})

		// https://<alb-domain>/oauth2/idpresponse
		// requires allowing HTTPS egress-rule
		const albSecurityGroup = new aws_ec2.SecurityGroup(this, "alb-sg", {
			vpc,
			securityGroupName: "streamlit-alb-sg",
			description: "security group to allow IdP",
			allowAllOutbound: false
		})
		albSecurityGroup.addIngressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(80), "allow HTTP")
		albSecurityGroup.addIngressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(8080), "allow alt HTTP")
		albSecurityGroup.addIngressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(443), "allow HTTPS")
		albSecurityGroup.addEgressRule(ecsServiceSecurityGroup, aws_ec2.Port.tcp(80), "allow HTTP")
		albSecurityGroup.addEgressRule(aws_ec2.Peer.anyIpv4(), aws_ec2.Port.tcp(443), "allow HTTPS")
		ecsServiceSecurityGroup.addIngressRule(albSecurityGroup, aws_ec2.Port.tcp(80), "allow from alb-HTTP")

		const alb = new aws_elbv2.ApplicationLoadBalancer(this, "ApplicationLoadBalancer", {
			loadBalancerName: "StreamlitALB",
			vpc: vpc,
			idleTimeout: Duration.seconds(30),
			// scheme: true to access from external internet
			internetFacing: true,
			securityGroup: albSecurityGroup
		})

		const listenerHttp1 = alb.addListener("listener-https", {
			protocol: aws_elbv2.ApplicationProtocol.HTTPS,
			certificates: [aws_elbv2.ListenerCertificate.fromArn(params.alb.certificate)]
		})

		const targetGroupBlue = listenerHttp1.addTargets("http-blue-target", {
			targetGroupName: "http-blue-target",
			protocol: aws_elbv2.ApplicationProtocol.HTTP,
			deregistrationDelay: Duration.seconds(30),
			targets: [service],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: Duration.seconds(10)
			},
		})
		listenerHttp1.addAction("cognito-auth-elb-1", {
			action: new elbv2_actions.AuthenticateCognitoAction({
				userPool: userPool,
				userPoolClient: app1,
				userPoolDomain: userPoolDomain,
				scope: "openid",
				onUnauthenticatedRequest: aws_elbv2.UnauthenticatedAction.AUTHENTICATE,
				next: aws_elbv2.ListenerAction.forward([targetGroupBlue])
			}),
			conditions: [aws_elbv2.ListenerCondition.pathPatterns(["*"])],
			priority: 1
		})
		// redirect to https
		alb.addListener("listenerRedirect", {
			protocol: aws_elbv2.ApplicationProtocol.HTTP,
			defaultAction: aws_elbv2.ListenerAction.redirect({
				port: "443",
				protocol: aws_elbv2.ApplicationProtocol.HTTPS,
			})
		})

		const listenerHttp2 = alb.addListener("listener-http-2", {
			port: 8080,
		})
		listenerHttp2.addTargets("http-green-target", {
			targetGroupName: "http-green-target",
			port: 8080,
			deregistrationDelay: Duration.seconds(30),
			targets: [service],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: Duration.seconds(10)
			}
		})

		// Route 53 for alb
		const albHostedZone = aws_route53.HostedZone.fromLookup(this, "alb-hosted-zone", {
			domainName: params.alb.route53DomainName
		})
		new aws_route53.ARecord(this, "alb-a-record", {
			zone: albHostedZone,
			target: aws_route53.RecordTarget.fromAlias(new aws_route53_targets.LoadBalancerTarget(alb))
		})
	}
}


export class StreamlitEcsFargateHttpsOnlyCloudFrontStack extends Stack {
	constructor(scope: Construct, id: string, params: IStreamlitEcsFargateHttpsOnlyCloudFront, props?: StackProps) {
		super(scope, id, props);

		const vpc = aws_ec2.Vpc.fromLookup(this, "existing-vpc", {
			vpcId: params.vpcId
		})
		const cluster = new aws_ecs.Cluster(this, 'FargateCluster', {
			vpc: vpc,
			clusterName: "streamlit-cluster",
		});

		// create a task definition with CloudWatch Logs
		const logging = new aws_ecs.AwsLogDriver({
			streamPrefix: "myapp",
		})

		const taskRole = new aws_iam.Role(this, 'taskRole', {
			assumedBy: new aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
			managedPolicies: [
				aws_iam.ManagedPolicy.fromManagedPolicyArn(this, "ecsFullAccess", "arn:aws:iam::aws:policy/AmazonECS_FullAccess")
			]
		})
		const taskDef = new aws_ecs.FargateTaskDefinition(this, "MyTaskDefinition", {
			memoryLimitMiB: 512,
			cpu: 256,
			taskRole: taskRole,
		})

		taskDef.addContainer("StreamlitContainer", {
			image: aws_ecs.ContainerImage.fromAsset("../../stacks/docker/streamlit"),
			portMappings: [
				{
					containerPort: 80,
					hostPort: 80
				}
			],
			command: ["streamlit", "run", "app.py"]
		})

		const service = new aws_ecs.FargateService(this, "StreamlitService", {
			cluster: cluster,
			taskDefinition: taskDef,
			deploymentController: {
				type: aws_ecs.DeploymentControllerType.CODE_DEPLOY
			},
			healthCheckGracePeriod: Duration.seconds(5),
			assignPublicIp: true,
		})

		const alb = new aws_elbv2.ApplicationLoadBalancer(this, "ApplicationLoadBalancer", {
			loadBalancerName: "StreamlitALB",
			vpc: vpc,
			idleTimeout: Duration.seconds(30),
			// scheme: true to access from external internet
			internetFacing: true,
		})

		const listenerHttp1 = alb.addListener("listener-https", {
			protocol: aws_elbv2.ApplicationProtocol.HTTPS,
			certificates: [aws_elbv2.ListenerCertificate.fromArn(params.alb.certificate)]
		})

		listenerHttp1.addTargets("http-blue-target", {
			targetGroupName: "http-blue-target",
			protocol: aws_elbv2.ApplicationProtocol.HTTP,
			deregistrationDelay: Duration.seconds(30),
			targets: [service],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: Duration.seconds(10)
			}
		})
		// redirect to https
		alb.addListener("listenerRedirect", {
			protocol: aws_elbv2.ApplicationProtocol.HTTP,
			defaultAction: aws_elbv2.ListenerAction.redirect({
				port: "443",
				protocol: aws_elbv2.ApplicationProtocol.HTTPS,
			})
		})

		const listenerHttp2 = alb.addListener("listener-http-2", {
			port: 8080,
		})
		listenerHttp2.addTargets("http-green-target", {
			targetGroupName: "http-green-target",
			port: 8080,
			deregistrationDelay: Duration.seconds(30),
			targets: [service],
			healthCheck: {
				healthyThresholdCount: 2,
				interval: Duration.seconds(10)
			}
		})

		const certificate = aws_acm.Certificate.fromCertificateArn(this, "virginiaCertificate", params.cloudfront.certificate)
		const distribution = new aws_cloudfront.Distribution(this, "streamlit-distribution", {
			defaultBehavior: {
				origin: new aws_cloudfront_origins.HttpOrigin(params.alb.route53DomainName),
				viewerProtocolPolicy: aws_cloudfront.ViewerProtocolPolicy.HTTPS_ONLY
			},
			domainNames: params.cloudfront.domainNames,
			certificate: certificate
		})

		// Route 53 for alb
		const albHostedZone = aws_route53.HostedZone.fromLookup(this, "alb-hosted-zone", {
			domainName: params.alb.route53DomainName
		})
		new aws_route53.ARecord(this, "alb-a-record", {
			zone: albHostedZone,
			target: aws_route53.RecordTarget.fromAlias(new aws_route53_targets.LoadBalancerTarget(alb))
		})

		// Route 53 fro cloudfront
		const cloudfrontHostedZone = aws_route53.HostedZone.fromLookup(this, "cloudfront-hosted-zone", {
			domainName: params.cloudfront.route53DomainName
		})
		new aws_route53.ARecord(this, "cloudfront-a-record", {
			zone: cloudfrontHostedZone,
			target: aws_route53.RecordTarget.fromAlias(new aws_route53_targets.CloudFrontTarget(distribution))
		})
	}
}
