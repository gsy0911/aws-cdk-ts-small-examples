import * as cdk from "@aws-cdk/core";
import {CognitoStack, ICognitoStack} from '../stacks';
import {params} from './params';


const app = new cdk.App();
new CognitoStack(app, "Cognito", params, {description: "ts-example: from example"});

app.synth();
