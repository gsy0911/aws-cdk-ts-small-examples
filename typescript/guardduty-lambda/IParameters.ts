export interface IParameters {
	dnsLogName: string
	hostedZoneId: string
}


export const defaultParams: IParameters = {
	dnsLogName: "/aws/route53/example.com",
	hostedZoneId: "Zxxxxxxxxxxxxxxxxxxxx"
}
