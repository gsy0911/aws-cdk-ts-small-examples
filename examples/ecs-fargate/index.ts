import * as cdk from "@aws-cdk/core";
import {
	EcsFargateStack,
	EcrEcsFargateStack,
	EcrEcsSingleFargateElbStack,
	EcrEcsMultipleFargateElbStack1,
	EcrEcsMultipleFargateElbStack2
} from '../../stacks';
import {params} from './params';


const app = new cdk.App();
new EcsFargateStack(app, "EcsFargate", params, {description: "ts-example: from example", env: params.env});
new EcrEcsFargateStack(app, "EcrEcsFargate", params, {description: "ts-example: from defined docker", env: params.env});
new EcrEcsSingleFargateElbStack(app, "EcrEcsSingleFargateElb", params, {description: "ts-example: from defined docker with alb", env: params.env});
new EcrEcsMultipleFargateElbStack1(app, "EcrEcsMultipleFargateElb-1", params, {description: "ts-example: from defined docker with alb", env: params.env});
new EcrEcsMultipleFargateElbStack2(app, "EcrEcsMultipleFargateElb-2", params, {description: "ts-example: from defined docker with alb", env: params.env});

app.synth();
