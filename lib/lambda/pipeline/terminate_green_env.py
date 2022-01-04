import os
import sys
import time
import traceback
from logging import INFO, getLogger

import boto3
from utils import put_job_failure, put_job_success

EB_APPLICATION_NAME = os.environ["EB_APPLICATION_NAME"]
beanstalkclient = boto3.client("elasticbeanstalk")
logger = getLogger(__name__)
logger.setLevel(INFO)


def handler(event, context):
    status = "Failure"
    message = "failed"
    # Extract the Job ID
    job_id = event["CodePipeline.job"]["id"]
    try:
        environments = get_environments(application_name=EB_APPLICATION_NAME)
        logger.info(environments)
        if len(environments) < 2:
            # if the number of environments is less than 2, error
            put_job_failure(job_id=job_id, message="the number of environment is less than 2.")
            return {}
        # list `environments` is sorted by create datetime.
        # at this time, `blue` is swapped, latest environment
        blue_env_name = environments[0]["EnvironmentName"]
        green_env_name = environments[1]["EnvironmentName"]
        logger.info(f"blue: [{blue_env_name=}], green: [{green_env_name=}]")

    except Exception as e:
        logger.info("Function failed due to exception.")
        logger.info(e)
        e = sys.exc_info()[0]
        logger.info(e)
        traceback.print_exc()
        status = "Failure"
        message = "Error occured while executing this. The error is %s" % e

    finally:
        if status == "Success":
            put_job_success(job_id=job_id, message=message, output_variables={})
        else:
            put_job_failure(job_id=job_id, message=message)


def get_environments(application_name: str) -> list:
    e_list = beanstalkclient.describe_environments(ApplicationName=application_name)
    environments = e_list["Environments"]
    # sort by created time
    sorted(environments, key=lambda x: x["DateCreated"])
    return environments


def delete_green_environment(environment_name):
    env_data = beanstalkclient.describe_environments(EnvironmentNames=[environment_name])
    logger.info(env_data)
    invalid_status = ["Terminating", "Terminated"]
    if not (env_data["Environments"] == []):
        # if not(B['Environments'][0]['Status']=="Terminated"): #or not(B['Environments'][0]['Status']=="Terminating")):
        if (env_data["Environments"][0]["Status"]) in invalid_status:
            return "Already Terminated"
    while True:
        env_data = beanstalkclient.describe_environments(EnvironmentNames=[environment_name])
        green_env_status = env_data["Environments"][0]["Status"]
        logger.info(green_env_status)
        time.sleep(10)
        if green_env_status == "Ready":
            response = beanstalkclient.terminate_environment(EnvironmentName=environment_name)
            logger.info(response)
            logger.info("Successfully Terminated Green Environment")
            return
