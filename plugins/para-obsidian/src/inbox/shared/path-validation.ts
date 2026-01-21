/**
 * Path validation utilities for inbox processing.
 *
 * Provides security-hardened path validation to prevent:
 * - Path traversal attacks (../ escaping vault boundary)
 * - Subprocess injection (invalid characters in filenames)
 * - TOCTOU vulnerabilities (eliminated in calling code)
 *
 * @module inbox/shared/path-validation
 */

import { resolve } from "node:path";
import { validateFilenameForSubprocess as coreValidateFilename } from "@sidequest/core/fs";

/**
 * Validates that a file path is safe for inbox processing.
 * Prevents path traversal attacks by ensuring the path stays within vault boundaries.
 *
 * Security guarantees:
 * - Path must be within or equal to vaultPath
 * - No ".." components allowed in relative path
 * - No absolute path references outside vault
 *
 * @param filePath - File path to validate (absolute or relative)
 * @param vaultPath - Vault root path (absolute)
 * @returns Normalized absolute path within vault
 * @throws Error if path escapes vault boundary or contains suspicious patterns
 *
 * @example
 * ```typescript
 * // Valid paths
 * validateInboxPath("/vault/00 Inbox/note.md", "/vault")
 * // → "/vault/00 Inbox/note.md"
 *
 * // Invalid: path traversal
 * validateInboxPath("/vault/../etc/passwd", "/vault")
 * // → throws Error
 *
 * // Invalid: relative traversal
 * validateInboxPath("/vault/Inbox/../../etc/passwd", "/vault")
 * // → throws Error
 * ```
 */
export function validateInboxPath(filePath: string, vaultPath: string): string {
	const normalizedPath = resolve(filePath);
	const normalizedVault = resolve(vaultPath);

	// Must be within vault or equal to vault
	if (
		!normalizedPath.startsWith(`${normalizedVault}/`) &&
		normalizedPath !== normalizedVault
	) {
		throw new Error(
			`Path traversal attempt: ${filePath} escapes vault boundary`,
		);
	}

	// Check for suspicious patterns in path components
	const relativePath = normalizedPath.slice(normalizedVault.length + 1);
	if (relativePath.includes("..") || relativePath.startsWith("/")) {
		throw new Error(`Invalid path components in: ${filePath}`);
	}

	return normalizedPath;
}

/**
 * Validates filename for safe use in subprocesses.
 *
 * Re-exports core's validateFilenameForSubprocess for consistency.
 *
 * Prevents command injection by restricting characters to a safe subset.
 * Allows: alphanumeric, underscore, hyphen, dot, space
 *
 * @param filename - Filename to validate (basename only, not full path)
 * @throws Error if filename contains invalid characters
 *
 * @example
 * ```typescript
 * // Valid filenames
 * validateFilenameForSubprocess("invoice-2024.pdf")
 * validateFilenameForSubprocess("Meeting Notes.md")
 *
 * // Invalid: special characters
 * validateFilenameForSubprocess("file; rm -rf /")
 * // → throws Error
 * ```
 */
export const validateFilenameForSubprocess = coreValidateFilename;
