import * as cdk from "@aws-cdk/core";
import {
	StreamlitEcsFargateStack,
	StreamlitEcsFargateHttpCloudFrontStack,
	StreamlitEcsFargateHttpsOnlyCloudFrontStack
} from '../../stacks';
import {params, paramsHttpCloudFront, paramsHttpsCloudFront} from './params'

const app = new cdk.App();
new StreamlitEcsFargateStack(app, "streamlit", params, {env: params.env});
new StreamlitEcsFargateHttpCloudFrontStack(app, "streamlit-http-cloudfront", paramsHttpCloudFront, {env: params.env});
new StreamlitEcsFargateHttpsOnlyCloudFrontStack(app, "streamlit-https-cloudfront", paramsHttpsCloudFront, {env: params.env});
app.synth();
