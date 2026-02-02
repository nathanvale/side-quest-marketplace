/**
 * Generic OAuth 2.0 types for token management.
 *
 * These types are provider-agnostic and can be used with any OAuth 2.0
 * implementation (Google, GitHub, Microsoft, etc.).
 */

/**
 * OAuth 2.0 credentials from provider's developer console.
 *
 * Typically obtained by creating an OAuth 2.0 Client ID in the provider's
 * developer console (e.g., Google Cloud Console, GitHub Apps, etc.).
 */
export interface OAuthCredentials {
	/** OAuth client ID */
	client_id: string;
	/** OAuth client secret */
	client_secret: string;
	/** Authorized redirect URIs */
	redirect_uris: string[];
	/** Authorization endpoint URL */
	auth_uri: string;
	/** Token endpoint URL */
	token_uri: string;
}

/**
 * OAuth 2.0 access token with refresh capability.
 *
 * Stored locally after initial OAuth consent flow.
 * Can be automatically refreshed when expired using refresh_token.
 */
export interface OAuthToken {
	/** Access token for API requests */
	access_token: string;
	/** Refresh token for obtaining new access tokens */
	refresh_token: string;
	/** Space-delimited list of granted scopes */
	scope: string;
	/** Token type (usually "Bearer") */
	token_type: string;
	/** Expiration time as Unix timestamp in milliseconds */
	expiry_date: number;
}
