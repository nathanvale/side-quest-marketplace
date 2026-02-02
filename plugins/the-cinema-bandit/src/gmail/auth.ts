/**
 * Gmail OAuth authentication and token management.
 *
 * Handles OAuth 2.0 flow, token storage, and automatic refresh.
 * Uses atomic file writes with 0600 permissions for security.
 * Delegates generic OAuth operations to @sidequest/core/oauth.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	isTokenExpired as coreIsTokenExpired,
	loadTokenFile,
	saveTokenFile,
} from "@side-quest/core/oauth";
import { spawnSyncCollect } from "@side-quest/core/spawn";
import { google } from "googleapis";
import { authLogger } from "../logger.ts";
import { validateCredentials } from "./credentials";
import type { GmailCredentials, GmailToken } from "./types";
import { GmailAuthError } from "./types";

const TOKEN_PATH = path.join(
	os.homedir(),
	".config",
	"the-cinema-bandit",
	"gmail-token.json",
);

const CREDENTIALS_PATH = path.join(
	os.homedir(),
	".config",
	"the-cinema-bandit",
	"credentials.json",
);

/**
 * Generates a cryptographically random state parameter for CSRF protection.
 *
 * @returns Random 64-character hex string
 */
function generateState(): string {
	return crypto.randomBytes(32).toString("hex");
}

/**
 * Finds an available port for the OAuth callback server.
 *
 * Uses Bun.serve with port: 0 to let the OS assign any available port.
 *
 * @returns Available port number
 */
async function findAvailablePort(): Promise<number> {
	const server = Bun.serve({
		port: 0, // Let Bun assign any available port
		fetch() {
			return new Response("test");
		},
	});
	const port = server.port;
	server.stop();
	if (!port) {
		throw new Error("Failed to allocate port for OAuth server");
	}
	return port;
}

/**
 * Opens the system default browser to a URL.
 *
 * Uses platform-specific commands (open/start/xdg-open).
 *
 * @param url - URL to open
 */
function openBrowser(url: string): void {
	const platform = process.platform;
	const cmd =
		platform === "darwin"
			? ["open", url]
			: platform === "win32"
				? ["cmd", "/c", "start", "", url]
				: ["xdg-open", url]; // Linux

	const result = spawnSyncCollect(cmd);
	if (result.exitCode !== 0) {
		console.error(
			"Could not auto-open browser. Please open manually.",
			result.stderr,
		);
	}
}

/**
 * Starts a temporary HTTP server to capture the OAuth callback.
 *
 * Listens for OAuth redirect with authorization code, validates state parameter,
 * and returns the code. Server binds only to 127.0.0.1 for security and shuts
 * down immediately after receiving the callback.
 *
 * @param port - Port to listen on
 * @param expectedState - Expected state parameter for CSRF validation
 * @param timeout - Maximum wait time in milliseconds (default: 5 minutes)
 * @returns Authorization code from OAuth callback
 * @throws {GmailAuthError} If timeout occurs, state is invalid, or OAuth error
 */
async function startOAuthServer(
	port: number,
	expectedState: string,
	timeout = 300000, // 5 minutes
): Promise<string> {
	return new Promise((resolve, reject) => {
		let resolved = false;

		const server = Bun.serve({
			port,
			hostname: "127.0.0.1", // Security: bind only to localhost
			fetch(req) {
				const url = new URL(req.url);

				// Handle OAuth callback
				if (url.pathname === "/" || url.pathname === "/callback") {
					const code = url.searchParams.get("code");
					const state = url.searchParams.get("state");
					const error = url.searchParams.get("error");

					// Handle OAuth errors
					if (error) {
						if (!resolved) {
							resolved = true;
							server.stop();
							reject(
								new GmailAuthError(`OAuth error: ${error}`, "AUTH_FAILED"),
							);
						}
						return new Response(
							"Authorization failed. You can close this window.",
							{
								headers: { "Content-Type": "text/html" },
							},
						);
					}

					// Validate state parameter (CSRF protection)
					if (state !== expectedState) {
						if (!resolved) {
							resolved = true;
							server.stop();
							reject(
								new GmailAuthError("Invalid state parameter", "AUTH_FAILED"),
							);
						}
						return new Response("Invalid state. You can close this window.", {
							headers: { "Content-Type": "text/html" },
						});
					}

					// Extract code
					if (code) {
						if (!resolved) {
							resolved = true;
							server.stop();
							resolve(code);
						}
						return new Response(
							`<!DOCTYPE html>
							<html>
								<head><title>Authorization Successful</title></head>
								<body style="font-family: sans-serif; text-align: center; padding: 50px;">
									<h1>✅ Authorization Successful!</h1>
									<p>You can close this window and return to the terminal.</p>
								</body>
							</html>`,
							{ headers: { "Content-Type": "text/html" } },
						);
					}
				}

				return new Response("Not found", { status: 404 });
			},
		});

		// Timeout handler
		setTimeout(() => {
			if (!resolved) {
				resolved = true;
				server.stop();
				reject(
					new GmailAuthError("OAuth timeout after 5 minutes", "AUTH_FAILED"),
				);
			}
		}, timeout);
	});
}

