import {
	Stack,
	StackProps,
	aws_ec2,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';


export interface IBasicVpc {
	name: string
	environment: string
}


class Vpc {
	public vpc: aws_ec2.CfnVPC;

	constructor(scope: Construct, environment: string) {
		this.vpc = new aws_ec2.CfnVPC(scope, "vpc", {
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
	public subnet: aws_ec2.CfnSubnet;
	private readonly vpc: aws_ec2.CfnVPC;

	constructor(scope: Construct, vpc: aws_ec2.CfnVPC, props: ISubnet) {
		this.vpc = vpc
		const id = `${props.name}-${props.availabilityZone}-${props.environment}`
		this.subnet = new aws_ec2.CfnSubnet(scope, id, {
			cidrBlock: props.cidrBlock,
			vpcId: this.vpc.ref,
			availabilityZone: props.availabilityZone,
			tags: [{key: "Name", value: id}]
		})
	}
}

class InternetGateway {
	public igw: aws_ec2.CfnInternetGateway;
	private readonly vpc: aws_ec2.CfnVPC;

	constructor(scope: Construct, vpc: aws_ec2.CfnVPC) {
		this.vpc = vpc
		this.igw = new aws_ec2.CfnInternetGateway(scope, "internet-gateway", {
			tags: [{key: "Name", value: "internetGateway"}]
		})

		new aws_ec2.CfnVPCGatewayAttachment(scope, "vpc-gateway-attachment", {
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
	public eip: aws_ec2.CfnEIP;

	constructor(scope: Construct, props: IElasticIp) {
		this.eip = new aws_ec2.CfnEIP(scope, `eip-${props.name}-${props.availabilityZone}-${props.environment}`, {
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
	public ngw: aws_ec2.CfnNatGateway;

	private readonly publicSubnet: aws_ec2.CfnSubnet;
	private readonly eip: aws_ec2.CfnEIP;

	constructor(scope: Construct, publicSubnet: aws_ec2.CfnSubnet, eip: aws_ec2.CfnEIP, props: INatGateway) {
		this.publicSubnet = publicSubnet
		this.eip = eip

		this.ngw = new aws_ec2.CfnNatGateway(scope, `ngw-${props.name}-${props.availabilityZone}-${props.environment}`, {
			allocationId: this.eip.attrAllocationId,
			subnetId: this.publicSubnet.ref,
			tags: [{key: "Name", value: `ngw-${props.name}-${props.availabilityZone}-${props.environment}`}]
		})
	}
}


export class VpcStack extends Stack {
	constructor(app: Construct, id: string, params: IBasicVpc, props?: StackProps) {
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
		const publicRouteTable = new aws_ec2.CfnRouteTable(this, "rtb-public", {
			vpcId: vpc.vpc.ref,
			tags: [{key: "Name", value: "rtb-public"}]
		})
		new aws_ec2.CfnRoute(this, "public-route", {
			routeTableId: publicRouteTable.ref,
			destinationCidrBlock: "0.0.0.0/0",
			gatewayId: igw.igw.ref
		})
		new aws_ec2.CfnSubnetRouteTableAssociation(this, "public-subnet1a", {
			routeTableId: publicRouteTable.ref,
			subnetId: public1a.subnet.ref
		})
		new aws_ec2.CfnSubnetRouteTableAssociation(this, "public-subnet1c", {
			routeTableId: publicRouteTable.ref,
			subnetId: public1c.subnet.ref
		})

		// app1a route table
		const rtbApp1a = new aws_ec2.CfnRouteTable(this, "rtb-app-1a", {
			vpcId: vpc.vpc.ref,
			tags: [{key: "Name", value: "rtb-app-1a"}]
		})
		new aws_ec2.CfnRoute(this, "app-1a-route", {
			routeTableId: rtbApp1a.ref,
			destinationCidrBlock: "0.0.0.0/0",
			natGatewayId: ngw1a.ngw.ref
		})
		new aws_ec2.CfnSubnetRouteTableAssociation(this, "app-1a-subnet1a", {
			routeTableId: rtbApp1a.ref,
			subnetId: app1a.subnet.ref
		})

		// app1a route table
		const rtbApp1c = new aws_ec2.CfnRouteTable(this, "rtb-app-1c", {
			vpcId: vpc.vpc.ref,
			tags: [{key: "Name", value: "rtb-app-1c"}]
		})
		new aws_ec2.CfnRoute(this, "app-1c-route", {
			routeTableId: rtbApp1c.ref,
			destinationCidrBlock: "0.0.0.0/0",
			natGatewayId: ngw1c.ngw.ref
		})
		new aws_ec2.CfnSubnetRouteTableAssociation(this, "app-1c-subnet1a", {
			routeTableId: rtbApp1c.ref,
			subnetId: app1c.subnet.ref
		})

		// db route table
		const rtbDb = new aws_ec2.CfnRouteTable(this, "rtb-db", {
			vpcId: vpc.vpc.ref,
			tags: [{key: "Name", value: "rtb-db"}]
		})
		new aws_ec2.CfnSubnetRouteTableAssociation(this, "db-db-1a", {
			routeTableId: rtbDb.ref,
			subnetId: db1a.subnet.ref
		})
		new aws_ec2.CfnSubnetRouteTableAssociation(this, "db-db-1c", {
			routeTableId: rtbDb.ref,
			subnetId: db1c.subnet.ref
		})
	}
}
