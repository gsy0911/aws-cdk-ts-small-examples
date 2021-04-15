import * as cdk from "@aws-cdk/core";
import {EcsFargateStack, IEcsFargate, EcrEcsFargateStack} from '../stacks';
import {params} from './params';

// export const params: IEcsFargate = {
// 	vpcId: "",
// 	env: {
// 		account: "",
// 		region: "",
// 	}
// }


const app = new cdk.App();
new EcsFargateStack(app, "EcsFargate", params, {description: "ts-example: from example", env: params.env});
new EcrEcsFargateStack(app, "EcrEcsFargate", params, {description: "ts-example: from defined docker", env: params.env});

app.synth();
