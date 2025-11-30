#!/usr/bin/env bun

/**
 * Validates that all plugins have a SessionStart hook that bootstraps dependencies.
 *
 * This ensures the self-healing dependency installation pattern is consistently
 * applied across all plugins in the marketplace.
 *
 * Exit codes:
 * - 0: All plugins have valid SessionStart hooks
 * - 1: One or more plugins missing SessionStart hook
 */

import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { Glob } from "bun";

// --- Types ---

interface HooksJson {
	hooks?: {
		SessionStart?: Array<{
			matcher?: string;
			hooks?: Array<{
				type?: string;
				command?: string;
			}>;
		}>;
	};
}

interface ValidationResult {
	plugin: string;
	hasSessionStartHook: boolean;
	hasBootstrapCommand: boolean;
	error?: string;
}

// --- Constants ---

const BOOTSTRAP_PATTERN = /core\/bootstrap\.sh/;

// --- Functions ---

/**
 * Find all plugin directories in the marketplace
 */
async function findPlugins(marketplaceRoot: string): Promise<string[]> {
	const pluginsDir = join(marketplaceRoot, "plugins");
	const plugins: string[] = [];

	// Find all directories under plugins/ that have .claude-plugin/
	const glob = new Glob("*/.claude-plugin");
	for await (const match of glob.scan({ cwd: pluginsDir, onlyFiles: false })) {
		const pluginDir = dirname(match);
		plugins.push(join(pluginsDir, pluginDir));
	}

	return plugins.sort();
}

/**
 * Validate a single plugin's SessionStart hook
 */
async function validatePlugin(pluginPath: string): Promise<ValidationResult> {
	const pluginName = basename(pluginPath);
	const hooksJsonPath = join(pluginPath, "hooks", "hooks.json");

	// Check if hooks.json exists
	if (!existsSync(hooksJsonPath)) {
		return {
			plugin: pluginName,
			hasSessionStartHook: false,
			hasBootstrapCommand: false,
			error: "Missing hooks/hooks.json",
		};
	}

	// Parse hooks.json
	let hooksJson: HooksJson;
	try {
		const content = await Bun.file(hooksJsonPath).text();
		hooksJson = JSON.parse(content);
	} catch {
		return {
			plugin: pluginName,
			hasSessionStartHook: false,
			hasBootstrapCommand: false,
			error: "Invalid JSON in hooks/hooks.json",
		};
	}

	// Check for SessionStart hook
	const sessionStartHooks = hooksJson.hooks?.SessionStart;
	if (!sessionStartHooks || sessionStartHooks.length === 0) {
		return {
			plugin: pluginName,
			hasSessionStartHook: false,
			hasBootstrapCommand: false,
			error: "No SessionStart hook defined",
		};
	}

	// Check if any hook command contains the bootstrap pattern
	let hasBootstrapCommand = false;
	for (const hookEntry of sessionStartHooks) {
		for (const hook of hookEntry.hooks || []) {
			if (hook.command && BOOTSTRAP_PATTERN.test(hook.command)) {
				hasBootstrapCommand = true;
				break;
			}
		}
		if (hasBootstrapCommand) break;
	}

	if (!hasBootstrapCommand) {
		return {
			plugin: pluginName,
			hasSessionStartHook: true,
			hasBootstrapCommand: false,
			error: "SessionStart hook does not call core/bootstrap.sh",
		};
	}

	return {
		plugin: pluginName,
		hasSessionStartHook: true,
		hasBootstrapCommand: true,
	};
}

/**
 * Main validation function
 */
export async function validateSessionStartHooks(
	marketplaceRoot: string,
): Promise<{ passed: boolean; results: ValidationResult[] }> {
	const plugins = await findPlugins(marketplaceRoot);
	const results: ValidationResult[] = [];

	for (const pluginPath of plugins) {
		results.push(await validatePlugin(pluginPath));
	}

	const passed = results.every((r) => r.hasBootstrapCommand);
	return { passed, results };
}

// --- CLI ---

async function main() {
	// Find marketplace root (walk up from this file)
	let marketplaceRoot = dirname(dirname(dirname(import.meta.dir)));

	// Allow override via argument
	if (process.argv[2]) {
		marketplaceRoot = process.argv[2];
	}

	console.log(`Validating SessionStart hooks in: ${marketplaceRoot}\n`);

	const { passed, results } = await validateSessionStartHooks(marketplaceRoot);

	// Print results
	const failing = results.filter((r) => !r.hasBootstrapCommand);
	const passing = results.filter((r) => r.hasBootstrapCommand);

	if (passing.length > 0) {
		console.log(`Passing (${passing.length}):`);
		for (const r of passing) {
			console.log(`  ${r.plugin}`);
		}
		console.log();
	}

	if (failing.length > 0) {
		console.log(`Failing (${failing.length}):`);
		for (const r of failing) {
			console.log(`  ${r.plugin}: ${r.error}`);
		}
		console.log();
	}

	if (passed) {
		console.log("All plugins have valid SessionStart hooks.");
		process.exit(0);
	} else {
		console.log(
			"Some plugins are missing SessionStart hooks. See PLUGIN_DEV_GUIDE.md for requirements.",
		);
		process.exit(1);
	}
}

if (import.meta.main) {
	main();
}
