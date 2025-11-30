/**
 * Gmail API integration types for the-cinema-bandit plugin.
 *
 * Defines OAuth credentials, tokens, and error types for Gmail API communication.
 */

/**
 * OAuth 2.0 credentials from Google Cloud Console.
 *
 * Obtained by creating OAuth 2.0 Client ID (Desktop application type)
 * in Google Cloud Console with Gmail API enabled.
 */
export interface GmailCredentials {
	client_id: string;
	client_secret: string;
	redirect_uris: string[];
	auth_uri: string;
	token_uri: string;
}

/**
 * OAuth access token with refresh capability.
 *
 * Stored locally after initial OAuth consent flow.
 * Automatically refreshed when expired using refresh_token.
 */
export interface GmailToken {
	access_token: string;
	refresh_token: string;
	scope: string;
	token_type: string;
	expiry_date: number; // Unix timestamp in milliseconds
}

/**
 * Gmail authentication errors.
 */
export class GmailAuthError extends Error {
	constructor(
		message: string,
		public code:
			| "INVALID_CREDENTIALS"
			| "TOKEN_EXPIRED"
			| "AUTH_FAILED"
			| "INVALID_TOKEN",
	) {
		super(message);
		this.name = "GmailAuthError";
	}
}

/**
 * Gmail send operation errors.
 */
export class GmailSendError extends Error {
	constructor(
		message: string,
		public code: "SEND_FAILED" | "INVALID_EMAIL",
	) {
		super(message);
		this.name = "GmailSendError";
	}
}
