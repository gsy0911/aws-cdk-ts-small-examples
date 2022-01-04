import {
	Duration,
	Stack,
	StackProps,
	RemovalPolicy,
	aws_ec2,
	aws_rds,
	aws_iam,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';


export class VpcRdsStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		const vpc = new aws_ec2.Vpc(this, "vpc", {
			cidr: "10.0.0.0/16",
			maxAzs: 2,
			subnetConfiguration: [
				{
					subnetType: aws_ec2.SubnetType.PUBLIC,
					name: "public",
					cidrMask: 24
				},
				{
					subnetType: aws_ec2.SubnetType.PRIVATE,
					name: "application",
					cidrMask: 24
				},
				{
					subnetType: aws_ec2.SubnetType.ISOLATED,
					name: "database",
					cidrMask: 28
				}
			]
		})

		new aws_rds.ServerlessCluster(this, "serverless-cluster", {
			defaultDatabaseName: "cdk_example",
			enableDataApi: true,
			engine: aws_rds.DatabaseClusterEngine.AURORA_MYSQL,
			vpc,
			scaling: {
				autoPause: Duration.hours(1),
				minCapacity: aws_rds.AuroraCapacityUnit.ACU_1,
				maxCapacity: aws_rds.AuroraCapacityUnit.ACU_1
			}
		})
	}
}


export class RdsEc2AccessStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		const vpc = new aws_ec2.Vpc(this, `ec2-vpc`, {
			cidr: "10.0.0.0/16",
			subnetConfiguration: [
				{
					name: "subnet-public",
					subnetType: aws_ec2.SubnetType.PUBLIC,
					cidrMask: 28,
				},
				{
					name: "subnet-private",
					subnetType: aws_ec2.SubnetType.PRIVATE,
					cidrMask: 28,
				}

			]
		})
		const securityGroup = new aws_ec2.SecurityGroup(this, "security-group", {
			vpc: vpc,
			securityGroupName: `${id}-security-group`,
			allowAllOutbound: true,
		})
		const instanceRole = new aws_iam.Role(this, "instance-role", {
			roleName: `${id}-instance-role`,
			assumedBy: new aws_iam.ServicePrincipal('ec2.amazonaws.com'),
			managedPolicies: [
				aws_iam.ManagedPolicy.fromManagedPolicyArn(
					this, "AmazonEC2ContainerServiceforEC2Role", "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
				),
				/** Add managed policy to use SSM */
				aws_iam.ManagedPolicy.fromManagedPolicyArn(
					this, "AmazonEC2RoleforSSM", "arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforSSM"
				)
			]
		})

		const instanceProfile = new aws_iam.CfnInstanceProfile(this, "instance-profile", {
			instanceProfileName: `${id}-instance-profile`,
			roles: [instanceRole.roleName]
		})

		const ec2Instance = new aws_ec2.Instance(this, "accessible-instance", {
			instanceType: new aws_ec2.InstanceType("t3.nano"),
			vpc: vpc,
			machineImage: aws_ec2.MachineImage.latestAmazonLinux(),
			role: instanceRole
		})

		/**
		 * > By default, the master password will be generated and stored in AWS Secrets Manager with auto-generated description.
		 */
		const dbInstance = new aws_rds.DatabaseInstance(this, "postgresql", {
			engine: aws_rds.DatabaseInstanceEngine.postgres({
				version: aws_rds.PostgresEngineVersion.VER_10_4
			}),
			instanceType: aws_ec2.InstanceType.of(aws_ec2.InstanceClass.BURSTABLE2, aws_ec2.InstanceSize.MICRO),
			vpcSubnets: {
				subnetType: aws_ec2.SubnetType.PRIVATE
			},
			databaseName: "cdkexample",
			removalPolicy: RemovalPolicy.DESTROY,
			vpc
		})
		dbInstance.connections.allowFrom(ec2Instance, aws_ec2.Port.tcp(5432));

	}
}


export class RdsEc2IamAccessStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		const vpc = new aws_ec2.Vpc(this, `ec2-vpc`, {
			cidr: "10.0.0.0/16",
			subnetConfiguration: [
				{
					name: "subnet-public",
					subnetType: aws_ec2.SubnetType.PUBLIC,
					cidrMask: 28,
				},
				{
					name: "subnet-private",
					subnetType: aws_ec2.SubnetType.PRIVATE,
					cidrMask: 28,
				}

			]
		})
		const securityGroup = new aws_ec2.SecurityGroup(this, "security-group", {
			vpc: vpc,
			securityGroupName: `${id}-security-group`,
			allowAllOutbound: true,
		})
		const instanceRole = new aws_iam.Role(this, "instance-role", {
			roleName: `${id}-instance-role`,
			assumedBy: new aws_iam.ServicePrincipal('ec2.amazonaws.com')
		})
		instanceRole.addManagedPolicy(
			aws_iam.ManagedPolicy.fromManagedPolicyArn(
				this, "AmazonEC2ContainerServiceforEC2Role", "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
			)
		)
		instanceRole.addManagedPolicy(
			aws_iam.ManagedPolicy.fromManagedPolicyArn(
				this, "rds-access-role", "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
			)
		)
		/** Add managed policy to use SSM */
		instanceRole.addManagedPolicy(
			aws_iam.ManagedPolicy.fromManagedPolicyArn(
				this, "AmazonEC2RoleforSSM", "arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforSSM"
			)
		)
		const instanceProfile = new aws_iam.CfnInstanceProfile(this, "instance-profile", {
			instanceProfileName: `${id}-instance-profile`,
			roles: [instanceRole.roleName]
		})

		const ec2Instance = new aws_ec2.Instance(this, "accessible-instance", {
			instanceType: new aws_ec2.InstanceType("t3.nano"),
			vpc: vpc,
			machineImage: aws_ec2.MachineImage.latestAmazonLinux(),
			role: instanceRole
		})

		/**
		 * > By default, the master password will be generated and stored in AWS Secrets Manager with auto-generated description.
		 */
		const dbInstance = new aws_rds.DatabaseInstance(this, "postgresql", {
			engine: aws_rds.DatabaseInstanceEngine.postgres({
				version: aws_rds.PostgresEngineVersion.VER_10_4
			}),
			instanceType: aws_ec2.InstanceType.of(aws_ec2.InstanceClass.BURSTABLE2, aws_ec2.InstanceSize.MICRO),
			vpcSubnets: {
				subnetType: aws_ec2.SubnetType.PUBLIC
			},
			databaseName: "cdkexample",
			removalPolicy: RemovalPolicy.DESTROY,
			iamAuthentication: true,
			publiclyAccessible: true,
			vpc
		})
		dbInstance.connections.allowFrom(ec2Instance, aws_ec2.Port.tcp(5432));

		const policyDocument = {
			"Version": "2012-10-17",
			"Statement": [
				{
					"Effect": "Allow",
					"Action": [
						"rds-db:connect"
					],
					"Resource": [
						`arn:aws:rds-db:ap-northeast-1:*:dbuser:${dbInstance.instanceIdentifier}/db_user`
					]
				}
			]

		}
		const customPolicyDocument = aws_iam.PolicyDocument.fromJson(policyDocument);
		const rdsAccessPolicy = new aws_iam.ManagedPolicy(this, "access-rds-policy", {
			document: customPolicyDocument,
			managedPolicyName: "access-rds-policy"
		})

	}
}
