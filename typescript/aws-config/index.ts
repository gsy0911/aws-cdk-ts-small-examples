import * as cdk from "@aws-cdk/core";
import * as awsconfig from '@aws-cdk/aws-config';
import { IParameters } from './IParameters';
import { params } from './params';


export class AwsConfigStack extends cdk.Stack {
  	constructor(app: cdk.App, id: string, params: IParameters, props?: cdk.StackProps) {
		super(app, id, props);

		const config = new awsconfig.CfnConfigurationRecorder(this, "AwsConfig", {
			roleArn: "",
			name: "AwsConfigFromCDK",
			recordingGroup: {
				allSupported: true,
				includeGlobalResourceTypes: true
			}
		})

 	 }
}

const app = new cdk.App();
new AwsConfigStack(app, "CloudTrailStack", params, {description: "ts-example"});
app.synth();