/**
 * Reads and validates Gmail OAuth credentials.
 *
 * @returns Validated Gmail credentials
 * @throws {GmailAuthError} If credentials file is missing or invalid
 */
export function loadCredentials(): GmailCredentials {
	if (!fs.existsSync(CREDENTIALS_PATH)) {
		authLogger.error("Credentials file not found", { path: CREDENTIALS_PATH });
		throw new GmailAuthError(
			`Credentials not found at ${CREDENTIALS_PATH}. ` +
				"Download credentials.json from Google Cloud Console.",
			"INVALID_CREDENTIALS",
		);
	}

	const content = fs.readFileSync(CREDENTIALS_PATH, "utf8");
	const credentials = JSON.parse(content);

	validateCredentials(credentials);

	authLogger.debug("Credentials loaded successfully", {
		path: CREDENTIALS_PATH,
	});
	return credentials.installed;
}

/**
 * Loads existing token from disk.
 *
 * Delegates to @sidequest/core/oauth for generic token persistence.
 *
 * @returns Stored token if exists and valid, null otherwise
 */
export function loadToken(): GmailToken | null {
	const token = loadTokenFile(TOKEN_PATH);
	if (token) {
		authLogger.debug("Token loaded from disk", { path: TOKEN_PATH });
	} else {
		authLogger.debug("Token file not found", { path: TOKEN_PATH });
	}
	return token as GmailToken | null;
}

/**
 * Saves token to disk with atomic write and 0600 permissions.
 *
 * Delegates to @sidequest/core/oauth for generic token persistence.
 * Uses temp file → rename pattern to ensure atomicity.
 * Sets restrictive permissions (0600) for security.
 *
 * @param token - Token to save
 */
export function saveToken(token: GmailToken): void {
	saveTokenFile(TOKEN_PATH, token);
	authLogger.debug("Token saved to disk", { path: TOKEN_PATH });
}

/**
 * Checks if a token is expired or about to expire.
 *
 * Delegates to @sidequest/core/oauth for generic expiry checking.
 * Considers a token expired if it expires within the next 5 minutes
 * to prevent edge cases during API calls.
 *
 * @param token - Token to check
 * @returns true if token is expired or about to expire
 */
export function isTokenExpired(token: GmailToken): boolean {
	const expired = coreIsTokenExpired(token);
	if (expired) {
		authLogger.debug("Token is expired or expiring soon", {
			expiresAt: new Date(token.expiry_date).toISOString(),
		});
	}
	return expired;
}

/**
 * Refreshes an expired access token.
 *
 * Uses the refresh_token to obtain a new access_token without
 * requiring user interaction.
 *
 * @param credentials - Gmail OAuth credentials
 * @param token - Current token with refresh_token
 * @returns New token with updated access_token and expiry
 */
export async function refreshToken(
	credentials: GmailCredentials,
	token: GmailToken,
): Promise<GmailToken> {
	authLogger.debug("Refreshing access token");

	// Guard: ensure refresh_token exists before attempting refresh
	if (!token.refresh_token) {
		authLogger.error("No refresh_token available for token refresh", {
			hasAccessToken: !!token.access_token,
		});
		throw new GmailAuthError(
			"Cannot refresh token: refresh_token is missing. " +
				"Delete ~/.config/the-cinema-bandit/gmail-token.json and re-authorize.",
			"INVALID_TOKEN",
		);
	}

	const oauth2Client = new google.auth.OAuth2(
		credentials.client_id,
		credentials.client_secret,
		credentials.redirect_uris[0],
	);

	oauth2Client.setCredentials({
		refresh_token: token.refresh_token,
	});

	try {
		const { credentials: newCreds } = await oauth2Client.refreshAccessToken();

		const newToken: GmailToken = {
			access_token: newCreds.access_token!,
			refresh_token: token.refresh_token, // Keep existing refresh token
			scope: newCreds.scope!,
			token_type: newCreds.token_type!,
			expiry_date: newCreds.expiry_date!,
		};

		saveToken(newToken);
		authLogger.info("Token refreshed successfully", {
			expiresAt: new Date(newCreds.expiry_date!).toISOString(),
		});
		return newToken;
	} catch (error) {
		authLogger.error("Failed to refresh token", { error });
		throw new GmailAuthError(
			`Failed to refresh token: ${error}`,
			"TOKEN_EXPIRED",
		);
	}
}

