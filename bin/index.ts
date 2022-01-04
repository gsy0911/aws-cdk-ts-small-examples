#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as examples from '../lib';
import {env} from '../lib/params';

const app = new cdk.App();

const props: cdk.StackProps = {
	description: "cdk-example", env
}

// ECS
new examples.EcrEcsFargateStack(app, "EcrEcsFargateStack", {vpcId: "aaaa"}, props)
new examples.EcrEcsMultipleFargateElbStack1(app, "EcrEcsMultipleFargateElbStack1", props)
new examples.EcrEcsMultipleFargateElbStack2(app, "EcrEcsMultipleFargateElbStack2", props)
new examples.EcrEcsSingleFargateElbStack(app, "EcrEcsSingleFargateElbStack", props)
new examples.EcrEcsMultipleServicesFargateElbStack(app, "EcrEcsMultipleServicesFargateElbStack", props)

// Batch
new examples.BatchSfnStack(app, "BatchSfnStack", {environment: "example"}, props)

// RDS
new examples.VpcRdsStack(app, "VpcRdsStack", props)
new examples.RdsEc2IamAccessStack(app, "RdsEc2IamAccessStack", props)
new examples.RdsEc2AccessStack(app, "RdsEc2AccessStack", props)

// WAFv2
new examples.Wafv2ApigwStack(app, "Wafv2ApigwStack", examples.defaultWafv2ApigwParams, props)

// SAM + CDK
new examples.SamExampleStack(app, "SamExampleStack", examples.samExampleParams, props)

// S3 Object Lambda
new examples.S3ObjectLambdaStack(app, "S3ObjectLambdaStack", examples.defaultS3ObjectLambdaParams, props)

app.synth();
