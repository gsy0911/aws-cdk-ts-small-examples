import * as cdk from "@aws-cdk/core";
import {EcsFargateStack} from '../stacks';


// export const params: IVpcEc2 = {
// 	vpcCidr: "192.168.5.0/24"
// }


const app = new cdk.App();
new EcsFargateStack(app, "EcsFargate", {description: "ts-example"});
app.synth();
