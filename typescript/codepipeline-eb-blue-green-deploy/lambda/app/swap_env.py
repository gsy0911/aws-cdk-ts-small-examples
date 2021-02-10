import json
from logging import getLogger, INFO
import sys
import threading
import time
import traceback
import boto3

from utils import put_job_success, put_job_failure, timeout


beanstalkclient = boto3.client('elasticbeanstalk')
logger = getLogger(__name__)
logger.setLevel(INFO)


def handler(event, context):
	# make sure we send a failure to CodePipeline if the function is going to timeout
	timer = threading.Timer((context.get_remaining_time_in_millis() / 1000.00) - 0.5, timeout, args=[event, context])
	timer.start()

	status = "Failure"
	message = "failed"
	# Extract the Job ID
	job_id = event['CodePipeline.job']['id']
	try:
		# Extract the Job Data
		job_data = event['CodePipeline.job']['data']
		user_parameters: dict = json.loads(job_data['actionConfiguration']['configuration']['UserParameters'])

		application_name = user_parameters['EB_APPLICATION_nAME']
		get_environments(application_name=application_name)
		# # Calling DeleteConfigTemplate API
		# delete_config_template = delete_config_template_blue(
		# 	application_name=(json.loads(user_parameters)['BeanstalkAppName']),
		# 	template_name=(json.loads(user_parameters)['CreateConfigTempName']))
		# logger.info(delete_config_template)
		# # re-swapping the urls
		# reswap = swap_green_and_blue(
		# 	src_environment=(json.loads(user_parameters)['BlueEnvName']),
		# 	dst_environment=(json.loads(user_parameters)['GreenEnvName']))
		# if reswap == "Failure":
		# 	raise Exception("Re-Swap did not happen")
		# logger.info("Deleting the GreenEnvironment")
		# delete_green_environment(environment_name=(json.loads(user_parameters)['GreenEnvName']))
		# # Delete the S3 CNAME Config file
		# s3 = boto3.resource('s3')
		# bucket = s3.Bucket(json.loads(user_parameters)['BlueCNAMEConfigBucket'])
		# key = 'hello.json'
		# objs = list(bucket.objects.filter(Prefix=key))
		# if len(objs) > 0 and objs[0].key == key:
		# 	obj = s3.Object(
		# 		json.loads(user_parameters)['BlueCNAMEConfigBucket'],
		# 		json.loads(user_parameters)['BlueCNAMEConfigFile'])
		# 	obj.delete()
		# 	logger.info("Successfully deleted the CNAME Config file")
		# else:
		# 	logger.info("Seems like the CNAME Config file is already deleted!")
		# # Send Success Message to CodePipeline
		# status = "Success"
		# message = "Successfully reswapped and terminated the Green Environment"

	except Exception as e:
		logger.info('Function failed due to exception.')
		logger.info(e)
		e = sys.exc_info()[0]
		logger.info(e)
		traceback.print_exc()
		status = "Failure"
		message = ("Error occured while executing this. The error is %s" % e)

	finally:
		timer.cancel()
		if status == "Success":
			put_job_success(job_id=job_id, message=message, output_variables={})
		else:
			put_job_failure(job_id=job_id, message=message)


def get_environments(application_name: str) -> list:
	e_list = beanstalkclient.describe_environments(ApplicationName=application_name)
	environments = e_list['Environments']
	# sort by created time
	sorted(environments, key=lambda x: x['DateCreated'])
	return environments


def swap_green_and_blue(src_environment: str, dst_environment: str) -> str:
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
