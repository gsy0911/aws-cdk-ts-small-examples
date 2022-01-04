import {
	Duration,
	Stack,
	StackProps,
	aws_cognito,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ICognitoStack {
	googleClientId?: string,
	googleClientSecret?: string
}


export class CognitoStack extends Stack {
	constructor(scope: Construct, id: string, params: ICognitoStack, props?: StackProps) {
		super(scope, id, props);

		const userPool = new aws_cognito.UserPool(this, "userPool", {
			userPoolName: `${id}-user-pool`,
			// signUp
			// By default, self sign up is disabled. Otherwise use userInvitation
			selfSignUpEnabled: true,
			userVerification: {
				emailSubject: "Verify email message",
				emailBody: "Thanks for signing up! Your verification code is {####}",
				emailStyle: aws_cognito.VerificationEmailStyle.CODE,
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
			mfa: aws_cognito.Mfa.REQUIRED,
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
				tempPasswordValidity: Duration.days(3)
			},
			accountRecovery: aws_cognito.AccountRecovery.EMAIL_ONLY,
			// emails, by default `no-reply@verificationemail.com` used
			// ...
		})

		// add third-party login such as `Google`
		new aws_cognito.UserPoolIdentityProviderGoogle(this, "Google", {
			clientId: params.googleClientId || "",
			clientSecret: params.googleClientSecret || "",
			userPool: userPool,
			attributeMapping: {
				email: aws_cognito.ProviderAttribute.GOOGLE_EMAIL,
				nickname: aws_cognito.ProviderAttribute.GOOGLE_FAMILY_NAME
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
