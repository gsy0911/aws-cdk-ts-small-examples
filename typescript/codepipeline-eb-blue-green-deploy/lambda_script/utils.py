from logging import getLogger, INFO
import boto3

codepipelineclient = boto3.client('codepipeline')
logger = getLogger(__name__)
logger.setLevel(INFO)


def timeout(event, _):
	logger.error('Execution is about to time out, sending failure response to CodePipeline')
	put_job_failure(event['CodePipeline.job']['id'], "FunctionTimeOut")


def put_job_success(job, message):
	logger.info('Putting job success')
	logger.info(message)
	codepipelineclient.put_job_success_result(jobId=job)


def put_job_failure(job, message):
	logger.info('Putting job failure')
	logger.info(message)
	codepipelineclient.put_job_failure_result(jobId=job, failureDetails={'message': message, 'type': 'JobFailed'})
