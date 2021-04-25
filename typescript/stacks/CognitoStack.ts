import * as cdk from '@aws-cdk/core';
import * as cognito from '@aws-cdk/aws-cognito';

export interface IEcrEcsFargate {
	googleClientId?: string,
	googleClientSecret?: string
}


export class CognitoStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, params: IEcrEcsFargate, props?: cdk.StackProps) {
		super(scope, id, props);

		const userPool = new cognito.UserPool(this, "userPool", {
			userPoolName: `${id}-user-pool`,
			// signUp
			// By default, self sign up is disabled. Otherwise use userInvitation
			selfSignUpEnabled: true,
			userVerification: {
				emailSubject: "Verify email message",
				emailBody: "Thanks for signing up! Your verification code is {####}",
				emailStyle: cognito.VerificationEmailStyle.CODE,
				smsMessage: "Thanks for signing up! Your verification code is {####}"
			},
			// sign in
			signInAliases: {
				username: true,
				email: true
			},
			// user attributes
			standardAttributes: {
				nickname: {
					required: true,
					// `mutable` means changeable
					mutable: true
				}
			},
			// role, specify if you want
			// ...
			mfa: cognito.Mfa.REQUIRED,
			mfaSecondFactor: {
				sms: true,
				otp: true
			},
			passwordPolicy: {
				minLength: 8,
				requireLowercase: true,
				requireUppercase: true,
				requireDigits: true,
				requireSymbols: true,
				tempPasswordValidity: cdk.Duration.days(3)
			},
			accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
			// emails, by default `no-reply@verificationemail.com` used
			// ...
		})

		// add third-party login such as `Google`
		new cognito.UserPoolIdentityProviderGoogle(this, "Google", {
			clientId: params.googleClientId || "",
			clientSecret: params.googleClientSecret || "",
			userPool: userPool,
			attributeMapping: {
				email: cognito.ProviderAttribute.GOOGLE_EMAIL,
				nickname: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME
			}
		})

		// App Clients
		userPool.addClient("appClient", {
			authFlows: {
				userPassword: true,
				userSrp: true
			}
		})
	}
}
