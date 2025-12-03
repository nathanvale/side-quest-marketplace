#!/usr/bin/env bun

/**
 * Validates that all plugins with dependencies have a SessionStart hook
 * that bootstraps dependencies.
 *
 * This CLI tool reuses the smart validateBootstrapHook validator which
 * only requires hooks for plugins that have dependencies in package.json.
 *
 * Exit codes:
 * - 0: All plugins pass validation
 * - 1: One or more plugins fail validation
 */

import { basename, dirname, join } from "node:path";
import { Glob } from "bun";
import { validateBootstrapHook } from "./validators/bootstrap-hook.ts";

// --- Types ---

interface ValidationResult {
	plugin: string;
	passed: boolean;
	error?: string;
}

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
 * Validate a single plugin using the smart bootstrap validator.
 * Only plugins with dependencies require SessionStart hooks.
 */
async function validatePlugin(pluginPath: string): Promise<ValidationResult> {
	const pluginName = basename(pluginPath);

	// Use the smart validator that checks if plugin has dependencies
	const issues = await validateBootstrapHook({ pluginRoot: pluginPath });

	// Filter to only error severity issues
	const errors = issues.filter((i) => i.severity === "error");

	if (errors.length > 0) {
		return {
			plugin: pluginName,
			passed: false,
			error: errors[0]?.message,
		};
	}

	return {
		plugin: pluginName,
		passed: true,
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

	const passed = results.every((r) => r.passed);
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

	console.log(`Validating bootstrap hooks in: ${marketplaceRoot}\n`);

	const { passed, results } = await validateSessionStartHooks(marketplaceRoot);

	// Print results
	const failing = results.filter((r) => !r.passed);
	const passing = results.filter((r) => r.passed);

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
		console.log("All plugins pass bootstrap validation.");
		process.exit(0);
	} else {
		console.log(
			"Some plugins with dependencies are missing SessionStart hooks. See PLUGIN_DEV_GUIDE.md for requirements.",
		);
		process.exit(1);
	}
}

if (import.meta.main) {
	main();
}
