/**
 * Kit installation and ML dependency checking utilities.
 *
 * This module provides helpers to check if Kit is installed and if ML
 * dependencies are available. Returns detailed error messages with
 * installation instructions when dependencies are missing.
 *
 * @module kit-check
 */
import { spawnAndCollect } from "@side-quest/core/spawn";

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
			error: "Kit CLI not found",
		};
	}

	// Check if ML dependencies work by testing search-semantic command
	// This is more reliable than checking uv tool list (which doesn't show extras)
	const { exitCode: semanticExitCode, stderr: semanticStderr } =
		await spawnAndCollect(["kit", "search-semantic", "--help"], {
			env: { ...process.env },
		});

	// If the command exists and doesn't fail, ML is available
	// Common failure: "No such command 'search-semantic'" or import errors
	const hasML =
		semanticExitCode === 0 &&
		!semanticStderr.toLowerCase().includes("no such command") &&
		!semanticStderr.toLowerCase().includes("modulenotfounderror");

	return {
		installed: true,
		hasML,
		version: kitVersion.trim(),
	};
}

/**
 * Generates a detailed error message for missing Kit ML dependencies.
 *
 * Provides step-by-step installation instructions including the known
 * Python 3.12+ compatibility issue that frequently causes problems.
 *
 * @param check - The result from checkKit()
 * @returns Formatted error message with installation instructions
 */
export function getKitMLErrorMessage(check: KitCheckResult): string {
	const lines: string[] = [];

	// Header
	lines.push("ERROR: Semantic search unavailable");
	lines.push("");

	// Specific issue
	if (!check.installed) {
		lines.push("Kit CLI is not installed.");
	} else if (!check.hasML) {
		lines.push("Kit is installed but missing ML dependencies.");
		if (check.version) {
			lines.push(`Current version: ${check.version}`);
		}
	}

	lines.push("");

	// Installation box
	lines.push(
		"┌─ INSTALLATION ─────────────────────────────────────────────────┐",
	);
	lines.push(
		"│                                                                │",
	);
	lines.push(
		"│  1. Ensure Python 3.11 is installed (NOT 3.12+):               │",
	);
	lines.push(
		"│     python3 --version                                          │",
	);
	lines.push(
		"│                                                                │",
	);
	lines.push(
		"│     ⚠️  Kit ML has compatibility issues with Python 3.12+.     │",
	);
	lines.push(
		"│     Use pyenv to install 3.11:                                 │",
	);
	lines.push(
		"│       pyenv install 3.11.9 && pyenv global 3.11.9              │",
	);
	lines.push(
		"│                                                                │",
	);
	lines.push(
		"│  2. Install Kit with ML dependencies:                          │",
	);
	lines.push(
		"│     uv tool install 'cased-kit[ml]'                            │",
	);
	lines.push(
		"│                                                                │",
	);
	lines.push(
		"│  3. Verify installation:                                       │",
	);
	lines.push(
		"│     kit --version                                              │",
	);
	lines.push(
		"│     kit search-semantic --help                                 │",
	);
	lines.push(
		"│                                                                │",
	);
	lines.push(
		"└────────────────────────────────────────────────────────────────┘",
	);

	lines.push("");
	lines.push("For text-based search (no ML required), use:");
	lines.push('  para-obsidian search "your query" [--dir folder]');

	return lines.join("\n");
}
