import {expect as expectCDK, countResources, haveResource, matchTemplate, MatchStyle} from "@aws-cdk/assert";
import * as cdk from '@aws-cdk/core';
import {VpcStack} from '../typescript/stacks/BasicVpc';


const app = new cdk.App()
const stack = new VpcStack(app, "example", {name: "test", environment: "test"})

test('vpc', () => {
	expectCDK(stack).to(countResources("AWS::EC2::VPC", 1))
})