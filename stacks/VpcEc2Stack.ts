import * as cdk from "@aws-cdk/core";
import * as iam from "@aws-cdk/aws-iam";
import * as ec2 from '@aws-cdk/aws-ec2';


export interface IVpcEc2 {
	vpcCidr: string
}

export class VpcEc2Stack extends cdk.Stack {
	constructor(app: cdk.App, id: string, params: IVpcEc2, props?: cdk.StackProps) {
		super(app, id, props);

		const vpc = new ec2.Vpc(this, `ec2-vpc`, {
			cidr: params.vpcCidr,
			subnetConfiguration: [
				{
					name: `${id}-subnet-public`,
					subnetType: ec2.SubnetType.PUBLIC,
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
	}
}
