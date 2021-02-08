
## deploying lambda error

when

```
Uploaded file must be a non-empty zip ...
```

error occurres, try

1. run the shell script `fxi_err.sh`
1. remove cdk.out
1. downgraded Node to v14 via Homebrew
1. cdk deploy

## references

- [](https://dev.classmethod.jp/articles/cdk-approval-pipeline/)
- [4 Step Process to Downgrade Node version using Homebrew](https://medium.com/@georgeenathomas/3-step-process-to-downgrade-node-version-using-homebrew-bc0b0a72ae27)
- [quickstart-codepipeline-bluegreen-deployment(GitHub)](https://github.com/aws-quickstart/quickstart-codepipeline-bluegreen-deployment)
- [cdk issue12536](https://github.com/aws/aws-cdk/issues/12536)