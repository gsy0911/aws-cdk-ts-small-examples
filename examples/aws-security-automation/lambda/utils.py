import json


def response_wrapper():
    def _actual_wrapper(function):
        def _wrapper(*args, **kwargs):
            status_code, response = function(*args, **kwargs)
            return {
                "statusCode": status_code,
                "body": json.dumps(response, ensure_ascii=False)
            }

        return _wrapper

    return _actual_wrapper
