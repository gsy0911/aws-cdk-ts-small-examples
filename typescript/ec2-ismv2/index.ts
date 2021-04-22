import * as cdk from "@aws-cdk/core";
import {VpcEc2Stack, IVpcEc2} from '../stacks';


export const params: IVpcEc2 = {
	vpcCidr: "192.168.5.0/24"
}


const app = new cdk.App();
new VpcEc2Stack(app, "Ec2Ismv2", params, {description: "ts-example"});
app.synth();
