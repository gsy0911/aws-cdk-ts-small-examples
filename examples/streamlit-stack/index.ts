import * as cdk from "@aws-cdk/core";
import {
	StreamlitEcsFargateStack,
	StreamlitEcsFargateCognitoStack,
	StreamlitEcsFargateHttpsOnlyCloudFrontStack
} from '../../stacks';
import {params, paramsCognito, paramsHttpsCloudFront} from './params'

const app = new cdk.App();
new StreamlitEcsFargateStack(app, "streamlit", params, {env: params.env});
new StreamlitEcsFargateCognitoStack(app, "streamlit-cognito", paramsCognito, {env: params.env});
new StreamlitEcsFargateHttpsOnlyCloudFrontStack(app, "streamlit-https-cloudfront", paramsHttpsCloudFront, {env: params.env});
app.synth();
