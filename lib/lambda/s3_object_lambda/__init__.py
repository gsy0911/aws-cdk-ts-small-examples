from io import BytesIO
import json
from urllib.parse import unquote
import urllib.parse

import boto3
import pandas as pd

s3_client = boto3.client("s3")
s3_resource = boto3.resource("s3")


def _decode_json(supporting_access_point_arn: str, s3_key: str, query_param: dict):
    # To get the original object from S3,use the supporting_access_point_arn
    s3_obj = s3_resource.Object(supporting_access_point_arn, s3_key).get()
    src_text = s3_obj["Body"].read()
    src_text = src_text.decode("utf-8")

    # data
    data = json.loads(src_text)
    print(f"data: {data}")
    filtered_list = []
    for k, v in query_param.items():
        filtered_list.extend([d for d in data["data"] if d[k] == v[0]])
    filtered = {"filtered": filtered_list}
    print(f"filtered: {filtered}")
    return json.dumps(filtered).encode("utf-8")


def _decode_csv(supporting_access_point_arn: str, s3_key: str, query_param: dict):
    # To get the original object from S3,use the supporting_access_point_arn
    s3_obj = s3_resource.Object(supporting_access_point_arn, s3_key).get()
    df = pd.read_csv(BytesIO(s3_obj["Body"].read()), encoding="cp932")
    for k, v in query_param.items():
        df = df[df[k] == v[0]]
    return df.to_csv(encoding="utf-8", index=False)


def lambda_handler(event, _):
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
    decoded = urllib.parse.urlparse(user_request_url)
    path = s3_key = decoded.path[1:]
    qs = decoded.query
    qs_d = urllib.parse.parse_qs(qs)
    print(f"path=s3_key: {path}, qs_d: {qs_d}")

    # Get the original object from S3
    if s3_key.endswith(".json"):
        data = _decode_json(supporting_access_point_arn=supporting_access_point_arn, s3_key=s3_key, query_param=qs_d)
    elif s3_key.endswith(".csv"):
        data = _decode_csv(supporting_access_point_arn=supporting_access_point_arn, s3_key=s3_key, query_param=qs_d)
    else:
        raise ValueError()

    response = s3_client.write_get_object_response(
        Body=data, RequestRoute=request_route, RequestToken=request_token
    )

    return response
