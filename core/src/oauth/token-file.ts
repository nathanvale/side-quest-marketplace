/**
 * OAuth token file persistence utilities.
 *
 * Provides secure token storage with atomic writes and restrictive permissions.
 * Uses temp file → rename pattern to prevent corruption.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { OAuthCredentials, OAuthToken } from "./types.ts";

/**
 * Loads an OAuth token from disk.
 *
 * Returns null if the file doesn't exist or can't be parsed,
 * allowing callers to handle missing tokens gracefully.
 *
 * @param tokenPath - Path to token file
 * @returns Parsed token if exists and valid, null otherwise
 *
 * @example
 * ```typescript
 * const token = loadTokenFile("~/.config/myapp/token.json");
 * if (!token) {
 *   console.log("No token found, need to authorize");
 * }
 * ```
 */
export function loadTokenFile(tokenPath: string): OAuthToken | null {
	if (!fs.existsSync(tokenPath)) {
		return null;
	}

	try {
		const content = fs.readFileSync(tokenPath, "utf8");
		return JSON.parse(content) as OAuthToken;
	} catch {
		return null;
	}
}

/**
 * Saves an OAuth token to disk with atomic write and secure permissions.
 *
 * Uses temp file → rename pattern to ensure atomicity and prevent
 * corruption from crashes or concurrent writes. Sets restrictive
 * permissions (0o600) to protect sensitive token data.
 *
 * Creates parent directories if they don't exist.
 *
 * @param tokenPath - Path where token should be saved
 * @param token - Token to save
 *
 * @example
 * ```typescript
 * saveTokenFile("~/.config/myapp/token.json", {
 *   access_token: "ya29.xxx",
 *   refresh_token: "1//xxx",
 *   scope: "https://www.googleapis.com/auth/gmail.send",
 *   token_type: "Bearer",
 *   expiry_date: Date.now() + 3600000
 * });
 * ```
 */
export function saveTokenFile(tokenPath: string, token: OAuthToken): void {
	const dir = path.dirname(tokenPath);

	// Ensure directory exists with secure permissions
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	}

	// Atomic write: temp file → rename
	const tempPath = `${tokenPath}.tmp`;
	fs.writeFileSync(tempPath, JSON.stringify(token, null, 2), {
		mode: 0o600, // Security: owner read/write only
	});
	fs.renameSync(tempPath, tokenPath);
}

/**
 * Checks if an OAuth token is expired or about to expire.
 *
 * Considers a token expired if it expires within the buffer window
 * to prevent edge cases during API calls where the token expires
 * mid-request.
 *
 * @param token - Token to check
 * @param bufferMs - Buffer time in milliseconds (default: 5 minutes)
 * @returns true if token is expired or expiring within buffer window
 *
 * @example
 * ```typescript
 * const token = loadTokenFile("~/.config/myapp/token.json");
 * if (token && isTokenExpired(token)) {
 *   // Refresh the token
 *   token = await refreshToken(token);
 * }
 * ```
 */
export function isTokenExpired(
	token: OAuthToken,
	bufferMs = 5 * 60 * 1000, // 5 minutes default
): boolean {
	const now = Date.now();
	return token.expiry_date <= now + bufferMs;
}

/**
 * Validates OAuth credentials structure.
 *
 * Ensures all required fields are present and properly formatted
 * before attempting to use them in an OAuth flow. Throws descriptive
 * errors to help with debugging credential issues.
 *
 * @param credentials - Raw credentials object to validate
 * @param requiredFields - Fields to validate (default: all standard OAuth fields)
 * @throws {Error} If credentials are invalid or missing required fields
 *
 * @example
 * ```typescript
 * const creds = JSON.parse(fs.readFileSync("credentials.json", "utf8"));
 * try {
 *   validateOAuthCredentials(creds);
 * } catch (error) {
 *   console.error("Invalid credentials:", error.message);
 * }
 * ```
 */
export function validateOAuthCredentials(
	credentials: unknown,
	requiredFields: string[] = [
		"client_id",
		"client_secret",
		"redirect_uris",
		"auth_uri",
		"token_uri",
	],
): asserts credentials is OAuthCredentials {
	if (!credentials || typeof credentials !== "object") {
		throw new Error("Credentials must be an object");
	}

	const creds = credentials as Record<string, unknown>;

	// Validate required fields exist
	for (const field of requiredFields) {
		if (!(field in creds)) {
			throw new Error(`Missing required field: ${field}`);
		}
	}

	// Validate redirect_uris is an array
	if ("redirect_uris" in creds && !Array.isArray(creds.redirect_uris)) {
		throw new Error("redirect_uris must be an array");
	}

	// Validate string fields
	const stringFields = ["client_id", "client_secret", "auth_uri", "token_uri"];
	for (const field of stringFields) {
		if (field in creds && typeof creds[field] !== "string") {
			throw new Error(`${field} must be a string`);
		}
	}
}
