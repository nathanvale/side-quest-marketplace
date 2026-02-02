/**
 * Worktree configuration loading and auto-detection.
 *
 * Loads `.worktrees.json` from the git root, validates it, and provides
 * auto-detection of common gitignored files when no config exists.
 *
 * @module worktree/config
 */

import path from "node:path";
import {
	pathExistsSync,
	readJsonFileSync,
	writeJsonFileSyncAtomic,
} from "@side-quest/core/fs";
import { detectInstallCommand } from "./detect-pm.js";
import type { WorktreeConfig } from "./types.js";

/** Config filename placed at repo root. */
export const CONFIG_FILENAME = ".worktrees.json";

/** Root-level file/dir patterns to check during auto-detection. */
const AUTO_DETECT_ROOT_PATTERNS: readonly string[] = [
	".env",
	".env.*",
	".envrc",
	".claude",
	".kit",
	".tool-versions",
	".nvmrc",
	".node-version",
	".python-version",
	"PROJECT_INDEX.json",
];

/** Recursive patterns to check during auto-detection. */
const AUTO_DETECT_RECURSIVE_PATTERNS: readonly string[] = [
	"**/CLAUDE.md",
	"**/*.kit",
];

/** Default exclusions for recursive copy. */
export const DEFAULT_EXCLUDES: readonly string[] = [
	"node_modules",
	".git",
	".worktrees",
	"dist",
	"build",
	"vendor",
	"__pycache__",
	".venv",
	"venv",
];

/** Default config values. */
const DEFAULTS: WorktreeConfig = {
	directory: ".worktrees",
	copy: [],
	exclude: [...DEFAULT_EXCLUDES],
	postCreate: null,
	preDelete: null,
	branchTemplate: "{type}/{description}",
};

/**
 * Load worktree config from `.worktrees.json` at the given root.
 *
 * Returns the parsed config, or null if the file doesn't exist.
 * Merges with defaults so callers always get a complete config.
 *
 * @param gitRoot - Absolute path to the git repository root
 * @returns Merged config, or null if no config file exists
 */
export function loadConfig(gitRoot: string): WorktreeConfig | null {
	const configPath = path.join(gitRoot, CONFIG_FILENAME);
	if (!pathExistsSync(configPath)) {
		return null;
	}

	const raw = readJsonFileSync<Partial<WorktreeConfig>>(configPath);
	return mergeWithDefaults(raw);
}

/**
 * Auto-detect a worktree config by scanning the repo for common patterns.
 *
 * Checks for known gitignored files at the root, and for recursive patterns
 * like `CLAUDE.md` files. Also detects the package manager for `postCreate`.
 *
 * @param gitRoot - Absolute path to the git repository root
 * @returns Auto-detected config with only patterns that actually exist
 */
export function autoDetectConfig(gitRoot: string): WorktreeConfig {
	const detectedCopy: string[] = [];

	// Check root-level patterns
	for (const pattern of AUTO_DETECT_ROOT_PATTERNS) {
		// For glob-like patterns (e.g., ".env.*"), check the literal first
		if (pattern.includes("*")) {
			// Always include glob patterns -- they'll be resolved at copy time
			detectedCopy.push(pattern);
		} else {
			const fullPath = path.join(gitRoot, pattern);
			if (pathExistsSync(fullPath)) {
				detectedCopy.push(pattern);
			}
		}
	}

	// Check for recursive patterns by looking for at least one match
	for (const pattern of AUTO_DETECT_RECURSIVE_PATTERNS) {
		// Extract the filename from the pattern (e.g., "CLAUDE.md" from "**/CLAUDE.md")
		const filename = path.basename(pattern);
		// Check if at least the root-level file exists
		if (pathExistsSync(path.join(gitRoot, filename))) {
			detectedCopy.push(pattern);
		}
	}

	const installCommand = detectInstallCommand(gitRoot);

	return {
		...DEFAULTS,
		copy: detectedCopy,
		postCreate: installCommand,
	};
}

/**
 * Load config from file, or auto-detect if no config file exists.
 *
 * @param gitRoot - Absolute path to the git repository root
 * @returns Config and whether it was auto-detected
 */
export function loadOrDetectConfig(gitRoot: string): {
	config: WorktreeConfig;
	autoDetected: boolean;
} {
	const config = loadConfig(gitRoot);
	if (config) {
		return { config, autoDetected: false };
	}
	return { config: autoDetectConfig(gitRoot), autoDetected: true };
}

/**
 * Write a config to `.worktrees.json` at the given root.
 *
 * Uses atomic writes to prevent corruption.
 *
 * @param gitRoot - Absolute path to the git repository root
 * @param config - Config to write
 */
export function writeConfig(gitRoot: string, config: WorktreeConfig): void {
	const configPath = path.join(gitRoot, CONFIG_FILENAME);
	writeJsonFileSyncAtomic(configPath, config);
}

/** Merge a partial config with defaults. */
function mergeWithDefaults(partial: Partial<WorktreeConfig>): WorktreeConfig {
	return {
		directory: partial.directory ?? DEFAULTS.directory,
		copy: partial.copy ? [...partial.copy] : [...DEFAULTS.copy],
		exclude: partial.exclude ? [...partial.exclude] : [...DEFAULTS.exclude],
		postCreate: partial.postCreate ?? DEFAULTS.postCreate,
		preDelete: partial.preDelete ?? DEFAULTS.preDelete,
		branchTemplate: partial.branchTemplate ?? DEFAULTS.branchTemplate,
	};
}
