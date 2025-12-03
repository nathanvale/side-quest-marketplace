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
import { parseBiomeOutput } from "../mcp-servers/bun-runner/index";
import { hasBiomeConfig, logMissingConfigHint } from "./shared/biome-config";
import { BIOME_SUPPORTED_EXTENSIONS } from "./shared/constants";
import { isFileInRepo } from "./shared/git-utils";
import { extractFilePaths, parseHookInput } from "./shared/types";

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
	// Check for Biome config before doing anything else
	const configResult = await hasBiomeConfig();
	if (!configResult.found) {
		logMissingConfigHint(configResult.searchPath);
		process.exit(0);
	}

	const input = await Bun.stdin.text();
	const hookInput = parseHookInput(input);

	if (!hookInput) {
		process.exit(0);
	}

	const filePaths = extractFilePaths(hookInput);

	if (filePaths.length === 0) {
		process.exit(0);
	}

	// Process each file
	const allErrors: string[] = [];

	for (const filePath of filePaths) {
		// Skip unsupported files
		if (!BIOME_SUPPORTED_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
			continue;
		}

		// Git-aware: Skip files outside the git repository
		const inRepo = await isFileInRepo(filePath);
		if (!inRepo) {
			continue;
		}

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

		// Then check if there are remaining issues using JSON reporter
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
			if (summary.error_count > 0) {
				allErrors.push(formatDiagnostics(summary));
			}
		}
	}

	if (allErrors.length > 0) {
		console.error(
			`Biome found unfixable issues:\n${allErrors.join("\n\n")}\n\n` +
				"To fix these issues:\n" +
				"1. Use MCP tool: mcp__plugin_bun-runner_bun-runner__bun_lintFix\n" +
				"2. Or run directly: bun run biome check --write .",
		);
		process.exit(2);
	}

	process.exit(0);
}

main();
