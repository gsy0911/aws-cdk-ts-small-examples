import * as cdk from "@aws-cdk/core";
import {EcsFargateStack, IEcsFargate} from '../stacks';
import {params} from './params';

// export const params: IEcsFargate = {
// 	vpcId: "",
// 	env: {
// 		account: "",
// 		region: "",
// 	}
// }


const app = new cdk.App();
new EcsFargateStack(app, "EcsFargate", params, {description: "ts-example", env: params.env});
app.synth();
