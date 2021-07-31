import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from "@aws-cdk/aws-iam";
import * as rds from '@aws-cdk/aws-rds';

export interface IRdsEc2AccessStack {
	vpcCidr: string
}


export class RdsEc2AccessStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, params: IRdsEc2AccessStack, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = new ec2.Vpc(this, `ec2-vpc`, {
			cidr: params.vpcCidr,
			subnetConfiguration: [
				{
					name: "subnet-public",
					subnetType: ec2.SubnetType.PUBLIC,
					cidrMask: 28,
				},
				{
					name: "subnet-private",
					subnetType: ec2.SubnetType.PRIVATE,
					cidrMask: 28,
				}

			]
		})
		const securityGroup = new ec2.SecurityGroup(this, "security-group", {
			vpc: vpc,
			securityGroupName: `${id}-security-group`,
			allowAllOutbound: true,
		})
		const instanceRole = new iam.Role(this, "instance-role", {
			roleName: `${id}-instance-role`,
			assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromManagedPolicyArn(
					this, "AmazonEC2ContainerServiceforEC2Role", "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
				),
				/** Add managed policy to use SSM */
				iam.ManagedPolicy.fromManagedPolicyArn(
					this, "AmazonEC2RoleforSSM", "arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforSSM"
				)
			]
		})

		const instanceProfile = new iam.CfnInstanceProfile(this, "instance-profile", {
			instanceProfileName: `${id}-instance-profile`,
			roles: [instanceRole.roleName]
		})

		const ec2Instance = new ec2.Instance(this, "accessible-instance", {
			instanceType: new ec2.InstanceType("t3.nano"),
			vpc: vpc,
			machineImage: ec2.MachineImage.latestAmazonLinux(),
			role: instanceRole
		})

		/**
		 * > By default, the master password will be generated and stored in AWS Secrets Manager with auto-generated description.
		 */
		const dbInstance = new rds.DatabaseInstance(this, "postgresql", {
			engine: rds.DatabaseInstanceEngine.postgres({
				version: rds.PostgresEngineVersion.VER_10_4
			}),
			instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
			vpcSubnets: {
				subnetType: ec2.SubnetType.PRIVATE
			},
			databaseName: "cdkexample",
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			vpc
		})
		dbInstance.connections.allowFrom(ec2Instance, ec2.Port.tcp(5432));

	}
}


export class RdsEc2IamAccessStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, params: IRdsEc2AccessStack, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = new ec2.Vpc(this, `ec2-vpc`, {
			cidr: params.vpcCidr,
			subnetConfiguration: [
				{
					name: "subnet-public",
					subnetType: ec2.SubnetType.PUBLIC,
					cidrMask: 28,
				},
				{
					name: "subnet-private",
					subnetType: ec2.SubnetType.PRIVATE,
					cidrMask: 28,
				}

			]
		})
		const securityGroup = new ec2.SecurityGroup(this, "security-group", {
			vpc: vpc,
			securityGroupName: `${id}-security-group`,
			allowAllOutbound: true,
		})
		const instanceRole = new iam.Role(this, "instance-role", {
			roleName: `${id}-instance-role`,
			assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
		})
		instanceRole.addManagedPolicy(
			iam.ManagedPolicy.fromManagedPolicyArn(
				this, "AmazonEC2ContainerServiceforEC2Role", "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
			)
		)
		instanceRole.addManagedPolicy(
			iam.ManagedPolicy.fromManagedPolicyArn(
				this, "rds-access-role", "arn:aws:iam::aws:policy/AmazonRDSFullAccess"
			)
		)
		/** Add managed policy to use SSM */
		instanceRole.addManagedPolicy(
			iam.ManagedPolicy.fromManagedPolicyArn(
				this, "AmazonEC2RoleforSSM", "arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforSSM"
			)
		)
		const instanceProfile = new iam.CfnInstanceProfile(this, "instance-profile", {
			instanceProfileName: `${id}-instance-profile`,
			roles: [instanceRole.roleName]
		})

		const ec2Instance = new ec2.Instance(this, "accessible-instance", {
			instanceType: new ec2.InstanceType("t3.nano"),
			vpc: vpc,
			machineImage: ec2.MachineImage.latestAmazonLinux(),
			role: instanceRole
		})

		/**
		 * > By default, the master password will be generated and stored in AWS Secrets Manager with auto-generated description.
		 */
		const dbInstance = new rds.DatabaseInstance(this, "postgresql", {
			engine: rds.DatabaseInstanceEngine.postgres({
				version: rds.PostgresEngineVersion.VER_10_4
			}),
			instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
			vpcSubnets: {
				subnetType: ec2.SubnetType.PUBLIC
			},
			databaseName: "cdkexample",
			removalPolicy: cdk.RemovalPolicy.DESTROY,
			iamAuthentication: true,
			publiclyAccessible: true,
			vpc
		})
		dbInstance.connections.allowFrom(ec2Instance, ec2.Port.tcp(5432));

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
		const customPolicyDocument = iam.PolicyDocument.fromJson(policyDocument);
		const rdsAccessPolicy = new iam.ManagedPolicy(this, "access-rds-policy", {
			document: customPolicyDocument,
			managedPolicyName: "access-rds-policy"
		})

	}
}
