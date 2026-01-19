/**
 * Path safety and validation utilities
 *
 * Provides utilities to prevent path traversal attacks, symlink attacks,
 * and ReDoS attacks when handling user-provided file paths and patterns.
 *
 * @module fs/safety
 */

import { realpathSync } from "node:fs";
import { dirname, normalize, resolve } from "node:path";
import { pathExistsSync } from "./index.js";

/**
 * Validate file path to prevent path traversal and other security issues.
 *
 * Ensures the path is:
 * - Relative (not absolute)
 * - Does not contain ".." (path traversal)
 * - Does not contain hidden files (starting with ".")
 *
 * @param inputPath - Path to validate
 * @returns Normalized path if valid
 * @throws Error if path contains unsafe patterns
 *
 * @example
 * ```ts
 * const path = validateFilePath('Templates/invoice.md'); // OK
 * validateFilePath('../../../etc/passwd'); // throws - path traversal
 * validateFilePath('.hidden'); // throws - hidden file
 * validateFilePath('/absolute/path'); // throws - absolute path
 * ```
 */
export function validateFilePath(inputPath: string): string {
	const normalized = normalize(inputPath);

	// Prevent absolute paths
	if (normalized.startsWith("/")) {
		throw new Error(`Path must be relative (got: ${inputPath})`);
	}

	// Prevent path traversal
	if (normalized.includes("..")) {
		throw new Error(`Path traversal not allowed (got: ${inputPath})`);
	}

	// Prevent hidden files (common security risk)
	const parts = normalized.split("/");
	for (const part of parts) {
		if (part.startsWith(".")) {
			throw new Error(`Hidden files not allowed (got: ${inputPath})`);
		}
	}

	return normalized;
}

/**
 * Validate that a path is safe and doesn't escape the root boundary.
 *
 * Uses realpath canonicalization to prevent symlink-based path traversal attacks.
 * This defends against attackers creating symlinks that escape the root boundary.
 *
 * @param inputPath - Path to validate (relative or absolute)
 * @param rootPath - The root path that inputPath must stay within
 * @throws Error if path contains unsafe patterns or escapes root
 *
 * @example
 * ```ts
 * validatePathSafety('00 Inbox/note.md', '/vault'); // OK
 * validatePathSafety('../../etc/passwd', '/vault'); // throws - path traversal
 * validatePathSafety('~/secrets', '/vault'); // throws - unsafe pattern
 * ```
 */
export function validatePathSafety(inputPath: string, rootPath: string): void {
	// Reject suspicious patterns immediately
	if (
		inputPath.includes("..") ||
		inputPath.includes("~") ||
		(inputPath.startsWith("/") && !inputPath.startsWith(rootPath))
	) {
		throw new Error(`Unsafe path pattern: "${inputPath}"`);
	}

	// Resolve symbolic links and normalize paths to prevent symlink attacks
	const resolved = resolve(rootPath, inputPath);
	const rootResolved = resolve(rootPath);

	// Canonicalize paths using realpath if they exist
	// This prevents symlink-based path traversal (e.g., symlink pointing outside root)
	let canonicalResolved = resolved;
	let canonicalRoot = rootResolved;

	try {
		// Try to canonicalize root path (should always exist)
		canonicalRoot = realpathSync(rootResolved);
	} catch {
		// Root doesn't exist - use resolved path (safe for validation)
	}

	try {
		// Try to canonicalize destination (may not exist yet)
		// Walk up to find existing parent and canonicalize from there
		let current = resolved;
		while (!pathExistsSync(current) && current !== rootResolved) {
			current = dirname(current);
		}
		if (pathExistsSync(current)) {
			const canonicalParent = realpathSync(current);
			const relativeSuffix = resolved.slice(current.length);
			canonicalResolved = canonicalParent + relativeSuffix;
		}
	} catch {
		// Path doesn't exist yet - use resolved path (creation will fail if symlink attack)
	}

	// Check boundary using canonicalized paths
	if (
		!canonicalResolved.startsWith(`${canonicalRoot}/`) &&
		canonicalResolved !== canonicalRoot
	) {
		throw new Error(
			`Path traversal detected: "${inputPath}" escapes root boundary`,
		);
	}
}

/**
 * Sanitize regex pattern string to prevent ReDoS (Regular Expression Denial of Service).
 *
 * Removes dangerous regex patterns that could cause exponential backtracking
 * and limits pattern length to prevent resource exhaustion.
 *
 * @param pattern - Regex pattern to sanitize
 * @returns Sanitized pattern
 *
 * @example
 * ```ts
 * const safe = sanitizePattern('medical.*bill'); // OK
 * const safe2 = sanitizePattern('(a+)+'); // Removes nested quantifiers
 * const safe3 = sanitizePattern('x'.repeat(600)); // Truncates to 500 chars
 * ```
 */
export function sanitizePattern(pattern: string): string {
	// Remove potentially dangerous patterns
	let clean = pattern;

	// Remove nested quantifiers (e.g., (a+)+, (a*)*) - ReDoS risk
	clean = clean.replace(/\([^)]*[+*][^)]*\)[+*]/g, "");

	// Limit pattern length to prevent resource exhaustion
	if (clean.length > 500) {
		clean = clean.substring(0, 500);
	}

	return clean;
}
