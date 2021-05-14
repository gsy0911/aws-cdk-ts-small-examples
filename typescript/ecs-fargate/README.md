# ECS-Fargate

The list below shows ecs-stacks difference that you can deploy here.

- EcsFargate
  - Using sample Docker from AWS.
- EcrEcsFargate
  - Using original Docker pushed to ECR.
- EcrEcsFargateElb
  - Using original Docker pushed to ECR, and deploying ALB to make deploy/destroy faster.

# References

* [Amazon ECS マイクロサービスCI/CDハンズオン](https://pages.awscloud.com/rs/112-TZM-766/images/WS-5.pdf)
* [Speeding up Amazon ECS container deployments](https://nathanpeck.com/speeding-up-amazon-ecs-container-deployments/)
	* [Amazon ECS でのコンテナデプロイの高速化](https://toris.io/2021/04/speeding-up-amazon-ecs-container-deployments/)
* [vCPU & memory](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html)
* [docker image](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-cli-tutorial-fargate.html)
* [fargate-application-load-balanced-service](https://github.com/aws-samples/aws-cdk-examples/tree/master/typescript/ecs/fargate-application-load-balanced-service)
* [fargate-service-with-logging](https://github.com/aws-samples/aws-cdk-examples/tree/master/typescript/ecs/fargate-service-with-logging)

* [docker-compose.yml の uWSGI, Nginx, Flask アプリを ECS Fargateで動かす](https://dev.classmethod.jp/articles/from-uwsgiflask-docker-compose-yml-to-fargate-for-begineer/)
* [docker-compose.ymlを使って AWSFargateへデプロイ](https://hacknote.jp/archives/57856/)
* [ECS での Docker コンテナーのデプロイ](https://matsuand.github.io/docs.docker.jp.onthefly/cloud/ecs-integration/)