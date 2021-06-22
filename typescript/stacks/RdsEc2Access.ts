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
		const securityGroup = new ec2.SecurityGroup(this, `${id}-security-group`, {
			vpc: vpc,
			securityGroupName: `${id}-security-group`,
			allowAllOutbound: true,
		})
		const instanceRole = new iam.Role(this, `${id}-instance-role`, {
			roleName: `${id}-instance-role`,
			assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
		})
		instanceRole.addManagedPolicy(
			iam.ManagedPolicy.fromManagedPolicyArn(
				this, `AmazonEC2ContainerServiceforEC2Role-${id}`, "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
			)
		)
		/** Add managed policy to use SSM */
		instanceRole.addManagedPolicy(
			iam.ManagedPolicy.fromManagedPolicyArn(
				this, `AmazonEC2RoleforSSM-${id}`, "arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforSSM"
			)
		)
		const instanceProfile = new iam.CfnInstanceProfile(this, `${id}-instance-profile`, {
			instanceProfileName: `${id}-instance-profile`,
			roles: [instanceRole.roleName]
		})

		const ec2Instance = new ec2.Instance(this, "example-instance", {
			instanceType: new ec2.InstanceType("t3.nano"),
			vpc: vpc,
			machineImage: ec2.MachineImage.latestAmazonLinux(),
			initOptions: {
				configSets: ["default"],
				timeout: cdk.Duration.minutes(30)
			},
			init: ec2.CloudFormationInit.fromConfigSets({
				configSets: {
					default: ["aptInstall", "configuration"]
				},
				configs: {
					aptInstall: new ec2.InitConfig([
						ec2.InitPackage.yum("jq")
					]),
					configuration: new ec2.InitConfig([
						ec2.InitCommand.shellCommand('mkdir -p /opt/local/bin')
					])
				}
			}),
			role: instanceRole
		})

		/**
		 * > By default, the master password will be generated and stored in AWS Secrets Manager with auto-generated description.
		 */
		const dbCluster = new rds.DatabaseCluster(this, "postgresql", {
			engine: rds.DatabaseClusterEngine.auroraPostgres({version: rds.AuroraPostgresEngineVersion.VER_10_14}),
			instanceProps: {
				instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.SMALL),
				vpcSubnets: {
					subnetType: ec2.SubnetType.PRIVATE
				},
				vpc
			},
			defaultDatabaseName: "cdkexample"
		})

	}
}
