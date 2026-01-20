#!/usr/bin/env bun

/// <reference types="bun-types" />

/**
 * TypeScript checker MCP server.
 *
 * Runs `bunx tsc --noEmit --pretty false` from the nearest tsconfig/jsconfig
 * and reports errors in a Claude-friendly format.
 */

import fs from "node:fs";
import path from "node:path";
import { startServer, tool, z } from "@sidequest/core/mcp";
import { ResponseFormat, wrapToolHandler } from "@sidequest/core/mcp-response";
import { spawnWithTimeout } from "@sidequest/core/spawn";
import { validatePathOrDefault } from "@sidequest/core/validation";
import {
	createCorrelationId,
	initLogger,
	mcpLogger,
} from "../hooks/shared/logger";
import {
	findNearestTsConfig,
	TSC_CONFIG_FILES,
} from "../hooks/shared/tsc-config";
import { parseTscOutput } from "../hooks/tsc-check";

// Initialize logger on server startup
initLogger().catch(console.error);

const TSC_TIMEOUT_MS = 30_000;

interface TscRunResult {
	exitCode: number;
	timedOut: boolean;
	output: string;
	cwd: string;
	configPath: string;
}

function formatResult(result: TscRunResult, format: ResponseFormat): string {
	const parsed = parseTscOutput(result.output);

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(
			{
				cwd: result.cwd,
				configPath: result.configPath,
				timedOut: result.timedOut,
				exitCode: result.exitCode,
				errors: parsed.errors,
				errorCount: parsed.errorCount,
			},
			null,
			2,
		);
	}

	// Markdown format
	if (result.timedOut) {
		return `⏱️ TypeScript check timed out after ${TSC_TIMEOUT_MS / 1000}s in ${result.cwd}.`;
	}

	if (result.exitCode === 0 || parsed.errorCount === 0) {
		return `✅ TypeScript passed (cwd: ${result.cwd})`;
	}

	const lines: string[] = [
		`❌ ${parsed.errorCount} type error(s) (cwd: ${result.cwd})`,
		`Config: ${result.configPath}`,
	];

	for (const error of parsed.errors) {
		lines.push(`- ${error.file}:${error.line}:${error.col} — ${error.message}`);
	}

	return lines.join("\n");
}

async function resolveWorkdir(targetPath?: string): Promise<{
	cwd: string;
	configPath: string;
}> {
	const resolved = targetPath ? path.resolve(targetPath) : process.cwd();

	if (!fs.existsSync(resolved)) {
		throw new Error(`Path not found: ${resolved}`);
	}

	const stat = fs.statSync(resolved);

	// If a directory is provided, prefer a config in that directory
	if (stat.isDirectory()) {
		for (const candidate of TSC_CONFIG_FILES) {
			const candidatePath = path.join(resolved, candidate);
			if (fs.existsSync(candidatePath)) {
				return { cwd: resolved, configPath: candidatePath };
			}
		}

		// Fall back to searching upwards from the directory
		const nearest = await findNearestTsConfig(path.join(resolved, "index.ts"));
		if (nearest.found && nearest.configDir && nearest.configPath) {
			return { cwd: nearest.configDir, configPath: nearest.configPath };
		}

		throw new Error(
			`No tsconfig.json or jsconfig.json found for directory ${resolved}`,
		);
	}

	// If a file is provided, walk up to find the nearest config
	const nearest = await findNearestTsConfig(resolved);
	if (nearest.found && nearest.configDir && nearest.configPath) {
		return { cwd: nearest.configDir, configPath: nearest.configPath };
	}

	throw new Error(
		`No tsconfig.json or jsconfig.json found for file ${resolved}`,
	);
}

async function runTsc(cwd: string, configPath: string): Promise<TscRunResult> {
	const { stdout, stderr, exitCode, timedOut } = await spawnWithTimeout(
		["bunx", "tsc", "--noEmit", "--pretty", "false"],
		TSC_TIMEOUT_MS,
		{
			cwd,
			env: { ...process.env, CI: "true" },
		},
	);

	return {
		exitCode,
		timedOut,
		output: `${stdout}${stderr}`,
		cwd,
		configPath,
	};
}

tool(
	"mcp__tsc-runner_tsc-runner__tsc_check",
	{
		description:
			"Run TypeScript type checking (tsc --noEmit) using the nearest tsconfig/jsconfig.",
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe(
					"Optional file or directory to determine which tsconfig to use (default: current directory)",
				),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.default("json")
				.describe("Output format: 'markdown' or 'json' (default)"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	wrapToolHandler(
		async (args: { path?: string }, format: ResponseFormat) => {
			// Validate path for security
			const validatedPath = await validatePathOrDefault(args.path);

			// Resolve working directory and config
			const { cwd, configPath } = await resolveWorkdir(validatedPath);

			// Run TypeScript compiler
			const result = await runTsc(cwd, configPath);

			// Format and return result
			return formatResult(result, format);
		},
		{
			toolName: "tsc_check",
			logger: mcpLogger,
			createCid: createCorrelationId,
		},
	),
);

startServer("tsc-runner", {
	version: "1.0.0",
	fileLogging: {
		enabled: true,
		subsystems: ["mcp"],
		level: "info",
	},
});