/**
 * Initiates OAuth consent flow using loopback IP address flow.
 *
 * Starts a temporary local HTTP server, opens browser to Google OAuth consent
 * screen, and automatically captures the authorization code from the redirect.
 * Uses Bun's native HTTP server for the callback handler.
 *
 * @param credentials - Gmail OAuth credentials
 * @returns New token with access and refresh tokens
 */
export async function authorizeNewToken(
	credentials: GmailCredentials,
): Promise<GmailToken> {
	authLogger.debug("Starting OAuth authorization flow");

	// Find available port
	const port = await findAvailablePort();
	const redirectUri = `http://127.0.0.1:${port}`;
	authLogger.debug("OAuth server starting", { port, redirectUri });

	// Generate state for CSRF protection
	const state = generateState();

	const oauth2Client = new google.auth.OAuth2(
		credentials.client_id,
		credentials.client_secret,
		redirectUri, // Use dynamic redirect URI
	);

	const authUrl = oauth2Client.generateAuthUrl({
		access_type: "offline",
		prompt: "consent", // Force consent screen every time to ensure refresh_token
		scope: ["https://www.googleapis.com/auth/gmail.send"],
		state, // Include state parameter
	});

	console.log("\n🔐 Gmail Authorization Required");
	console.log("================================");
	console.log("\n1. Browser will open automatically to:");
	console.log(`   ${authUrl}\n`);
	console.log("2. Approve the permissions");
	console.log("3. You'll be redirected back automatically\n");
	console.log("Waiting for authorization...");

	// Auto-open browser
	openBrowser(authUrl);
	authLogger.debug("Opening browser for OAuth consent");

	// Start local server and wait for callback
	let code: string;
	try {
		code = await startOAuthServer(port, state);
		authLogger.debug("Authorization code received");
	} catch (error) {
		authLogger.error("OAuth server error", { error });
		throw new GmailAuthError(`Authorization failed: ${error}`, "AUTH_FAILED");
	}

	// Exchange code for tokens
	try {
		const { tokens } = await oauth2Client.getToken(code);

		// Guard: ensure refresh_token is present (required for offline access)
		if (!tokens.refresh_token) {
			authLogger.error("No refresh_token in authorization response", {
				availableKeys: Object.keys(tokens),
			});
			throw new GmailAuthError(
				"Authorization failed: no refresh_token returned. " +
					"This usually means you already approved the app on this account. " +
					"To fix: revoke the app in Google account settings and try again.",
				"INVALID_TOKEN",
			);
		}

		const newToken: GmailToken = {
			access_token: tokens.access_token!,
			refresh_token: tokens.refresh_token,
			scope: tokens.scope!,
			token_type: tokens.token_type!,
			expiry_date: tokens.expiry_date!,
		};

		saveToken(newToken);
		authLogger.info("Authorization successful", {
			expiresAt: new Date(tokens.expiry_date!).toISOString(),
		});
		console.log("\n✅ Authorization successful! Token saved.\n");
		return newToken;
	} catch (error) {
		authLogger.error("Failed to exchange authorization code", { error });
		throw new GmailAuthError(
			`Failed to exchange authorization code: ${error}`,
			"AUTH_FAILED",
		);
	}
}

/**
 * Gets a valid OAuth2 client, refreshing token if needed.
 *
 * Loads existing token, checks expiry, refreshes if needed.
 * If no token exists, initiates OAuth consent flow.
 *
 * @returns Authenticated OAuth2 client ready for Gmail API calls
 */
export async function getAuthenticatedClient() {
	authLogger.debug("Getting authenticated Gmail client");

	const credentials = loadCredentials();
	let token = loadToken();

	if (!token) {
		// No token - need to authorize
		authLogger.debug("No token found, initiating OAuth flow");
		token = await authorizeNewToken(credentials);
	} else if (isTokenExpired(token)) {
		// Token expired - refresh it
		authLogger.debug("Token expired, refreshing");
		token = await refreshToken(credentials, token);
	} else {
		authLogger.debug("Using existing valid token");
	}

	const oauth2Client = new google.auth.OAuth2(
		credentials.client_id,
		credentials.client_secret,
		credentials.redirect_uris[0],
	);

	oauth2Client.setCredentials({
		access_token: token.access_token,
		refresh_token: token.refresh_token,
		expiry_date: token.expiry_date,
		token_type: token.token_type,
		scope: token.scope,
	});

	authLogger.info("Authenticated Gmail client ready");
	return oauth2Client;
}
