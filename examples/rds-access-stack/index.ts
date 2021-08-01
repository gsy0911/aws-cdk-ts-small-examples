import * as cdk from "@aws-cdk/core";
import {RdsEc2AccessStack, RdsEc2IamAccessStack, IRdsEc2AccessStack} from '../../stacks';


export const params: IRdsEc2AccessStack = {
	vpcCidr: "192.168.5.0/24"
}


const app = new cdk.App();
// new RdsEc2AccessStack(app, "rds-ec2", params, {description: "ts-example"});
new RdsEc2IamAccessStack(app, "rds-ec2", params, {description: "ts-example"});
app.synth();
