export interface IWafv2Stack {
	/** Maximum number of bytes allowed in the URI component of the HTTP request. Generally the maximum possible value is determined by the server operating system (maps to file system paths), the web server software, or other middleware components. Choose a value that accomodates the largest URI segment you use in practice in your web application. */
	maxExpectedURISize: number
	/** Maximum number of bytes allowed in the query string component of the HTTP request. Normally the  of query string parameters following the "?" in a URL is much larger than the URI , but still bounded by the  of the parameters your web application uses and their values. */
	maxExpectedQueryStringSize: number
	/** Maximum number of bytes allowed in the body of the request. If you do not plan to allow large uploads, set it to the largest payload value that makes sense for your web application. Accepting unnecessarily large values can cause performance issues, if large payloads are used as an attack vector against your web application. */
    maxExpectedBodySize: number
	/** Maximum number of bytes allowed in the cookie header. The maximum size should be less than 4096, the size is determined by the amount of information your web application stores in cookies. If you only pass a session token via cookies, set the size to no larger than the serialized size of the session token and cookie metadata. */
    maxExpectedCookieSize: number
	/** The custom HTTP request header, where the CSRF token value is expected to be encountered */
    csrfExpectedHeader: string
	/** The size in bytes of the CSRF token value. For example if it's a canonically formatted UUIDv4 value the expected size would be 36 bytes/ASCII characters */
    csrfExpectedSize: number
}


export const defaultWafv2Value: IWafv2Stack = {
	maxExpectedURISize: 512,
	maxExpectedQueryStringSize: 4096,
	maxExpectedBodySize: 4096,
	maxExpectedCookieSize: 4096,
	csrfExpectedHeader: 'x-csrf-token',
	csrfExpectedSize: 36,
}
