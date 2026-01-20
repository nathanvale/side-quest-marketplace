/**
 * Temporary JSON file utilities for CLI tools that write output to temp files.
 *
 * Common pattern: CLI writes JSON to temp file → read + parse → cleanup.
 * This module handles creation, cleanup, and error recovery automatically.
 */

import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Result of executing an operation that writes to a temp file.
 */
export interface TempFileExecutionResult {
	/** Exit code from the operation (0 = success) */
	exitCode: number;
	/** Error output from the operation (optional) */
	stderr?: string;
}

/**
 * Execute an operation that writes JSON output to a temp file.
 * Handles creation, cleanup, and error recovery automatically.
 *
 * Workflow:
 * 1. Create unique temp file path (tmpdir/<prefix>-<uuid>.json)
 * 2. Execute function with temp file path
 * 3. Check exit code (non-zero = throw error)
 * 4. Read and parse JSON from temp file
 * 5. Clean up temp file (always, even on error)
 *
 * @param prefix - Prefix for temp file name (e.g., "kit-grep")
 * @param fn - Function that receives temp path and returns execution result
 * @returns Parsed JSON content from temp file
 * @throws Error if exit code non-zero or output file not found
 *
 * @example
 * ```typescript
 * const result = withTempJsonFileSync<GrepResult[]>("kit-grep", (tempPath) => {
 *   const args = ["grep", pattern, "--output", tempPath];
 *   const result = spawnSync("kit", args);
 *   return { exitCode: result.status ?? 1, stderr: result.stderr?.toString() };
 * });
 * ```
 */
export function withTempJsonFileSync<T>(
	prefix: string,
	fn: (tempPath: string) => TempFileExecutionResult,
): T {
	const tempFile = join(tmpdir(), `${prefix}-${crypto.randomUUID()}.json`);

	try {
		// Execute operation that writes to temp file
		const result = fn(tempFile);

		// Check for non-zero exit code
		if (result.exitCode !== 0) {
			// Clean up before throwing
			if (existsSync(tempFile)) {
				rmSync(tempFile);
			}

			const errorMsg = result.stderr ? result.stderr.trim() : "Command failed";
			throw new Error(
				`Operation failed with exit code ${result.exitCode}: ${errorMsg}`,
			);
		}

		// Check if output file was created
		if (!existsSync(tempFile)) {
			throw new Error("Operation completed but output file not found");
		}

		// Read and parse JSON
		const jsonContent = readFileSync(tempFile, "utf8");
		rmSync(tempFile); // Clean up on success

		try {
			return JSON.parse(jsonContent) as T;
		} catch (parseError) {
			throw new Error(
				`Failed to parse JSON output: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
			);
		}
	} catch (error) {
		// Clean up temp file on any error
		if (existsSync(tempFile)) {
			rmSync(tempFile);
		}
		throw error;
	}
}

/**
 * Async version of withTempJsonFileSync.
 * Execute an operation that writes JSON output to a temp file asynchronously.
 *
 * @param prefix - Prefix for temp file name (e.g., "kit-grep")
 * @param fn - Async function that receives temp path and returns execution result
 * @returns Promise resolving to parsed JSON content
 * @throws Error if exit code non-zero or output file not found
 *
 * @example
 * ```typescript
 * const result = await withTempJsonFile<GrepResult[]>("kit-grep", async (tempPath) => {
 *   const args = ["grep", pattern, "--output", tempPath];
 *   const result = await spawn("kit", args);
 *   return { exitCode: result.exitCode, stderr: result.stderr };
 * });
 * ```
 */
export async function withTempJsonFile<T>(
	prefix: string,
	fn: (
		tempPath: string,
	) => Promise<TempFileExecutionResult> | TempFileExecutionResult,
): Promise<T> {
	const tempFile = join(tmpdir(), `${prefix}-${crypto.randomUUID()}.json`);

	try {
		// Execute operation that writes to temp file
		const result = await fn(tempFile);

		// Check for non-zero exit code
		if (result.exitCode !== 0) {
			// Clean up before throwing
			if (existsSync(tempFile)) {
				rmSync(tempFile);
			}

			const errorMsg = result.stderr ? result.stderr.trim() : "Command failed";
			throw new Error(
				`Operation failed with exit code ${result.exitCode}: ${errorMsg}`,
			);
		}

		// Check if output file was created
		if (!existsSync(tempFile)) {
			throw new Error("Operation completed but output file not found");
		}

		// Read and parse JSON
		const jsonContent = readFileSync(tempFile, "utf8");
		rmSync(tempFile); // Clean up on success

		try {
			return JSON.parse(jsonContent) as T;
		} catch (parseError) {
			throw new Error(
				`Failed to parse JSON output: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
			);
		}
	} catch (error) {
		// Clean up temp file on any error
		if (existsSync(tempFile)) {
			rmSync(tempFile);
		}
		throw error;
	}
}
