import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';


export class VpcRdsStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
		super(scope, id, props);

		const vpc = new ec2.Vpc(this, "vpc", {
			cidr: "10.0.0.0/16",
			maxAzs: 2,
			subnetConfiguration: [
				{
					subnetType: ec2.SubnetType.PUBLIC,
					name: "public",
					cidrMask: 24
				},
				{
					subnetType: ec2.SubnetType.PRIVATE,
					name: "application",
					cidrMask: 24
				},
				{
					subnetType: ec2.SubnetType.ISOLATED,
					name: "database",
					cidrMask: 28
				}
			]
		})

		new rds.ServerlessCluster(this, "serverless-cluster", {
			defaultDatabaseName: "cdk_example",
			enableDataApi: true,
			engine: rds.DatabaseClusterEngine.AURORA_MYSQL,
			vpc,
			scaling: {
				autoPause: cdk.Duration.hours(1),
				minCapacity: rds.AuroraCapacityUnit.ACU_1,
				maxCapacity: rds.AuroraCapacityUnit.ACU_1
			}
		})
	}
}
