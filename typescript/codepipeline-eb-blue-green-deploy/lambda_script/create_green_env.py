import boto3
import json
import traceback
import sys
from logging import getLogger, INFO
import threading
import time

logger = getLogger(__name__)
logger.setLevel(INFO)

beanstalkclient = boto3.client('elasticbeanstalk')
codepipelineclient = boto3.client('codepipeline')


def handler(event, context):
	timer = threading.Timer((context.get_remaining_time_in_millis() / 1000.00) - 0.5, timeout, args=[event, context])
	timer.start()

	# Extract the Job ID
	status = "Failure"
	message = "failed"
	job_id = event['CodePipeline.job']['id']
	try:
		# Extract the Job ID
		job_id = event['CodePipeline.job']['id']
		# Extract the Job Data
		job_data = event['CodePipeline.job']['data']
		user_parameters = job_data['actionConfiguration']['configuration']['UserParameters']
		logger.info(job_data)
		logger.info(event)
		blue_env_info = get_blue_environment_info(environment_name=(json.loads(user_parameters)['BlueEnvName']))
		blue_env_id = blue_env_info['Environments'][0]['EnvironmentId']
		blue_version_label = blue_env_info['Environments'][0]['VersionLabel']

		# Calling CreateConfigTemplate API
		config_template = create_config_template_blue(
			application_name=(json.loads(user_parameters)['BeanstalkAppName']),
			blue_environment_id=blue_env_id,
			template_name=json.loads(user_parameters)['CreateConfigTempName'])
		returned_temp_name = config_template
		logger.info(returned_temp_name)
		if not returned_temp_name:
			# raise Exception if the Config file does not exist
			raise Exception("There were some issue while creating a Configuration Template from the Blue Environment")
		else:
			green_environment_id = create_green_environment(
				environment_name=(json.loads(user_parameters)['GreenEnvName']),
				template_name=returned_temp_name,
				application_version=blue_version_label,
				application_name=(json.loads(user_parameters)['BeanstalkAppName']))
			logger.info(green_environment_id)
			if green_environment_id:
				status = "Success"
				message = "Successfully created the Green Environment/Environment with the provided name already exists"
				# Create a CNAME Config file
				blue_env_cname = (blue_env_info['Environments'][0]['CNAME'])
				s3 = boto3.resource('s3')
				bucket = s3.Bucket(json.loads(user_parameters)['BlueCNAMEConfigBucket'])
				key = json.loads(user_parameters)['BlueCNAMEConfigFile']
				objs = list(bucket.objects.filter(Prefix=key))
				if len(objs) > 0 and objs[0].key == key:
					logger.info("BlueCNAMEConfigFile Already Exists!")
				else:
					obj = s3.Object(
						json.loads(user_parameters)['BlueCNAMEConfigBucket'],
						json.loads(user_parameters)['BlueCNAMEConfigFile'])
					blue_env_cname_file = {'BlueEnvUrl': blue_env_cname}
					obj.put(Body=json.dumps(blue_env_cname_file))
					logger.info("Created a new CNAME file")
			else:
				status = "Failure"
				message = "Something went wrong on GreenEnv Creation"
	except Exception as e:
		logger.info('Function failed due to exception.')
		e = sys.exc_info()[0]
		logger.info(e)
		traceback.print_exc()
		status = "Failure"
		message = "Error occurred while executing this. The error is %s" % e
	finally:
		timer.cancel()
		if status == "Success":
			put_job_success(job_id, message)
		else:
			put_job_failure(job_id, message)


def create_config_template_blue(
	application_name: str,
	blue_environment_id: str,
	template_name: str):
	template_list = beanstalkclient.describe_applications(ApplicationNames=[application_name])['Applications'][0][
		'ConfigurationTemplates']
	count = 0
	while count < len(template_list):
		logger.info(template_list[count])
		if template_list[count] == template_name:
			logger.info("ConfigTempAlreadyExists")
			return template_name
		count += 1
	response = beanstalkclient.create_configuration_template(
		ApplicationName=application_name,
		TemplateName=template_name,
		EnvironmentId=blue_environment_id)
	return response['TemplateName']


def get_blue_environment_info(environment_name: str) -> dict:
	"""

	Args:
		environment_name:

	Returns:

	See Also:
		https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/elasticbeanstalk.html
	"""
	response = beanstalkclient.describe_environments(
		EnvironmentNames=[
			environment_name
		])
	logger.info("Described the environment")
	return response


def create_green_environment(
		environment_name: str,
		template_name: str,
		application_version: str,
		application_name: str) -> str:
	"""

	Args:
		environment_name:
		template_name: The name of the Elastic Beanstalk configuration template to use with the environment.
		application_version:
		application_name:

	Returns:

	"""
	env_data = beanstalkclient.describe_environments(EnvironmentNames=[environment_name])
	logger.info(env_data)
	# logger.info (B['Environments'][0]['Status'])
	invalid_status = ["Terminating", "Terminated"]
	if not (env_data['Environments'] == []):
		logger.info("Environment Exists")
		if not (env_data['Environments'][0]['Status']) in invalid_status:
			logger.info("Existing Environment with the name %s not in Invalid Status" % environment_name)
			return env_data['Environments'][0]['EnvironmentId']
	logger.info("Creating a new Environment")
	response = beanstalkclient.create_environment(
		ApplicationName=application_name,
		EnvironmentName=environment_name,
		TemplateName=template_name,
		VersionLabel=application_version)
	return response['EnvironmentId']


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
