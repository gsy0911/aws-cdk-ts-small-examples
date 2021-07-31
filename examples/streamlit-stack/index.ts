import * as cdk from "@aws-cdk/core";
import {StreamlitEcsFargateStack} from '../stacks';
import {params} from './params'

const app = new cdk.App();
new StreamlitEcsFargateStack(app, "streamlit", params, {env: params.env});
app.synth();
