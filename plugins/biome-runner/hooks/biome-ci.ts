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

import { parseBiomeOutput } from "../mcp-servers/biome-runner/index";
import { hasBiomeConfig, logMissingConfigHint } from "./shared/biome-config";
import { BIOME_SUPPORTED_EXTENSIONS } from "./shared/constants";
import { getChangedFiles } from "./shared/git-utils";
import { biomeLogger, createCorrelationId, initLogger } from "./shared/logger";
import { spawnAndCollect } from "./shared/spawn-utils";

function formatDiagnostics(
	summary: ReturnType<typeof parseBiomeOutput>,
): string {
	if (summary.error_count === 0 && summary.warning_count === 0) {
		return "";
	}

	const lines: string[] = [];
	lines.push(
		`${summary.error_count} error(s), ${summary.warning_count} warning(s):`,
	);

	for (const d of summary.diagnostics) {
		lines.push(`  ${d.file}:${d.line} [${d.code}] ${d.message}`);
	}

	return lines.join("\n");
}

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

		if (summary.error_count > 0 || summary.warning_count > 0) {
			const diagnostics = formatDiagnostics(summary);
			biomeLogger.warn("Issues found", {
				cid,
				errors: summary.error_count,
				warnings: summary.warning_count,
			});
			console.error(
				`Biome CI found issues in ${filesToCheck.length} changed file(s):\n${diagnostics}\n\n` +
					"CRITICAL: Use MCP tool FIRST (do NOT use CLI):\n" +
					"  → biome_lintFix\n\n" +
					"Only if MCP tool fails, use fallback CLI:\n" +
					"  bun run biome check --write .",
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
