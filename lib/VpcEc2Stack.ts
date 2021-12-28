import {
	Duration,
	Stack,
	StackProps,
	aws_ec2,
	aws_iam,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';


export class VpcEc2Stack extends Stack {
	constructor(app: Construct, id: string, props?: StackProps) {
		super(app, id, props);

		const vpc = new aws_ec2.Vpc(this, `ec2-vpc`, {
			cidr: "10.0.0.0/24",
			subnetConfiguration: [
				{
					name: `${id}-subnet-public`,
					subnetType: aws_ec2.SubnetType.PUBLIC,
					cidrMask: 28,
				}
			]
		})
		const securityGroup = new aws_ec2.SecurityGroup(this, `${id}-security-group`, {
			vpc: vpc,
			securityGroupName: `${id}-security-group`,
			allowAllOutbound: true,
		})
		const instanceRole = new aws_iam.Role(this, `${id}-instance-role`, {
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
		const instanceProfile = new aws_iam.CfnInstanceProfile(this, `${id}-instance-profile`, {
			instanceProfileName: `${id}-instance-profile`,
			roles: [instanceRole.roleName]
		})

		const ec2Instance = new aws_ec2.Instance(this, "example-instance", {
			instanceType: new aws_ec2.InstanceType("t3.nano"),
			vpc: vpc,
			machineImage: aws_ec2.MachineImage.latestAmazonLinux(),
			initOptions: {
				configSets: ["default"],
				timeout: Duration.minutes(30)
			},
			init: aws_ec2.CloudFormationInit.fromConfigSets({
				configSets: {
					default: ["aptInstall", "configuration"]
				},
				configs: {
					aptInstall: new aws_ec2.InitConfig([
						aws_ec2.InitPackage.yum("jq")
					]),
					configuration: new aws_ec2.InitConfig([
						aws_ec2.InitCommand.shellCommand('mkdir -p /opt/local/bin')
					])
				}
			}),
			role: instanceRole
		})
	}
}
