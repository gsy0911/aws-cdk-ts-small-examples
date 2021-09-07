import * as cdk from "@aws-cdk/core";
import {EcrEcsMultipleServicesFargateElbStack} from '../../stacks/EcrEcsMultipleServicesFargateElbStack';

// CDKのmain()
const app = new cdk.App();
new EcrEcsMultipleServicesFargateElbStack(app, "ecs-multiple-services", {description: "cdk-ts-example"})
