import * as path from "path";

import * as cdk from "@aws-cdk/core";
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as lambda from '@aws-cdk/aws-lambda';
import { PythonFunction } from '@aws-cdk/aws-lambda-python';
import * as iam from '@aws-cdk/aws-iam';

import { getParams } from './params';
import { Duration } from "@aws-cdk/core";

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
			entry: path.resolve(__dirname, './lambda'),
			index: 'get_execute_date.py',
			handler: 'handler',
			runtime: lambda.Runtime.PYTHON_3_8,
			timeout: Duration.seconds(120),
		})
		cdk.Tags.of(lambdaCurrentDate).add("runtime", "python")
		const getCurrentDateAction = new codepipeline_actions.LambdaInvokeAction({
			actionName: 'getCurrentDate',
			lambda: lambdaCurrentDate
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
				"IMAGE_TAG": {
					type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
					value: getCurrentDateAction.variable('current_date')
				}
			},
			role: buildRole
		});

		const buildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'CodeBuild',
            project,
            input: sourceOutput, // The build action must use the CodeCommitSourceAction output as input.
            outputs: [new codepipeline.Artifact()], // optional
			runOrder: 2
        });


		pipeline.addStage({
            stageName: 'approveAndBuild',
            actions: [approvalAction, buildAction],
        });


		/**
		 * lambda to create green environment
		 */
		const lambdaCreateGreenEnv = new lambda.Function(this, 'createGreenEnv', {
			handler: 'create_green_env.handler',
			runtime: lambda.Runtime.PYTHON_3_8,
			code: lambda.Code.fromAsset('./lambda_script'),
			timeout: Duration.seconds(120),
		})
		const createGreenEnvAction = new codepipeline_actions.LambdaInvokeAction({
			actionName: 'CreateGreenEnvironment',
			lambda: lambdaCreateGreenEnv
		})

		pipeline.addStage({
            stageName: 'CreateGreenEnvironmentStage',
            actions: [createGreenEnvAction],
        });

		/**
		 * lambda to swap environments
		 */
		const lambdaTerminateGreenEnv = new lambda.Function(this, 'terminteGreenEnv', {
			handler: 'terminate_green_env.handler',
			runtime: lambda.Runtime.PYTHON_3_8,
			code: lambda.Code.fromAsset('./lambda_script'),
			timeout: Duration.seconds(120),
		})
		const terminateGreenEnvAction = new codepipeline_actions.LambdaInvokeAction({
			actionName: 'TerminateGreenEnvironment',
			lambda: lambdaTerminateGreenEnv
		})

		pipeline.addStage({
            stageName: 'TerminateGreenEnvironmentStage',
            actions: [terminateGreenEnvAction],
        });

    }
}


const app = new cdk.App();
new PipelineStack(app, "Pipeline");
app.synth();
