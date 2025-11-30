/**
 * Gmail OAuth credential validation.
 *
 * Validates credentials.json structure before attempting OAuth flow.
 * Prevents runtime errors from malformed credentials.
 */

import type { GmailCredentials } from "./types";
import { GmailAuthError } from "./types";

/**
 * Validates Gmail OAuth credentials structure.
 *
 * Ensures all required fields are present and properly formatted
 * before attempting to use them in the OAuth flow.
 *
 * @param credentials - Raw credentials object from credentials.json
 * @throws {GmailAuthError} If credentials are invalid or missing required fields
 */
export function validateCredentials(
	credentials: unknown,
): asserts credentials is { installed: GmailCredentials } {
	if (!credentials || typeof credentials !== "object") {
		throw new GmailAuthError(
			"Credentials must be an object",
			"INVALID_CREDENTIALS",
		);
	}

	const creds = credentials as Record<string, unknown>;

	if (!("installed" in creds)) {
		throw new GmailAuthError(
			'Credentials must have "installed" key (Desktop application type)',
			"INVALID_CREDENTIALS",
		);
	}

	const installed = creds.installed;
	if (!installed || typeof installed !== "object") {
		throw new GmailAuthError(
			'"installed" must be an object',
			"INVALID_CREDENTIALS",
		);
	}

	const installedObj = installed as Record<string, unknown>;

	// Validate required fields
	const requiredFields = [
		"client_id",
		"client_secret",
		"redirect_uris",
		"auth_uri",
		"token_uri",
	];

	for (const field of requiredFields) {
		if (!(field in installedObj)) {
			throw new GmailAuthError(
				`Missing required field: ${field}`,
				"INVALID_CREDENTIALS",
			);
		}
	}

	// Validate redirect_uris is an array
	if (!Array.isArray(installedObj.redirect_uris)) {
		throw new GmailAuthError(
			"redirect_uris must be an array",
			"INVALID_CREDENTIALS",
		);
	}

	// Validate string fields
	const stringFields = ["client_id", "client_secret", "auth_uri", "token_uri"];
	for (const field of stringFields) {
		if (typeof installedObj[field] !== "string") {
			throw new GmailAuthError(
				`${field} must be a string`,
				"INVALID_CREDENTIALS",
			);
		}
	}
}
