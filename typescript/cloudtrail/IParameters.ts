export interface IParameters {
	bucketNameSuffix: string
	cloudTrailLogGroupName: string
}


export const defaultParams: IParameters = {
	bucketNameSuffix: "{define-your-original-name}",
	cloudTrailLogGroupName: "/aws/cloudtrail/cdk-example"
}
