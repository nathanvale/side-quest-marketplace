#!/usr/bin/env bun

/**
 * PostToolUse hook that runs Biome check --write on edited files.
 * Automatically fixes formatting and lint issues after Write/Edit/MultiEdit.
 *
 * Uses the shared parseBiomeOutput function for structured, token-efficient output.
 *
 * Exit codes:
 * - 0: Success (file fixed or already clean, or unsupported file type)
 * - 2: Blocking error (unfixable lint errors remain, shown to Claude)
 */

import { spawn } from "bun";
import { parseBiomeOutput } from "../mcp-servers/bun-runner/index";

interface HookInput {
	tool_name: string;
	tool_input: {
		file_path?: string;
		edits?: Array<{ file_path: string }>;
	};
}

const SUPPORTED_EXTENSIONS = [
	".js",
	".jsx",
	".ts",
	".tsx",
	".mjs",
	".cjs",
	".mts",
	".cts",
	".json",
	".jsonc",
	".css",
	".graphql",
	".gql",
];

function formatDiagnostics(summary: ReturnType<typeof parseBiomeOutput>): string {
	if (summary.error_count === 0 && summary.warning_count === 0) {
		return "";
	}

	const lines: string[] = [];
	lines.push(`${summary.error_count} error(s), ${summary.warning_count} warning(s):`);

	for (const d of summary.diagnostics) {
		lines.push(`  ${d.file}:${d.line} [${d.code}] ${d.message}`);
	}

	return lines.join("\n");
}

async function main() {
	const input = await Bun.stdin.text();
	let hookInput: HookInput;

	try {
		hookInput = JSON.parse(input);
	} catch {
		process.exit(0);
	}

	// Extract file paths
	const filePaths: string[] = [];

	if (hookInput.tool_input.file_path) {
		filePaths.push(hookInput.tool_input.file_path);
	}

	if (hookInput.tool_input.edits) {
		for (const edit of hookInput.tool_input.edits) {
			if (edit.file_path && !filePaths.includes(edit.file_path)) {
				filePaths.push(edit.file_path);
			}
		}
	}

	if (filePaths.length === 0) {
		process.exit(0);
	}

	// Process each file
	const allErrors: string[] = [];

	for (const filePath of filePaths) {
		// Skip unsupported files
		if (!SUPPORTED_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
			continue;
		}

		// First, run biome check --write to fix what can be fixed
		const fixProc = spawn({
			cmd: ["bunx", "@biomejs/biome", "check", "--write", "--no-errors-on-unmatched", filePath],
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
				filePath,
			],
			stdout: "pipe",
			stderr: "pipe",
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
		console.error(`Biome found unfixable issues:\n${allErrors.join("\n\n")}`);
		process.exit(2);
	}

	process.exit(0);
}

main();
