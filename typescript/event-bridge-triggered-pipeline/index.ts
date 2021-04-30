import * as cdk from "@aws-cdk/core";
import {EventBridgeTriggeredEcsFargatePipeline} from '../stacks';
import {params} from './params';


const app = new cdk.App();
new EventBridgeTriggeredEcsFargatePipeline(app, "EventBridgeTriggeredPipeline", params, {description: "ts-example: from example"});

app.synth();
