#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as examples from '../lib';
import {env} from '../lib/params';

const app = new cdk.App();

// ECS
new examples.EcrEcsFargateStack(app, "EcrEcsFargateStack", {vpcId: "aaaa"}, {description: "cdk-example", env})
new examples.EcrEcsMultipleFargateElbStack1(app, "EcrEcsMultipleFargateElbStack1", {description: "cdk-example", env})
new examples.EcrEcsMultipleFargateElbStack2(app, "EcrEcsMultipleFargateElbStack2", {description: "cdk-example", env})
new examples.EcrEcsSingleFargateElbStack(app, "EcrEcsSingleFargateElbStack", {description: "cdk-example", env})
new examples.EcrEcsMultipleServicesFargateElbStack(app, "EcrEcsMultipleServicesFargateElbStack", {description: "cdk-example", env})

// Batch
new examples.BatchSfnStack(app, "BatchSfnStack", {environment: "example"}, {description: "cdk-example", env})

// RDS
new examples.VpcRdsStack(app, "VpcRdsStack", {description: "cdk-example", env})
new examples.RdsEc2IamAccessStack(app, "RdsEc2IamAccessStack", {description: "cdk-example", env})
new examples.RdsEc2AccessStack(app, "RdsEc2AccessStack", {description: "cdk-example", env})
app.synth();
