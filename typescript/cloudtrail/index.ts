import * as cdk from "@aws-cdk/core";
import * as logs from '@aws-cdk/aws-logs';
import * as s3 from '@aws-cdk/aws-s3';
import * as cloudtrail from '@aws-cdk/aws-cloudtrail';
import { IParameters } from './IParameters';
import { params } from './params';


export class CloudTrailStack extends cdk.Stack {
  	constructor(app: cdk.App, id: string, params: IParameters, props?: cdk.StackProps) {
		super(app, id, props);

		/** bucket to store log from Firehose */
		const logS3 = new s3.Bucket(this, "CloudTrailLogBucket", {
			bucketName: `cloud-trail-log-bucket-${params.bucketNameSuffix}`,
			autoDeleteObjects: true,
			removalPolicy: cdk.RemovalPolicy.DESTROY
		})

		/** create Log Group */
		const logGroup = new logs.LogGroup(this, 'CloudTrailLogGroup', {
			logGroupName: params.cloudTrailLogGroupName,
			retention: logs.RetentionDays.ONE_WEEK,
		});

		const trail = new cloudtrail.Trail(this, "CloudTrail", {
			bucket: logS3,
			cloudWatchLogGroup: logGroup,
			sendToCloudWatchLogs: true,
			trailName: "CloudTrailFromCdk"
		})

 	 }
}

const app = new cdk.App();
new CloudTrailStack(app, "CloudTrailStack", params, {description: "ts-example"});
app.synth();
