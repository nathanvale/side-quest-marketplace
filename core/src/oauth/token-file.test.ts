import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	isTokenExpired,
	loadTokenFile,
	saveTokenFile,
	validateOAuthCredentials,
} from "./token-file";
import type { OAuthCredentials, OAuthToken } from "./types";

function makeTmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "oauth-test-"));
}

function cleanupDir(dir: string): void {
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

describe("loadTokenFile", () => {
	let tmpDir: string;

	afterEach(() => {
		if (tmpDir) cleanupDir(tmpDir);
	});

	it("returns null if file doesn't exist", () => {
		tmpDir = makeTmpDir();
		const tokenPath = path.join(tmpDir, "nonexistent.json");
		expect(loadTokenFile(tokenPath)).toBeNull();
	});

	it("loads valid token from disk", () => {
		tmpDir = makeTmpDir();
		const tokenPath = path.join(tmpDir, "token.json");
		const token: OAuthToken = {
			access_token: "ya29.test",
			refresh_token: "1//test",
			scope: "https://example.com/scope",
			token_type: "Bearer",
			expiry_date: Date.now() + 3600000,
		};

		fs.writeFileSync(tokenPath, JSON.stringify(token), "utf8");

		const loaded = loadTokenFile(tokenPath);
		expect(loaded).toEqual(token);
	});

	it("returns null if token file is malformed", () => {
		tmpDir = makeTmpDir();
		const tokenPath = path.join(tmpDir, "bad-token.json");

		fs.writeFileSync(tokenPath, "not valid json {", "utf8");

		expect(loadTokenFile(tokenPath)).toBeNull();
	});
});

describe("saveTokenFile", () => {
	let tmpDir: string;

	afterEach(() => {
		if (tmpDir) cleanupDir(tmpDir);
	});

	it("saves token with atomic write", () => {
		tmpDir = makeTmpDir();
		const tokenPath = path.join(tmpDir, "token.json");
		const token: OAuthToken = {
			access_token: "ya29.atomic",
			refresh_token: "1//atomic",
			scope: "https://example.com/scope",
			token_type: "Bearer",
			expiry_date: Date.now() + 3600000,
		};

		saveTokenFile(tokenPath, token);

		expect(fs.existsSync(tokenPath)).toBe(true);
		const loaded = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
		expect(loaded).toEqual(token);
	});

	it("creates parent directories if missing", () => {
		tmpDir = makeTmpDir();
		const tokenPath = path.join(tmpDir, "subdir", "nested", "token.json");
		const token: OAuthToken = {
			access_token: "ya29.nested",
			refresh_token: "1//nested",
			scope: "https://example.com/scope",
			token_type: "Bearer",
			expiry_date: Date.now() + 3600000,
		};

		saveTokenFile(tokenPath, token);

		expect(fs.existsSync(tokenPath)).toBe(true);
	});

	it("sets restrictive permissions (0o600)", () => {
		tmpDir = makeTmpDir();
		const tokenPath = path.join(tmpDir, "secure-token.json");
		const token: OAuthToken = {
			access_token: "ya29.secure",
			refresh_token: "1//secure",
			scope: "https://example.com/scope",
			token_type: "Bearer",
			expiry_date: Date.now() + 3600000,
		};

		saveTokenFile(tokenPath, token);

		const stats = fs.statSync(tokenPath);
		const mode = (stats.mode ?? 0) & 0o777; // Extract permission bits
		expect(mode).toBe(0o600);
	});

	it("overwrites existing token atomically", () => {
		tmpDir = makeTmpDir();
		const tokenPath = path.join(tmpDir, "token.json");

		const token1: OAuthToken = {
			access_token: "first",
			refresh_token: "1//first",
			scope: "scope1",
			token_type: "Bearer",
			expiry_date: Date.now() + 3600000,
		};

		const token2: OAuthToken = {
			access_token: "second",
			refresh_token: "1//second",
			scope: "scope2",
			token_type: "Bearer",
			expiry_date: Date.now() + 7200000,
		};

		saveTokenFile(tokenPath, token1);
		saveTokenFile(tokenPath, token2);

		const loaded = loadTokenFile(tokenPath);
		expect(loaded).toEqual(token2);
	});

	it("cleans up temp file after successful write", () => {
		tmpDir = makeTmpDir();
		const tokenPath = path.join(tmpDir, "token.json");
		const token: OAuthToken = {
			access_token: "ya29.cleanup",
			refresh_token: "1//cleanup",
			scope: "https://example.com/scope",
			token_type: "Bearer",
			expiry_date: Date.now() + 3600000,
		};

		saveTokenFile(tokenPath, token);

		// Verify no .tmp files remain
		const files = fs.readdirSync(tmpDir);
		const tmpFiles = files.filter((f) => f.endsWith(".tmp"));
		expect(tmpFiles.length).toBe(0);
	});
});

describe("isTokenExpired", () => {
	it("returns false for valid token with default buffer", () => {
		const token: OAuthToken = {
			access_token: "ya29.valid",
			refresh_token: "1//valid",
			scope: "https://example.com/scope",
			token_type: "Bearer",
			expiry_date: Date.now() + 10 * 60 * 1000, // 10 minutes from now
		};

		expect(isTokenExpired(token)).toBe(false);
	});

	it("returns true for expired token", () => {
		const token: OAuthToken = {
			access_token: "ya29.expired",
			refresh_token: "1//expired",
			scope: "https://example.com/scope",
			token_type: "Bearer",
			expiry_date: Date.now() - 1000, // 1 second ago
		};

		expect(isTokenExpired(token)).toBe(true);
	});

	it("returns true for token expiring within default buffer (5 minutes)", () => {
		const token: OAuthToken = {
			access_token: "ya29.soon",
			refresh_token: "1//soon",
			scope: "https://example.com/scope",
			token_type: "Bearer",
			expiry_date: Date.now() + 3 * 60 * 1000, // 3 minutes from now
		};

		expect(isTokenExpired(token)).toBe(true);
	});

	it("respects custom buffer time", () => {
		const token: OAuthToken = {
			access_token: "ya29.custom",
			refresh_token: "1//custom",
			scope: "https://example.com/scope",
			token_type: "Bearer",
			expiry_date: Date.now() + 30 * 1000, // 30 seconds from now
		};

		// With 1 minute buffer, should be considered expired
		expect(isTokenExpired(token, 60 * 1000)).toBe(true);

		// With 10 second buffer, should be valid
		expect(isTokenExpired(token, 10 * 1000)).toBe(false);
	});

	it("handles zero buffer correctly", () => {
		const token: OAuthToken = {
			access_token: "ya29.zero",
			refresh_token: "1//zero",
			scope: "https://example.com/scope",
			token_type: "Bearer",
			expiry_date: Date.now() + 1000, // 1 second from now
		};

		expect(isTokenExpired(token, 0)).toBe(false);
	});
});

describe("validateOAuthCredentials", () => {
	it("validates correct credentials structure", () => {
		const creds: OAuthCredentials = {
			client_id: "test-client-id",
			client_secret: "test-secret",
			redirect_uris: ["http://localhost:8080/callback"],
			auth_uri: "https://oauth.example.com/auth",
			token_uri: "https://oauth.example.com/token",
		};

		expect(() => validateOAuthCredentials(creds)).not.toThrow();
	});

	it("throws if credentials is not an object", () => {
		expect(() => validateOAuthCredentials(null)).toThrow(
			"Credentials must be an object",
		);
		expect(() => validateOAuthCredentials("not an object")).toThrow(
			"Credentials must be an object",
		);
	});

	it("throws if required field is missing", () => {
		const creds = {
			client_id: "test-id",
			// missing client_secret
			redirect_uris: ["http://localhost:8080"],
			auth_uri: "https://oauth.example.com/auth",
			token_uri: "https://oauth.example.com/token",
		};

		expect(() => validateOAuthCredentials(creds)).toThrow(
			"Missing required field: client_secret",
		);
	});

	it("throws if redirect_uris is not an array", () => {
		const creds = {
			client_id: "test-id",
			client_secret: "test-secret",
			redirect_uris: "http://localhost:8080", // Should be array
			auth_uri: "https://oauth.example.com/auth",
			token_uri: "https://oauth.example.com/token",
		};

		expect(() => validateOAuthCredentials(creds)).toThrow(
			"redirect_uris must be an array",
		);
	});

	it("throws if string field is not a string", () => {
		const creds = {
			client_id: 12345, // Should be string
			client_secret: "test-secret",
			redirect_uris: ["http://localhost:8080"],
			auth_uri: "https://oauth.example.com/auth",
			token_uri: "https://oauth.example.com/token",
		};

		expect(() => validateOAuthCredentials(creds)).toThrow(
			"client_id must be a string",
		);
	});

	it("supports custom required fields", () => {
		const creds = {
			client_id: "test-id",
			client_secret: "test-secret",
		};

		// Validate only these two fields
		expect(() =>
			validateOAuthCredentials(creds, ["client_id", "client_secret"]),
		).not.toThrow();

		// Default validation should fail (missing redirect_uris, etc)
		expect(() => validateOAuthCredentials(creds)).toThrow();
	});
});
