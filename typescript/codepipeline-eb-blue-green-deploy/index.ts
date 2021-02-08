import * as cdk from "@aws-cdk/core";
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as codebuild from '@aws-cdk/aws-codebuild';

import { getParams } from './params';

export class PipelineStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const pipeline = new codepipeline.Pipeline(this, 'MyFirstPipeline', {
            pipelineName: "MyPipeline"
        });
		const params = getParams()
        const project = new codebuild.PipelineProject(this, 'MyProject');

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
		 * approval action
		 */
		const approvalAction = new codepipeline_actions.ManualApprovalAction({
			actionName: 'DeployApprovalAction',
			runOrder: 2,
			externalEntityLink: sourceAction.variables.commitUrl,
		});

		/**
		 * deploy action
		 */
		const buildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'CodeBuild',
            project,
            input: sourceOutput, // The build action must use the CodeCommitSourceAction output as input.
            outputs: [new codepipeline.Artifact()], // optional
			runOrder: 3
        });


		pipeline.addStage({
            stageName: 'approveAndBuild',
            actions: [approvalAction, buildAction],
        });
    }
}


const app = new cdk.App();
new PipelineStack(app, "Pipeline");
app.synth();
