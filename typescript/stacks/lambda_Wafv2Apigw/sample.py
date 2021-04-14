from utils import response_wrapper


@response_wrapper()
def handler(event, _):
	print("hello")
	return 200, {"date": "a"}
