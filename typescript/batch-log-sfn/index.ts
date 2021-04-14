import * as cdk from "@aws-cdk/core";
import {BatchSfnStack, IBatchLogSfn} from '../stacks';


export const params: IBatchLogSfn = {
	environment: "test-dev",
	vpcCidr: "192.168.4.0/24"
}


const app = new cdk.App();
new BatchSfnStack(app, "BatchSfn", params);
app.synth();
