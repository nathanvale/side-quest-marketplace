/**
 * Gmail API integration types for the-cinema-bandit plugin.
 *
 * Defines OAuth credentials, tokens, and error types for Gmail API communication.
 * Re-exports generic OAuth types from @sidequest/core/oauth for consistency.
 */

import type { OAuthCredentials, OAuthToken } from "@side-quest/core/oauth";

/**
 * OAuth 2.0 credentials from Google Cloud Console.
 *
 * Obtained by creating OAuth 2.0 Client ID (Desktop application type)
 * in Google Cloud Console with Gmail API enabled.
 *
 * Note: This is an alias of OAuthCredentials for Gmail-specific usage.
 */
export type GmailCredentials = OAuthCredentials;

/**
 * OAuth access token with refresh capability.
 *
 * Stored locally after initial OAuth consent flow.
 * Automatically refreshed when expired using refresh_token.
 *
 * Note: This is an alias of OAuthToken for Gmail-specific usage.
 */
export type GmailToken = OAuthToken;

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
