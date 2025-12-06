/**
 * Kit installation and ML dependency checking utilities.
 *
 * This module provides helpers to check if Kit is installed and if ML
 * dependencies are available, with automatic installation prompts.
 *
 * @module kit-check
 */

import { spawnAndCollect } from "../../../core/src/spawn/index.js";

/**
 * Result of checking Kit installation status.
 */
export interface KitCheckResult {
	/** Whether kit is installed and available on PATH. */
	readonly installed: boolean;
	/** Whether ML dependencies are installed. */
	readonly hasML: boolean;
	/** Kit version if installed. */
	readonly version?: string;
	/** Error message if check failed. */
	readonly error?: string;
}

/**
 * Checks if Kit CLI is installed and has ML dependencies.
 *
 * Tests for both basic Kit installation and ML capabilities by
 * checking the uv tool installation.
 *
 * @returns Check result with installation status
 */
export async function checkKit(): Promise<KitCheckResult> {
	// Check if kit is installed
	const { exitCode: kitExitCode, stdout: kitVersion } = await spawnAndCollect(
		["kit", "--version"],
		{ env: { ...process.env } },
	);

	if (kitExitCode !== 0) {
		return {
			installed: false,
			hasML: false,
			error: "Kit CLI not found. Install with: uv tool install cased-kit",
		};
	}

	// Check if ML dependencies are installed via uv tool list
	const { exitCode: uvExitCode, stdout: uvList } = await spawnAndCollect(
		["uv", "tool", "list"],
		{ env: { ...process.env } },
	);

	if (uvExitCode !== 0) {
		return {
			installed: true,
			hasML: false,
			version: kitVersion.trim(),
			error: "Could not check ML dependencies (uv not available)",
		};
	}

	// Check if cased-kit is installed with ML extras
	const hasML = uvList.includes("cased-kit") && uvList.includes("[ml]");

	return {
		installed: true,
		hasML,
		version: kitVersion.trim(),
	};
}

/**
 * Installs Kit with ML dependencies using uv tool install.
 *
 * This will upgrade an existing Kit installation to include ML capabilities.
 *
 * @returns True if installation succeeded, false otherwise
 */
export async function installKitML(): Promise<boolean> {
	const { exitCode, stderr } = await spawnAndCollect(
		["uv", "tool", "install", "cased-kit[ml]", "--upgrade"],
		{ env: { ...process.env } },
	);

	if (exitCode !== 0) {
		console.error(`Failed to install Kit ML dependencies: ${stderr.trim()}`);
		return false;
	}

	return true;
}

/**
 * Ensures Kit with ML dependencies is installed, prompting if needed.
 *
 * Checks installation status and offers to install if missing.
 * In non-interactive mode, throws an error with installation instructions.
 *
 * @param interactive - Whether to prompt for installation (default: true)
 * @returns True if Kit ML is available, false if user declined
 * @throws Error if not installed and non-interactive
 */
export async function ensureKitML(interactive = true): Promise<boolean> {
	const check = await checkKit();

	if (check.hasML) {
		return true;
	}

	if (!check.installed) {
		const message =
			"Kit CLI is not installed. Install with: uv tool install cased-kit[ml]";
		if (!interactive) {
			throw new Error(message);
		}
		console.error(message);
		return false;
	}

	// Kit is installed but missing ML dependencies
	const message = `Kit is installed but missing ML dependencies.

To enable semantic search, install ML dependencies:
  uv tool install cased-kit[ml] --upgrade`;

	if (!interactive) {
		throw new Error(message);
	}

	// In interactive mode, offer to install
	console.log(message);
	console.log("");
	console.log("Install now? (y/n)");

	// Read from stdin
	const stdin = Bun.stdin.stream();
	const reader = stdin.getReader();
	const { value } = await reader.read();
	reader.releaseLock();

	const response = value
		? new TextDecoder().decode(value).trim().toLowerCase()
		: "n";

	if (response === "y" || response === "yes") {
		console.log("Installing Kit ML dependencies...");
		const success = await installKitML();
		if (success) {
			console.log("✓ Kit ML dependencies installed successfully");
			return true;
		}
		console.error("✗ Installation failed");
		return false;
	}

	console.log("Skipping installation");
	return false;
}
