# EventBridgeTriggeredPipeline for ECS Fargate

You need to do some actions, after `$ cdk deploy`

- deregister `target` of the `http-green-target`
	- because when deploying new environment using CodeDeploy, `Replacement Task` use the `target`.
	- and because it is impossible to set `target type` as IP, in the code CDK.
- when CodeDeploy initial run, it is required to register IP address of the newly generated `ecs task`. 

# References

- [AWS Black Belt Online Seminar - AWS CodeDeploy](https://d1.awsstatic.com/webinars/jp/pdf/services/20210126_BlackBelt_CodeDeploy.pdf)
- [Blue/Green Deployment Considerations](https://docs.amazonaws.cn/en_us/AmazonECS/latest/developerguide/deployment-type-bluegreen.html)