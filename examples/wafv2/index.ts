import * as cdk from "@aws-cdk/core";
import {Wafv2ApigwStack, IWafv2ApigwStack} from '../../stacks';

export const defaultWafv2Value: IWafv2ApigwStack = {
	maxExpectedURISize: 512,
	maxExpectedQueryStringSize: 4096,
	maxExpectedBodySize: 4096,
	maxExpectedCookieSize: 4096,
	csrfExpectedHeader: 'x-csrf-token',
	csrfExpectedSize: 36,
}

const app = new cdk.App();
new Wafv2ApigwStack(app, "HttpProxy", defaultWafv2Value);
app.synth();
