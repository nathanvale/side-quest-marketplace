#!/usr/bin/env bun

/**
 * CLI for validating Claude Code plugins.
 *
 * Usage:
 *   bun run core/src/validate/cli.ts plugins/git        # Validate single plugin
 *   bun run core/src/validate/cli.ts .                  # Validate marketplace root
 *   bun run core/src/validate/cli.ts --all              # Validate marketplace + all plugins
 *   bun run core/src/validate/cli.ts plugins/git --format json
 */

import { existsSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { formatMarkdown } from "./reporter.ts";
import { validatePlugin } from "./runner.ts";
import type { ValidationResult } from "./types.ts";

/**
 * Parse command line arguments
 */
function parseArgs(): {
	pluginPaths: string[];
	format: "markdown" | "json";
	validateAll: boolean;
} {
	const args = process.argv.slice(2);
	let format: "markdown" | "json" = "markdown";
	let validateAll = false;
	const pluginPaths: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]!;

		if (arg === "--all") {
			validateAll = true;
		} else if (arg === "--format") {
			const nextArg = args[++i];
			if (nextArg !== "markdown" && nextArg !== "json") {
				console.error(
					`Invalid format: ${nextArg ?? "undefined"}. Must be "markdown" or "json"`,
				);
				process.exit(1);
			}
			format = nextArg;
		} else if (arg.startsWith("--")) {
			console.error(`Unknown flag: ${arg}`);
			process.exit(1);
		} else {
			pluginPaths.push(arg);
		}
	}

	return { pluginPaths, format, validateAll };
}

/**
 * Get all plugin directories in the plugins/ folder
 */
function getAllPlugins(marketplaceRoot: string): string[] {
	const pluginsDir = join(marketplaceRoot, "plugins");
	if (!existsSync(pluginsDir)) {
		console.error(`Plugins directory not found: ${pluginsDir}`);
		process.exit(1);
	}

	const entries = readdirSync(pluginsDir);
	const plugins: string[] = [];

	for (const entry of entries) {
		const fullPath = join(pluginsDir, entry);
		// Check if it's a directory with a .claude-plugin/plugin.json file
		const pluginJsonPath = join(fullPath, ".claude-plugin", "plugin.json");
		if (existsSync(pluginJsonPath)) {
			plugins.push(fullPath);
		}
	}

	return plugins;
}

/**
 * Validate a single plugin using the core runner
 */
async function validateSinglePlugin(
	pluginPath: string,
): Promise<ValidationResult> {
	const absolutePath = resolve(pluginPath);
	const pluginName = basename(absolutePath);

	if (!existsSync(absolutePath)) {
		return {
			plugin: pluginName,
			path: absolutePath,
			passed: false,
			issues: [
				{
					ruleId: "cli/plugin-not-found",
					message: `Plugin directory not found: ${absolutePath}`,
					severity: "error",
					file: absolutePath,
				},
			],
			summary: {
				errors: 1,
				warnings: 0,
				info: 0,
			},
		};
	}

	try {
		return await validatePlugin(absolutePath);
	} catch (error) {
		return {
			plugin: pluginName,
			path: absolutePath,
			passed: false,
			issues: [
				{
					ruleId: "cli/validation-error",
					message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
					severity: "error",
					file: absolutePath,
				},
			],
			summary: {
				errors: 1,
				warnings: 0,
				info: 0,
			},
		};
	}
}

/**
 * Main CLI entry point
 */
async function main() {
	const { pluginPaths, format, validateAll } = parseArgs();

	// Determine marketplace root (parent of core/)
	const marketplaceRoot = resolve(import.meta.dir, "../../..");

	// Determine which plugins to validate
	let pathsToValidate: string[];
	if (validateAll) {
		// When --all is used, validate marketplace root + all individual plugins
		pathsToValidate = [marketplaceRoot, ...getAllPlugins(marketplaceRoot)];
	} else {
		pathsToValidate = pluginPaths.map((p) => resolve(p));
	}

	if (pathsToValidate.length === 0) {
		console.error("No plugins specified. Use --all or provide plugin paths.");
		process.exit(1);
	}

	// Validate all specified plugins
	const results: ValidationResult[] = [];
	for (const pluginPath of pathsToValidate) {
		const result = await validateSinglePlugin(pluginPath);
		results.push(result);
	}

	// Output results
	if (format === "json") {
		console.log(JSON.stringify(results, null, 2));
	} else {
		for (const result of results) {
			console.log(formatMarkdown(result));
			console.log(""); // Blank line between plugins
		}
	}

	// Exit with non-zero if any validation failed
	const failed = results.some((r) => !r.passed);
	process.exit(failed ? 1 : 0);
}

main();
