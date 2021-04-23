import * as cdk from "@aws-cdk/core";
import {EcrTriggeredPipeline} from '../stacks';
import {params} from './params';


const app = new cdk.App();
new EcrTriggeredPipeline(app, "EcrTriggeredPipeline", params, {description: "ts-example: from example"});

app.synth();
