import * as cdk from "@aws-cdk/core";
import {StreamlitEcsFargateStack, StreamlitEcsFargateCloudFrontStack} from '../../stacks';
import {params, paramsCloudFront} from './params'

const app = new cdk.App();
new StreamlitEcsFargateStack(app, "streamlit", params, {env: params.env});
new StreamlitEcsFargateCloudFrontStack(app, "streamlit-cloudfront", paramsCloudFront, {env: params.env});
app.synth();
