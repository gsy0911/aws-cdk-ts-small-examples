import * as cdk from "@aws-cdk/core";
import {CloudTrailStack, ICloudTrailStack} from '../stacks';

export const defaultParams: ICloudTrailStack = {
	bucketNameSuffix: "cdk-example",
	cloudTrailLogGroupName: "/aws/cloudtrail/cdk-example"
}

const app = new cdk.App();
new CloudTrailStack(app, "CloudTrailStack", defaultParams, {description: "ts-example"});
app.synth();
