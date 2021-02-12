from logging import getLogger, INFO
import os
import sys
import traceback
import boto3

from utils import put_job_success, put_job_failure

EB_APPLICATION_NAME = os.environ['EB_APPLICATION_NAME']
beanstalkclient = boto3.client('elasticbeanstalk')
logger = getLogger(__name__)
logger.setLevel(INFO)


def handler(event, _):
	status = "Failure"
	message = "failed"
	# Extract the Job ID
	job_id = event['CodePipeline.job']['id']
	try:
		environments = get_environments(application_name=EB_APPLICATION_NAME)
		logger.info(environments)
		if len(environments) < 2:
			# if the number of environments is less than 2, error
			put_job_failure(job_id=job_id, message="the number of environment is less than 2.")
			return {}
		# list `environments` is sorted by create datetime.
		blue_env_name = environments[1]['EnvironmentName']
		green_env_name = environments[0]['EnvironmentName']

		status = swap_green_and_blue(src_environment=blue_env_name, dst_environment=green_env_name)
		logger.info(f"swap result: {status}")

	except Exception as e:
		logger.info('Function failed due to exception.')
		logger.info(e)
		e = sys.exc_info()[0]
		logger.info(e)
		traceback.print_exc()
		status = "Failure"
		message = ("Error occurred while executing this. The error is %s" % e)

	finally:
		if status == "Success":
			put_job_success(job_id=job_id, message=message, output_variables={})
		else:
			put_job_failure(job_id=job_id, message=message)
	return {}


def get_environments(application_name: str) -> list:
	e_list = beanstalkclient.describe_environments(ApplicationName=application_name)
	environments = e_list['Environments']
	# sort by created time
	sorted(environments, key=lambda x: x['DateCreated'])
	return environments


def swap_green_and_blue(src_environment: str, dst_environment: str) -> str:
	logger.info(f"from [{src_environment=}] to [{dst_environment=}]")
	env_data = beanstalkclient.describe_environments(
		EnvironmentNames=[src_environment, dst_environment],
		IncludeDeleted=False)
	logger.info(env_data)
	is_green_env_ready = _is_environment_status_ready(env_data['Environments'][0])
	is_blue_env_ready = _is_environment_status_ready(env_data['Environments'][1])

	if is_green_env_ready and is_blue_env_ready:
		response = beanstalkclient.swap_environment_cnames(
			SourceEnvironmentName=src_environment,
			DestinationEnvironmentName=dst_environment)
		logger.info(response)
		return "Success"
	else:
		return "Failure"


def _is_environment_status_ready(payload: dict):
	return payload['Status'] == "Ready"
