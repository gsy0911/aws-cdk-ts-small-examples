import * as cdk from "@aws-cdk/core";
import {VpcStack} from '../stacks/BasicVpc';


const app = new cdk.App();
const baseVpc = new VpcStack(app, "base-vpc", {name: "example", environment: "dev"})
app.synth();
