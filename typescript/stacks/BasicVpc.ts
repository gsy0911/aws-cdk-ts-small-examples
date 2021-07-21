import * as cdk from "@aws-cdk/core";
import * as ec2 from '@aws-cdk/aws-ec2';
import {CfnEIP, CfnNatGateway, CfnSubnet, CfnVPCGatewayAttachment} from "@aws-cdk/aws-ec2";


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

interface IElasticIp {
	name: string
	availabilityZone: string
	environment: string
}

class ElasticIp {
	public eip: ec2.CfnEIP;

	constructor(scope: cdk.Construct, props: IElasticIp) {
		this.eip = new ec2.CfnEIP(scope, `eip-${props.name}-${props.availabilityZone}-${props.environment}`, {
			domain: "vpc",
			tags: [{key: "Name", value: `${props.name}-${props.availabilityZone}-${props.environment}`}]
		})

	}
}

interface INatGateway {
	name: string
	availabilityZone: string
	environment: string
}

class NatGateway {
	public ngw: ec2.CfnNatGateway;

	private readonly publicSubnet: ec2.CfnSubnet;
	private readonly eip: ec2.CfnEIP;

	constructor(scope: cdk.Construct, publicSubnet: ec2.CfnSubnet, eip: ec2.CfnEIP, props: INatGateway) {
		this.publicSubnet = publicSubnet
		this.eip = eip

		this.ngw = new ec2.CfnNatGateway(scope, `ngw-${props.name}-${props.availabilityZone}-${props.environment}`, {
			allocationId: this.eip.attrAllocationId,
			subnetId: this.publicSubnet.ref,
			tags: [{key: "Name", value: `ngw-${props.name}-${props.availabilityZone}-${props.environment}`}]
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

		const eip1a = new ElasticIp(this, {
			availabilityZone: "ap-northeast-1a", name: "eip1a", environment: params.environment
		})
		const eip1c = new ElasticIp(this, {
			availabilityZone: "ap-northeast-1c", name: "eip1c", environment: params.environment
		})

		const ngw1a = new NatGateway(this, public1a.subnet, eip1a.eip, {
			availabilityZone: "ap-northeast-1a", name: "ngw1a", environment: params.environment
		})

		const ngw1c = new NatGateway(this, public1c.subnet, eip1c.eip, {
			availabilityZone: "ap-northeast-1c", name: "ngw1c", environment: params.environment
		})

		// public route table
		const publicRouteTable = new ec2.CfnRouteTable(this, "rtb-public", {
			vpcId: vpc.vpc.ref,
			tags: [{key: "Name", value: "rtb-public"}]
		})
		new ec2.CfnRoute(this, "public-route", {
			routeTableId: publicRouteTable.ref,
			destinationCidrBlock: "0.0.0.0/0",
			gatewayId: igw.igw.ref
		})
		new ec2.CfnSubnetRouteTableAssociation(this, "public-subnet1a", {
			routeTableId: publicRouteTable.ref,
			subnetId: public1a.subnet.ref
		})
		new ec2.CfnSubnetRouteTableAssociation(this, "public-subnet1c", {
			routeTableId: publicRouteTable.ref,
			subnetId: public1c.subnet.ref
		})

		// app1a route table
		const rtbApp1a = new ec2.CfnRouteTable(this, "rtb-app-1a", {
			vpcId: vpc.vpc.ref,
			tags: [{key: "Name", value: "rtb-app-1a"}]
		})
		new ec2.CfnRoute(this, "app-1a-route", {
			routeTableId: rtbApp1a.ref,
			destinationCidrBlock: "0.0.0.0/0",
			natGatewayId: ngw1a.ngw.ref
		})
		new ec2.CfnSubnetRouteTableAssociation(this, "app-1a-subnet1a", {
			routeTableId: rtbApp1a.ref,
			subnetId: app1a.subnet.ref
		})

		// app1a route table
		const rtbApp1c = new ec2.CfnRouteTable(this, "rtb-app-1c", {
			vpcId: vpc.vpc.ref,
			tags: [{key: "Name", value: "rtb-app-1c"}]
		})
		new ec2.CfnRoute(this, "app-1c-route", {
			routeTableId: rtbApp1c.ref,
			destinationCidrBlock: "0.0.0.0/0",
			natGatewayId: ngw1c.ngw.ref
		})
		new ec2.CfnSubnetRouteTableAssociation(this, "app-1c-subnet1a", {
			routeTableId: rtbApp1c.ref,
			subnetId: app1c.subnet.ref
		})

		// db route table
		const rtbDb = new ec2.CfnRouteTable(this, "rtb-db", {
			vpcId: vpc.vpc.ref,
			tags: [{key: "Name", value: "rtb-db"}]
		})
		new ec2.CfnSubnetRouteTableAssociation(this, "db-db-1a", {
			routeTableId: rtbDb.ref,
			subnetId: db1a.subnet.ref
		})
		new ec2.CfnSubnetRouteTableAssociation(this, "db-db-1c", {
			routeTableId: rtbDb.ref,
			subnetId: db1c.subnet.ref
		})
	}
}
