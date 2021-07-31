import * as cdk from "@aws-cdk/core";
import {
	StreamlitEcsFargateStack,
	StreamlitEcsFargateHttpsOnlyCloudFrontStack
} from '../../stacks';
import {params, paramsHttpsCloudFront} from './params'

const app = new cdk.App();
new StreamlitEcsFargateStack(app, "streamlit", params, {env: params.env});
new StreamlitEcsFargateHttpsOnlyCloudFrontStack(app, "streamlit-https-cloudfront", paramsHttpsCloudFront, {env: params.env});
app.synth();
