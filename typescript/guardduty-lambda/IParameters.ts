export interface IParameters {
	/** To get the ID, open Slack, right click on the channel name in the left pane, then choose Copy Link. The channel ID is the 9-character string at the end of the URL. */
	slackChannelId: string
	/** The ID of the Slack workspace authorized with AWS Chatbot */
	slackWorkspaceId: string
}


export const defaultParams: IParameters = {
	slackChannelId: "ABCBBLZZZ",
	slackWorkspaceId: "YOUR_SLACK_WORKSPACE_ID"
}
