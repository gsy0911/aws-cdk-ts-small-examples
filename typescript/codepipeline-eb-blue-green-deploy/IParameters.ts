/** parameters to set codepipeline */
export interface IParameters {
	/** SecretManager ARN*/
	gitTokenInSecretManagerARN: string,
	/** mapping key name */
	gitTokenInSecretManagerJsonField: string,
	/** git owner name */
	gitOwner: string,
	/** git repository name */
	gitRepoName: string,
	/** git branch name */
	gitSourceBranch?: string,
	/** 12 digits */
	awsAccountId: string,
	elasticBeanstalkApplicationName: string,
	elasticBeanstalkEnvironmentSuffix: string,
	/** ex: /aws/containers/{application-name} */
	cloudwatchLogsLogSteramName: string
}
