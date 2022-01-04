# S3ObjectLambdaStack

## step1

prepare json file, as `example.json`.

```python
import json

data = {"data": [
    {
        "color": "red",
        "value": "#f00"
    },
    {
        "color": "green",
        "value": "#0f0"
    },
    {
        "color": "blue",
        "value": "#00f"
    },
    {
        "color": "cyan",
        "value": "#0ff"
    },
    {
        "color": "magenta",
        "value": "#f0f"
    },
    {
        "color": "yellow",
        "value": "#ff0"
    },
    {
        "color": "black",
        "value": "#000"
    }
]}

with open("example.json", "w") as f:
    json.dump(data, f)
```

## step2

deploy `S3ObjectLambdaStack` and put `example.json` to S3.

copy ARN of `S3ObjectLambdaStack.S3ObjectArn = {shown in command line}`.

## step3

get object via S3ObjectLambda, using Python like

```python
import boto3
s3 = boto3.client('s3')

s3_bucket = "{S3ObjectLambdaStack.S3ObjectArn}"

# normally
s3_key = "example.json"
response = s3.get_object(Bucket=s3_bucket, Key=s3_key)
print(response['Body'].read().decode('utf-8'))
# response >>> {"filtered": [{"color": "red", "value": "#f00"}]}

# filtered by green
s3_key = "example.json#green"
response = s3.get_object(Bucket=s3_bucket, Key=s3_key)
print(response['Body'].read().decode('utf-8'))
# response >>> {"filtered": [{"color": "green", "value": "#0f0"}]}
```

# References

- [s3-object-lambda-demo](https://github.com/miztiik/s3-object-lambda-demo)
- [S3に対するGetリクエストのレスポンスをLambdaで加工するS3 Object Lambdaが利用可能になりました](https://dev.classmethod.jp/articles/s3-object-lambda/)
- [Amazon S3 Object Lambda を使用してコンテンツを動的に翻訳する](https://aws.amazon.com/jp/blogs/news/translating-content-dynamically-by-using-amazon-s3-object-lambda/)