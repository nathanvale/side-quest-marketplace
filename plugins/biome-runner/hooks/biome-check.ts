#!/usr/bin/env bun

/**
 * PostToolUse hook that runs Biome check --write on edited files.
 * Automatically fixes formatting and lint issues after Write/Edit/MultiEdit.
 *
 * Git-aware: Only processes files that are tracked by git or staged.
 * Uses the shared parseBiomeOutput function for structured, token-efficient output.
 *
 * Exit codes:
 * - 0: Success (file fixed or already clean, or unsupported file type)
 * - 2: Blocking error (unfixable lint errors remain, shown to Claude)
 */

import { spawn } from "bun";
import { parseBiomeOutput } from "../mcp/index";
import { hasBiomeConfig, logMissingConfigHint } from "./shared/biome-config";
import { BIOME_SUPPORTED_EXTENSIONS } from "./shared/constants";
import { isFileInRepo } from "./shared/git-utils";
import { biomeLogger, createCorrelationId, initLogger } from "./shared/logger";
import { extractFilePaths, parseHookInput } from "./shared/types";

async function main() {
	await initLogger();
	const cid = createCorrelationId();
	const startTime = Date.now();

	biomeLogger.info("Hook started", {
		cid,
		hook: "biome-check",
		event: "PostToolUse",
	});

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

	const input = await Bun.stdin.text();
	const hookInput = parseHookInput(input);

	if (!hookInput) {
		biomeLogger.debug("No hook input, skipping", { cid });
		process.exit(0);
	}

	const filePaths = extractFilePaths(hookInput);
	biomeLogger.debug("Files extracted", {
		cid,
		count: filePaths.length,
		files: filePaths,
	});

	if (filePaths.length === 0) {
		biomeLogger.info("Hook completed", {
			cid,
			exitCode: 0,
			filesProcessed: 0,
			durationMs: Date.now() - startTime,
		});
		process.exit(0);
	}

	// Process each file
	const allDiagnostics: Array<{
		file: string;
		line: number;
		code: string;
		message: string;
	}> = [];
	let filesProcessed = 0;
	let filesSkipped = 0;

	for (const filePath of filePaths) {
		// Skip unsupported files
		if (!BIOME_SUPPORTED_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
			biomeLogger.debug("File filtered", {
				cid,
				file: filePath,
				reason: "unsupported extension",
			});
			filesSkipped++;
			continue;
		}

		// Git-aware: Skip files outside the git repository
		const inRepo = await isFileInRepo(filePath);
		if (!inRepo) {
			biomeLogger.debug("File filtered", {
				cid,
				file: filePath,
				reason: "not in repo",
			});
			filesSkipped++;
			continue;
		}

		filesProcessed++;
		const fileStartTime = Date.now();

		// First, run biome check --write to fix what can be fixed
		const fixProc = spawn({
			cmd: [
				"bunx",
				"@biomejs/biome",
				"check",
				"--write",
				"--no-errors-on-unmatched",
				filePath,
			],
			stdout: "pipe",
			stderr: "pipe",
		});
		await fixProc.exited;
		biomeLogger.debug("Biome fix completed", {
			cid,
			file: filePath,
			durationMs: Date.now() - fileStartTime,
		});

		// Then check if there are remaining issues using JSON reporter
		const checkStartTime = Date.now();
		const checkProc = spawn({
			cmd: [
				"bunx",
				"@biomejs/biome",
				"check",
				"--reporter=json",
				"--no-errors-on-unmatched",
				"--colors=off", // Explicitly disable colors for clean JSON
				filePath,
			],
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
		});

		const exitCode = await checkProc.exited;
		const stdout = await new Response(checkProc.stdout).text();

		if (exitCode !== 0 && stdout.trim()) {
			const summary = parseBiomeOutput(stdout);
			biomeLogger.debug("Biome check completed", {
				cid,
				file: filePath,
				errors: summary.error_count,
				warnings: summary.warning_count,
				durationMs: Date.now() - checkStartTime,
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

			// Collect error diagnostics for JSON output
			if (summary.error_count > 0) {
				for (const d of summary.diagnostics) {
					if (d.severity === "error") {
						allDiagnostics.push({
							file: d.file,
							line: d.line,
							code: d.code,
							message: d.message,
						});
					}
				}
			}
		}
	}

	if (allDiagnostics.length > 0) {
		biomeLogger.warn("Unfixable errors found", {
			cid,
			errorCount: allDiagnostics.length,
		});

		// Output token-efficient JSON for Claude
		console.error(
			JSON.stringify({
				tool: "biome",
				status: "error",
				files_processed: filesProcessed,
				diagnostics: allDiagnostics,
				hint: "MUST use biome_lintFix MCP tool to fix these errors",
			}),
		);

		biomeLogger.info("Hook completed", {
			cid,
			exitCode: 2,
			filesProcessed,
			filesSkipped,
			durationMs: Date.now() - startTime,
		});
		process.exit(2);
	}

	biomeLogger.info("Hook completed", {
		cid,
		exitCode: 0,
		filesProcessed,
		filesSkipped,
		durationMs: Date.now() - startTime,
	});
	process.exit(0);
}

main();
