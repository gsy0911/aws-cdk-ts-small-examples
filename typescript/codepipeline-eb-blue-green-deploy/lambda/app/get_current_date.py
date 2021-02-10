from datetime import datetime
from utils import put_job_success


def handler(event, _):
	message = "obtain current date"
	# Extract the Job ID
	if "CodePipeline.job" not in event:
		raise ValueError()
	if "id" not in event['CodePipeline.job']:
		raise ValueError()

	job_id = event['CodePipeline.job']['id']
	print(job_id)
	# alternative tag for docker
	output_variables = {"current_date": datetime.now().strftime("%Y-%m-%dT%H%M")}
	put_job_success(job_id=job_id, message=message, output_variables=output_variables)
