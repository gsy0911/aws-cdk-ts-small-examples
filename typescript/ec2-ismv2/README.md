

# setting via `AWS CLI`

```shell
# local
$ aws ec2 describe-instances --instance-id i-9999999999999999 --query "Reservations[*].Instances[*].MetadataOptions"
[
    [
        {
            "State": "applied",
            "HttpTokens": "optional",
            "HttpPutResponseHopLimit": 1,
            "HttpEndpoint": "enabled"
        }
    ]
]
```


```shell
# EC2
# v1
$ curl http://169.254.169.254/latest/meta-data/

# v2
$ TOKEN=`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"` && curl -H "X-aws-ec2-metadata-token: $TOKEN" -v http://169.254.169.254/latest/meta-data/
```

## disable IMDSv1

```shell
$ aws ec2 modify-instance-metadata-options --instance-id i-9999999999999999 --http-token required --http-endpoint enabled
{
    "InstanceId": "i-9999999999999999",
    "InstanceMetadataOptions": {
        "State": "pending",
        "HttpTokens": "required",
        "HttpPutResponseHopLimit": 1,
        "HttpEndpoint": "enabled"
    }
}

$ aws ec2 describe-instances --instance-id i-9999999999999999 --query "Reservations[*].Instances[*].MetadataOptions"
[
    [
        {
            "State": "applied",
            "HttpTokens": "required",
            "HttpPutResponseHopLimit": 1,
            "HttpEndpoint": "enabled"
        }
    ]
]
```

# References

* [[待望のアプデ]EC2インスタンスメタデータサービスv2がリリースされてSSRF脆弱性等への攻撃に対するセキュリティが強化されました！](https://dev.classmethod.jp/articles/ec2-imdsv2-release/)
