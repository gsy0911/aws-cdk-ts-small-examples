import * as cdk from "@aws-cdk/core";
import * as ec2 from '@aws-cdk/aws-ec2';
import {CfnVPCGatewayAttachment} from "@aws-cdk/aws-ec2";


export interface IBasicVpc {
	name: string
	environment: string
}


class Vpc {
	public vpc: ec2.CfnVPC;

	constructor(scope: cdk.Construct, environment: string) {
		this.vpc = new ec2.CfnVPC(scope, "vpc", {
			cidrBlock: "10.0.0.0/16",
			tags: [{key: "Name", value: `vpc-${environment}`}]
		})
	};
}


interface ISubnet {
	name: string
	environment: string
	cidrBlock: string
	availabilityZone: string
}

class Subnet {
	public subnet: ec2.CfnSubnet;
	private readonly vpc: ec2.CfnVPC;

	constructor(scope: cdk.Construct, vpc: ec2.CfnVPC, props: ISubnet) {
		this.vpc = vpc
		const id = `${props.name}-${props.availabilityZone}-${props.environment}`
		this.subnet = new ec2.CfnSubnet(scope, id, {
			cidrBlock: props.cidrBlock,
			vpcId: this.vpc.ref,
			availabilityZone: props.availabilityZone,
			tags: [{key: "Name", value: id}]
		})
	}
}

class InternetGateway {
	public igw: ec2.CfnInternetGateway;
	private readonly vpc: ec2.CfnVPC;

	constructor(scope: cdk.Construct, vpc: ec2.CfnVPC) {
		this.vpc = vpc
		this.igw = new ec2.CfnInternetGateway(scope, "internet-gateway", {
			tags: [{key: "Name", value: "internetGateway"}]
		})

		new CfnVPCGatewayAttachment(scope, "vpc-gateway-attachment", {
			vpcId: this.vpc.ref,
			internetGatewayId: this.igw.ref
		})
	}
}

export class VpcStack extends cdk.Stack {
	constructor(app: cdk.App, id: string, params: IBasicVpc, props?: cdk.StackProps) {
		super(app, id, props);

		const vpc = new Vpc(this, params.environment)

		const public1a = new Subnet(this, vpc.vpc, {
			name: "public1a",
			environment: params.environment,
			availabilityZone: "ap-northeast-1a",
			cidrBlock: "10.0.11.0/24"
		})

		const public1c = new Subnet(this, vpc.vpc, {
			name: "public1c",
			environment: params.environment,
			availabilityZone: "ap-northeast-1c",
			cidrBlock: "10.0.12.0/24"
		})

		const app1a = new Subnet(this, vpc.vpc, {
			name: "app1a",
			environment: params.environment,
			availabilityZone: "ap-northeast-1a",
			cidrBlock: "10.0.21.0/24"
		})

		const app1c = new Subnet(this, vpc.vpc, {
			name: "app1c",
			environment: params.environment,
			availabilityZone: "ap-northeast-1c",
			cidrBlock: "10.0.22.0/24"
		})

		const db1a = new Subnet(this, vpc.vpc, {
			name: "db1a",
			environment: params.environment,
			availabilityZone: "ap-northeast-1a",
			cidrBlock: "10.0.31.0/24"
		})

		const db1c = new Subnet(this, vpc.vpc, {
			name: "db1c",
			environment: params.environment,
			availabilityZone: "ap-northeast-1c",
			cidrBlock: "10.0.32.0/24"
		})

		const igw = new InternetGateway(this, vpc.vpc)

	}
}
