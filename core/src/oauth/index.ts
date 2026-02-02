/**
 * OAuth 2.0 token management utilities.
 *
 * Provider-agnostic utilities for OAuth token persistence, expiry checking,
 * and credential validation. Supports any OAuth 2.0 provider (Google, GitHub,
 * Microsoft, etc.).
 *
 * ## Features
 *
 * - **Secure Token Storage**: Atomic writes with 0o600 permissions
 * - **Expiry Management**: Buffer-based expiry checking to prevent mid-request failures
 * - **Credential Validation**: Type-safe validation with descriptive errors
 * - **Cross-Platform**: Works on macOS, Linux, and Windows
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   loadTokenFile,
 *   saveTokenFile,
 *   isTokenExpired,
 *   validateOAuthCredentials
 * } from "@sidequest/core/oauth";
 *
 * // Load existing token
 * const token = loadTokenFile("~/.config/myapp/token.json");
 *
 * // Check if expired (with 5 minute buffer)
 * if (token && isTokenExpired(token)) {
 *   // Refresh token using provider-specific API
 *   const newToken = await refreshTokenWithProvider(token);
 *   saveTokenFile("~/.config/myapp/token.json", newToken);
 * }
 *
 * // Validate credentials
 * const creds = JSON.parse(fs.readFileSync("credentials.json", "utf8"));
 * validateOAuthCredentials(creds); // Throws if invalid
 * ```
 *
 * @module oauth
 */

export {
	isTokenExpired,
	loadTokenFile,
	saveTokenFile,
	validateOAuthCredentials,
} from "./token-file.ts";
export type { OAuthCredentials, OAuthToken } from "./types.ts";
