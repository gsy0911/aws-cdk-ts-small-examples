import boto3

s3_client = boto3.client('s3')


def lambda_handler(event, context):
	get_obj_context = event['getObjectContext']

	return s3_client.write_get_object_response(
		RequestRoute=get_obj_context['outputRoute'],
		RequestToken=get_obj_context['outputToken'],
		StatusCode=403,
		ErrorCode='MissingToken',
		ErrorMessage='some error message'
	)
