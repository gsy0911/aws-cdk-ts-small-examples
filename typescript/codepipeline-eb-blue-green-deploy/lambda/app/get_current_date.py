from datetime import datetime
from utils import put_job_success, put_job_failure


def handler(event, context):
	# make sure we send a failure to CodePipeline if the function is going to timeout
	# timer = threading.Timer((context.get_remaining_time_in_millis() / 1000.00) - 0.5, timeout, args=[event, context])
	# timer.start()
	message = "obtain current date"
	# Extract the Job ID
	job_id = event['CodePipeline.job']['id']
	print(job_id)
	# alternative tag for docker
	output_variables = {"current_date": datetime.now().strftime("%Y-%m-%d")}
	put_job_success(job_id=job_id, message=message, output_variables=output_variables)
