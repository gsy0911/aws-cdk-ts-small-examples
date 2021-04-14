# AWS CDK TypeScript small Examples

This repository contains a set of `TypeScript` example projects for the [AWS Cloud Development Kit](https://github.com/aws/aws-cdk).

If you'd like to find python example, check [this repository](https://github.com/gsy0911/aws-cdk-small-examples).

## Environment

- [![macOS](https://img.shields.io/badge/macOS_BigSur-10.15.7-green.svg)]()
- [![cdk-version](https://img.shields.io/badge/aws_cdk-1.97.0-green.svg)](https://formulae.brew.sh/formula/aws-cdk)
- [![NodeVersion](https://img.shields.io/badge/node-14.16.1-blue.svg)](https://nodejs.org/ja/)

# TypeScript examples

In each directory,

```
$ cdk ls
```

and then,

```
$ cdk deploy {target_name}
```

finally, you should destroy everything.

```
$ cdk destroy {target_name}
```


## Contents

| Example | Description |
|:--:|:--:|
| [codepipeline-eb-blue-green-deploy](./typescript/codepipeline-eb-blue-green-deploy) | Create CI/CD flow with CodePipeline, CodeBuild for ElasticBeanstalk. |
| [http-proxy-apigateway](./typescript/http-proxy-apigateway) | copy from origin. |

# References

* [aws-samples/aws-cdk-examples](https://github.com/aws-samples/aws-cdk-examples)

# License

* This library is licensed under the Apache 2.0 License (same as origin).