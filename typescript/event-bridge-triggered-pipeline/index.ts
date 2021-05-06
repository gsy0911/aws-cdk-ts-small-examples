import * as cdk from "@aws-cdk/core";
import {EventBridgeTriggeredEcsSingleFargatePipeline} from '../stacks';
import {params} from './params';


const app = new cdk.App();
new EventBridgeTriggeredEcsSingleFargatePipeline(app, "EventBridgeTriggeredPipeline", params, {description: "ts-example: from example", env: params.env});

app.synth();
