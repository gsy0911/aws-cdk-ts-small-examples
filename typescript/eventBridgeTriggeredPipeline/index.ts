import * as cdk from "@aws-cdk/core";
import {EventBridgeTriggeredPipeline} from '../stacks';
import {params} from './params';


const app = new cdk.App();
new EventBridgeTriggeredPipeline(app, "EventBridgeTriggeredPipeline", params, {description: "ts-example: from example"});

app.synth();
