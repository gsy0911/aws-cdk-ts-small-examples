import * as cdk from "@aws-cdk/core";
import * as wafv2 from "@aws-cdk/aws-wafv2";
import { IWafv2Stack } from '../IParameters';

export class WafStack extends cdk.Stack {
	constructor(scope: cdk.Construct, id: string, params: IWafv2Stack, props?: cdk.StackProps) {
		super(scope, id, props);

		// WebACLを作成
		const webAcl = new wafv2.CfnWebACL(this, "SampleWafAcl", {
		defaultAction: { allow: {} },
		name: "sample-waf-web-acl",
		rules: [

			{
				priority: 1,
				overrideAction: { none: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: "AWS-ManagedRulesCommonRuleSet"
				},
				name: "AWSManagedRulesCommonRuleSet",
				statement: {
					managedRuleGroupStatement: {
					vendorName: "AWS",
					name: "AWSManagedRulesCommonRuleSet"
					}
				}
			},
			{
				priority: 2,
				overrideAction: { none: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: "AWS-ManagedRulesKnownBadInputsRuleSet"
				},
				name: "AWSManagedRulesKnownBadInputsRuleSet",
				statement: {
					managedRuleGroupStatement: {
						vendorName: "AWS",
						name: "AWSManagedRulesKnownBadInputsRuleSet"
					}
				}
			},
			{
				priority: 3,
				overrideAction: { none: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: "AWS-ManagedRulesAdminProtectionRuleSet"
				},
				name: "AWSManagedRulesAdminProtectionRuleSet",
				statement: {
					managedRuleGroupStatement: {
						vendorName: "AWS",
						name: "AWSManagedRulesAdminProtectionRuleSet"
					}
				}
			},
			{
				priority: 4,
				overrideAction: { none: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: "AWS-AWSManagedRulesSQLiRuleSet"
				},
				name: "AWSAWSManagedRulesSQLiRuleSet",
				statement: {
					managedRuleGroupStatement: {
						vendorName: "AWS",
						name: "AWSManagedRulesSQLiRuleSet"
					}
				}
			},
			{
				priority: 5,
				overrideAction: { none: {} },
				visibilityConfig: {
					sampledRequestsEnabled: true,
					cloudWatchMetricsEnabled: true,
					metricName: "AWS-ManagedRulesLinuxRuleSet"
				},
				name: "AWSManagedRulesLinuxRuleSet",
				statement: {
					managedRuleGroupStatement: {
						vendorName: "AWS",
						name: "AWSManagedRulesLinuxRuleSet"
					}
				}
			}
		],
		scope: "REGIONAL",
		visibilityConfig: {
			cloudWatchMetricsEnabled: true,
			metricName: "sample-waf-web-acl",
			sampledRequestsEnabled: true
		}
		});
	}
}
