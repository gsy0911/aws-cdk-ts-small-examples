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
		user_parameters = job_data['actionConfiguration']['configuration']['UserParameters']
		# Calling DeleteConfigTemplate API
		delete_config_template = delete_config_template_blue(
			application_name=(json.loads(user_parameters)['BeanstalkAppName']),
			template_name=(json.loads(user_parameters)['CreateConfigTempName']))
		logger.info(delete_config_template)
		# re-swapping the urls
		reswap = swap_green_and_blue(
			src_environment=(json.loads(user_parameters)['BlueEnvName']),
			dst_environment=(json.loads(user_parameters)['GreenEnvName']))
		if reswap == "Failure":
			raise Exception("Re-Swap did not happen")
		logger.info("Deleting the GreenEnvironment")
		delete_green_environment(environment_name=(json.loads(user_parameters)['GreenEnvName']))
		# Delete the S3 CNAME Config file
		s3 = boto3.resource('s3')
		bucket = s3.Bucket(json.loads(user_parameters)['BlueCNAMEConfigBucket'])
		key = 'hello.json'
		objs = list(bucket.objects.filter(Prefix=key))
		if len(objs) > 0 and objs[0].key == key:
			obj = s3.Object(
				json.loads(user_parameters)['BlueCNAMEConfigBucket'],
				json.loads(user_parameters)['BlueCNAMEConfigFile'])
			obj.delete()
			logger.info("Successfully deleted the CNAME Config file")
		else:
			logger.info("Seems like the CNAME Config file is already deleted!")
		# Send Success Message to CodePipeline
		status = "Success"
		message = "Successfully reswapped and terminated the Green Environment"

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


def delete_config_template_blue(application_name: str, template_name: str):
	# check if the config template exists
	template_list = beanstalkclient.describe_applications(ApplicationNames=[application_name])['Applications'][0][
		'ConfigurationTemplates']
	if template_name not in template_list:
		return "Config Template does not exist"
	else:
		response = beanstalkclient.delete_configuration_template(
			ApplicationName=application_name,
			TemplateName=template_name)
		logger.info(response)
		return "Config Template Deleted"


def swap_green_and_blue(src_environment: str, dst_environment: str) -> str:
	env_data = (beanstalkclient.describe_environments(
		EnvironmentNames=[src_environment, dst_environment],
		IncludeDeleted=False))
	logger.info(env_data)
	if (((env_data['Environments'][0]['Status']) == "Ready") and (
		(env_data['Environments'][1]['Status']) == "Ready")):
		response = beanstalkclient.swap_environment_cnames(
			SourceEnvironmentName=src_environment,
			DestinationEnvironmentName=dst_environment)
		logger.info(response)
		return "Success"
	else:
		return "Failure"


def delete_green_environment(environment_name):
	env_data = beanstalkclient.describe_environments(EnvironmentNames=[environment_name])
	logger.info(env_data)
	invalid_status = ["Terminating", "Terminated"]
	if not (env_data['Environments'] == []):
		# if not(B['Environments'][0]['Status']=="Terminated"): #or not(B['Environments'][0]['Status']=="Terminating")):
		if (env_data['Environments'][0]['Status']) in invalid_status:
			return "Already Terminated"
	while True:
		green_env_status = (beanstalkclient.describe_environments(EnvironmentNames=[environment_name]))['Environments'][0][
			'Status']
		logger.info(green_env_status)
		time.sleep(10)
		if green_env_status == 'Ready':
			response = beanstalkclient.terminate_environment(EnvironmentName=environment_name)
			logger.info(response)
			logger.info("Successfully Terminated Green Environment")
			return
