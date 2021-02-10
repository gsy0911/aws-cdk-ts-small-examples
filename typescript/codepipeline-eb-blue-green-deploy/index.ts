import * as cdk from "@aws-cdk/core";
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as lambda from '@aws-cdk/aws-lambda';
import { PythonFunction } from '@aws-cdk/aws-lambda-python';
import * as iam from '@aws-cdk/aws-iam';

import { getParams } from './params';

export class PipelineStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const pipeline = new codepipeline.Pipeline(this, 'MyFirstPipeline', {
            pipelineName: "MyPipeline"
        });
		const params = getParams()

        // S3 location
        const sourceOutput = new codepipeline.Artifact();
        const oauth = cdk.SecretValue.secretsManager(params.gitTokenInSecretManagerARN, {jsonField: params.gitTokenInSecretManagerJsonField});
        const sourceAction = new codepipeline_actions.GitHubSourceAction({
            actionName: 'GitHub_Source',
            owner: params.gitOwner,
            repo: params.gitRepoName,
            oauthToken: oauth,
            output: sourceOutput,
            branch: params.gitSourceBranch || 'master',
        });
        pipeline.addStage({
            stageName: 'Source',
            actions: [sourceAction],
        });

		/**
		 * lambda to get current date as docker-image-tag
		 *
		 * lambda returns '2021-01-01'.
		 */
		const lambdaCurrentDate = new PythonFunction(this, 'lambdaCurrentDate', {
			functionName: "PipelineCurrentDate",
			entry: './lambda/app',
			index: 'get_current_date.py',
			handler: 'handler',
			runtime: lambda.Runtime.PYTHON_3_8,
		})
		cdk.Tags.of(lambdaCurrentDate).add("runtime", "python")
		const getCurrentDateAction = new codepipeline_actions.LambdaInvokeAction({
			actionName: 'getCurrentDate',
			lambda: lambdaCurrentDate,
			variablesNamespace: 'BuildVariables'
		})
		pipeline.addStage({
            stageName: 'GetDockerImageTag',
            actions: [getCurrentDateAction],
        });

		/**
		 * approval action
		 */
		const approvalAction = new codepipeline_actions.ManualApprovalAction({
			actionName: 'DeployApprovalAction',
			runOrder: 1,
			externalEntityLink: sourceAction.variables.commitUrl,
		});

		/**
		 * deploy action
		 */
		const buildRole = new iam.Role(this, 'BuildRole', {
			assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com')
		})
		buildRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'BuildRoleToAccessECR', 'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess'))
		buildRole.addManagedPolicy(iam.ManagedPolicy.fromManagedPolicyArn(this, 'BuildRoleToAccessEB', 'arn:aws:iam::aws:policy/AWSElasticBeanstalkFullAccess'))


		// to build docker in CodeBuild, set priviledged True
        const project = new codebuild.PipelineProject(this, 'MyProject', {
			environment: {
				buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2,
				privileged: true
			},
			environmentVariables: {
				"AWS_ACCOUNT": {
					type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: params.awsAccountId,
				},
				"EB_APPLICATION_NAME": {
					type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: params.elasticBeanstalkApplicationName,
				},
				// overwrite values in BuildAction
				"IMAGE_TAG": {
					type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: getCurrentDateAction.variable('current_date')
				},
				"LOG_STREAM_NAME": {
					type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: params.cloudwatchLogsLogSteramName
				}
			},
			role: buildRole
		});

		const buildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'CodeBuild',
            project,
            input: sourceOutput, // The build action must use the CodeCommitSourceAction output as input.
            outputs: [new codepipeline.Artifact()], // optional
			runOrder: 2,
			environmentVariables: {
				"IMAGE_TAG": {
					type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: getCurrentDateAction.variable('current_date')
				}
			}
        });
		pipeline.addStage({
            stageName: 'approveAndBuild',
            actions: [buildAction],
        });

		const lambdaSwapEB = new PythonFunction(this, 'lambdaSwapEB', {
			functionName: "PipelineSwapEB",
			entry: './lambda/app',
			index: 'swap_env.py',
			handler: 'handler',
			runtime: lambda.Runtime.PYTHON_3_8,
		})
		cdk.Tags.of(lambdaSwapEB).add("runtime", "python")
		const swapEB = new codepipeline_actions.LambdaInvokeAction({
			actionName: 'swapEB',
			lambda: lambdaSwapEB,
			variablesNamespace: 'SwapVariables'
		})
		pipeline.addStage({
            stageName: 'SwapEnvironmentWithApproval',
            actions: [approvalAction, swapEB],
        });

    }
}


const app = new cdk.App();
new PipelineStack(app, "Pipeline");
app.synth();
