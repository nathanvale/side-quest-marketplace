#!/usr/bin/env bun

/**
 * Stop hook that runs Biome CI on staged/changed files at end of turn.
 * Provides a final quality gate before Claude completes its response.
 *
 * Git-aware: Only checks files that have been modified or staged.
 * Uses `biome ci` (read-only, strict) for project-wide validation.
 *
 * Exit codes:
 * - 0: Success (all files pass or no relevant changes)
 * - 2: Blocking error (lint/format errors found, shown to Claude for follow-up)
 */

import { parseBiomeOutput } from "../mcp/index";
import { hasBiomeConfig, logMissingConfigHint } from "./shared/biome-config";
import { BIOME_SUPPORTED_EXTENSIONS } from "./shared/constants";
import { getChangedFiles } from "./shared/git-utils";
import { biomeLogger, createCorrelationId, initLogger } from "./shared/logger";
import { spawnAndCollect } from "./shared/spawn-utils";

async function main() {
	await initLogger();
	const cid = createCorrelationId();
	const startTime = Date.now();

	biomeLogger.info("Hook started", { cid, hook: "biome-ci", event: "Stop" });

	// Check for Biome config before doing anything else
	const configResult = await hasBiomeConfig();
	if (!configResult.found) {
		biomeLogger.debug("Config not found, skipping", {
			cid,
			searchPath: configResult.searchPath,
		});
		logMissingConfigHint(configResult.searchPath);
		process.exit(0);
	}

	// Get changed files filtered by Biome-supported extensions
	const filesToCheck = await getChangedFiles(BIOME_SUPPORTED_EXTENSIONS);
	biomeLogger.debug("Changed files found", {
		cid,
		count: filesToCheck.length,
		files: filesToCheck,
	});

	if (filesToCheck.length === 0) {
		// No relevant files changed, nothing to check
		biomeLogger.info("Hook completed", {
			cid,
			exitCode: 0,
			filesChecked: 0,
			durationMs: Date.now() - startTime,
		});
		process.exit(0);
	}

	// Run biome ci (strict, read-only) on changed files
	const ciStartTime = Date.now();
	const { stdout, exitCode } = await spawnAndCollect(
		[
			"bunx",
			"@biomejs/biome",
			"ci",
			"--reporter=json",
			"--no-errors-on-unmatched",
			"--colors=off", // Explicitly disable colors for clean JSON
			...filesToCheck,
		],
		{ env: { NO_COLOR: "1", FORCE_COLOR: "0" } },
	);

	if (exitCode === 0) {
		// All checks passed
		biomeLogger.info("Hook completed", {
			cid,
			exitCode: 0,
			filesChecked: filesToCheck.length,
			durationMs: Date.now() - startTime,
		});
		process.exit(0);
	}

	// Parse and report errors
	if (stdout.trim()) {
		const summary = parseBiomeOutput(stdout);
		biomeLogger.debug("Biome CI completed", {
			cid,
			errors: summary.error_count,
			warnings: summary.warning_count,
			durationMs: Date.now() - ciStartTime,
		});

		// Log each diagnostic for LLM training
		for (const diagnostic of summary.diagnostics) {
			const logLevel = diagnostic.severity === "error" ? "error" : "warn";
			biomeLogger[logLevel]("Biome diagnostic", {
				cid,
				file: diagnostic.file,
				line: diagnostic.line,
				code: diagnostic.code,
				severity: diagnostic.severity,
				message: diagnostic.message,
				suggestion: diagnostic.suggestion,
			});
		}

		if (summary.error_count > 0 || summary.warning_count > 0) {
			biomeLogger.warn("Issues found", {
				cid,
				errors: summary.error_count,
				warnings: summary.warning_count,
			});

			// Output token-efficient JSON for Claude
			console.error(
				JSON.stringify({
					tool: "biome",
					status: "error",
					file_count: filesToCheck.length,
					error_count: summary.error_count,
					warning_count: summary.warning_count,
					diagnostics: summary.diagnostics.map(
						(d: {
							file: string;
							line: number;
							code: string;
							severity: string;
							message: string;
						}) => ({
							file: d.file,
							line: d.line,
							code: d.code,
							severity: d.severity,
							message: d.message,
						}),
					),
					hint: "MUST use biome_lintFix MCP tool to fix these errors",
				}),
			);

			biomeLogger.info("Hook completed", {
				cid,
				exitCode: 2,
				filesChecked: filesToCheck.length,
				durationMs: Date.now() - startTime,
			});
			process.exit(2);
		}
	}

	biomeLogger.info("Hook completed", {
		cid,
		exitCode: 0,
		filesChecked: filesToCheck.length,
		durationMs: Date.now() - startTime,
	});
	process.exit(0);
}

main();
