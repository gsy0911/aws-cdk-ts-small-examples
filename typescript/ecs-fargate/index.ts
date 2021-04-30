import * as cdk from "@aws-cdk/core";
import {EcsFargateStack, EcrEcsFargateStack, EcrEcsFargateElbStack} from '../stacks';
import {params} from './params';


const app = new cdk.App();
new EcsFargateStack(app, "EcsFargate", params, {description: "ts-example: from example", env: params.env});
new EcrEcsFargateStack(app, "EcrEcsFargate", params, {description: "ts-example: from defined docker", env: params.env});
new EcrEcsFargateElbStack(app, "EcrEcsFargateElb", params, {description: "ts-example: from defined docker with alb", env: params.env});

app.synth();
