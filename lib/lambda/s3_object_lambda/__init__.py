import boto3
import json
from urllib.parse import urlparse, unquote
from pathlib import Path

s3_client = boto3.client('s3')


def lambda_handler(event, context):
	print(f"event: {event}")
	# Extract the outputRoute and outputToken from the object context
	object_context = event["getObjectContext"]
	request_route = object_context["outputRoute"]
	request_token = object_context["outputToken"]

	# Extract the user requested URL and the supporting access point arn
	user_request_url = event["userRequest"]["url"]
	supporting_access_point_arn = event["configuration"]["supportingAccessPointArn"]

	print(f"user_request_url: {user_request_url}")
	print(f"supporting_access_point_arn: {supporting_access_point_arn}")

	user_request_url = unquote(user_request_url)
	result = user_request_url.split("#")
	user_request_url = result[0]
	if len(result) > 1:
		target_color = result[1]
	else:
		target_color = "red"

	# Extract the S3 Object Key from the user requested URL
	s3_key = str(Path(urlparse(user_request_url).path).relative_to('/'))

	# Get the original object from S3
	s3 = boto3.resource('s3')

	# To get the original object from S3,use the supporting_access_point_arn
	s3_obj = s3.Object(supporting_access_point_arn, s3_key).get()
	src_text = s3_obj['Body'].read()
	src_text = src_text.decode('utf-8')

	# data
	data = json.loads(src_text)
	print(f"data: {data}")
	filtered = {"filtered": [d for d in data["data"] if d["color"] == target_color]}
	print(f"filtered: {filtered}")

	response = s3_client.write_get_object_response(
		Body=json.dumps(filtered).encode("utf-8"),
		RequestRoute=request_route,
		RequestToken=request_token)

	return response
