import * as cdk from "@aws-cdk/core";

import { DummyApiStack } from './stacks/ApiStack'
import { WafStack } from './stacks/WafStack';
import { defaultWafv2Value } from './IParameters';


const app = new cdk.App();
new DummyApiStack(app, "DummyApi");
new WafStack(app, 'WafStack', defaultWafv2Value)
app.synth();
