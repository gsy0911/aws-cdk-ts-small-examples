import {
	Stack,
	StackProps,
	aws_s3,
	aws_cloudtrail,
	aws_logs,
	RemovalPolicy
} from 'aws-cdk-lib';
import { Construct } from 'constructs';


export interface ICloudTrailStack {
	bucketNameSuffix: string
	cloudTrailLogGroupName: string
}


export class CloudTrailStack extends Stack {
  	constructor(app: Construct, id: string, params: ICloudTrailStack, props?: StackProps) {
		super(app, id, props);

		/** bucket to store log from Firehose */
		const logS3 = new aws_s3.Bucket(this, "CloudTrailLogBucket", {
			bucketName: `cloud-trail-log-bucket-${params.bucketNameSuffix}`,
			autoDeleteObjects: true,
			removalPolicy: RemovalPolicy.DESTROY
		})

		/** create Log Group */
		const logGroup = new aws_logs.LogGroup(this, 'CloudTrailLogGroup', {
			logGroupName: params.cloudTrailLogGroupName,
			retention: aws_logs.RetentionDays.ONE_WEEK,
		});

		new aws_cloudtrail.Trail(this, "CloudTrail", {
			bucket: logS3,
			cloudWatchLogGroup: logGroup,
			sendToCloudWatchLogs: true,
			trailName: "CloudTrailFromCdk"
		})

 	 }
}
