import os

from utils import response_wrapper


@response_wrapper()
def handler(event, _):
    return 200, {"status": "success", "from": "SAM CLI", "s3": f"{os.environ.get('S3_PATH')}/lambda/..."}
