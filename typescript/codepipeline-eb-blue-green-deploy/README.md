# CodePipeline-EB-BlueGreenDeploy

## Required Policies

- Managed Policy
	- SecretsManagerReadWrite
	- AWSLambdaFullAccess
	- AmazonS3FullAccess
	- AWSCodePipelineFullAccess
	- AWSCodeBuildAdminAccess
	- AWSCloudFormationFullAccess
- Inline Policy

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:AttachRolePolicy",
                "iam:DeleteRole",
                "iam:DeleteRolePolicy",
                "iam:DetachRolePolicy",
                "iam:PutRolePolicy"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "kms:Create*",
                "kms:Describe*",
                "kms:Enable*",
                "kms:List*",
                "kms:Put*",
                "kms:Update*",
                "kms:Revoke*",
                "kms:Disable*",
                "kms:Get*",
                "kms:Delete*",
                "kms:TagResource",
                "kms:UntagResource",
                "kms:ScheduleKeyDeletion",
                "kms:CancelKeyDeletion"
            ],
            "Resource": "*"
        }
    ]
}
```

## deploying lambda error

when

```
Uploaded file must be a non-empty zip ...
```

error occurres, try

1. run the shell script `fix_err.sh`
1. remove cdk.out
1. downgraded Node to v14 via Homebrew
1. cdk deploy

## references

- [](https://dev.classmethod.jp/articles/cdk-approval-pipeline/)
- [4 Step Process to Downgrade Node version using Homebrew](https://medium.com/@georgeenathomas/3-step-process-to-downgrade-node-version-using-homebrew-bc0b0a72ae27)
- [quickstart-codepipeline-bluegreen-deployment(GitHub)](https://github.com/aws-quickstart/quickstart-codepipeline-bluegreen-deployment)
- [cdk issue12536](https://github.com/aws/aws-cdk/issues/12536)