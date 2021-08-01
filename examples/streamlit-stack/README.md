# streamlit stack

- AWS
	- ECS (Fargate)
	- ALB
	- (Cognito)
	- ACM
	- Route 53 (your original domain)
- application
	- streamlit
	

# preparation in common

1. set your original domain to Route53, e.g. `streamlit.example.com`
1. create ACM in your region, e.g. `*.example.com`

## parameters for `StreamlitEcsFargateCognito`

create `params.ts`

```typescript
import {
	IStreamlitEcsFargateCognito,
} from '../../stacks';

export const paramsCognito: IStreamlitEcsFargateCognito = {
	vpcId: "vpc-aaaaaaaa",
	env: {
		account: "012345678912",
		region: "ap-northeast-1"
	},
	alb: {
	    // 
		certificate: "arn:aws:acm:ap-northeast-1:012345678912:certificate/abcdefgh-1234-5678-9012-abcdefghijkl",
		route53DomainName: "streamlit.example.com"
	},
	cognito: {
		domainPrefix: "streamlit",
        callbackUrls: ["https://streamlit.example.com/oauth2/idpresponse"],
        logoutUrls: ["https://streamlit.example.com"]
	},
}
```

# deploy

in `/examples/steramlit-stack`

```shell
$ cdk ls
streamlit
streamlit-cognito
streamlit-https-cloudfront

$ cdk deploy streamlit-cognito
(start deploying...)
```

# references

- [ALB + Cognito認証で付与されるユーザー情報をEC2サイドから眺めてみる](https://dev.classmethod.jp/articles/http-headers-added-by-alb-and-cognito-are-explained/)
- [インフラエンジニアが一切コードを書かずにWebサーバーに認証機能を実装した話](https://dev.classmethod.jp/articles/alb-cognito-user-pool/)
- [AWS ALBのルーティングに認証を入れたら500エラーになった時](https://heart-shaped-chocolate.hatenablog.jp/entry/2019/01/30/141159)
