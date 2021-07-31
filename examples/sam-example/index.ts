import * as cdk from "@aws-cdk/core";
import {SamExample} from '../../stacks';


const app = new cdk.App();
new SamExample(app, "SamExampleStack", {S3Path: "s3://sam-example"}, {description: "ts-example: for AWS SAM"});

app.synth();
