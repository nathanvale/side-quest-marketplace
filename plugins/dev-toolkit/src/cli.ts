#!/usr/bin/env bun

/**
 * Dev Toolkit CLI
 *
 * Command-line interface for developer experience tools:
 * - Create new CLI templates (scaffold)
 * - Review CLI implementations against the Bun CLI standard
 * - Output formats: markdown (default) for humans, JSON for machines
 */

import { parseArgs } from "@sidequest/core/cli";
import {
	color,
	OutputFormat,
	parseOutputFormat,
} from "@sidequest/core/formatters";
import { createTemplateCommand } from "./commands/create-template";
import { reviewTemplateCommand } from "./commands/review-template";

/**
 * Print CLI usage information
 */
function printUsage(): void {
	const lines = [
		color("cyan", "Dev Toolkit CLI"),
		"",
		"Usage:",
		"  dev-toolkit create-template <name> [--dest path] [--format md|json]",
		"  dev-toolkit review-template <path> [--format md|json]",
		"  dev-toolkit help",
		"",
		"Commands:",
		"  create-template  Scaffold a new CLI template with all patterns",
		"  review-template  Review a CLI against the Bun CLI standard",
		"  help             Show this help message",
		"",
		"Options:",
		"  --dest path      Destination directory (default: current directory)",
		"  --format md|json Output format (default: md)",
		"",
		"Examples:",
		"  dev-toolkit create-template my-cli --dest ./plugins",
		"  dev-toolkit review-template ./plugins/my-cli/src/cli.ts",
		"  dev-toolkit review-template . --format json",
	];

	console.log(
		lines.map((line) => (line === "" ? "" : color("cyan", line))).join("\n"),
	);
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
	try {
		const args = process.argv.slice(2);
		const parsed = parseArgs(args);
		const { command, subcommand, flags } = parsed;
		const formatFlag =
			typeof flags.format === "string" ? flags.format : undefined;
		const outputFormat = parseOutputFormat(formatFlag) ?? "md";

		// Handle help flag or no command
		if (!command || command === "help" || flags.help) {
			printUsage();
			process.exit(0);
		}

		// Dispatch to command handlers
		switch (command) {
			case "create-template": {
				if (!subcommand) {
					console.error("Error: create-template requires a template name");
					console.error(
						"Usage: dev-toolkit create-template <name> [--dest path]",
					);
					process.exit(1);
				}
				const name = subcommand;
				const destFlag = flags.dest;
				const dest = typeof destFlag === "string" ? destFlag : ".";
				await createTemplateCommand(name, dest, outputFormat);
				break;
			}

			case "review-template": {
				if (!subcommand) {
					console.error("Error: review-template requires a path to review");
					console.error("Usage: dev-toolkit review-template <path>");
					process.exit(1);
				}
				const path = subcommand;
				await reviewTemplateCommand(path, outputFormat);
				break;
			}

			default: {
				console.error(`Error: Unknown command: ${command}`);
				console.error("Run 'dev-toolkit help' for usage information");
				process.exit(1);
			}
		}
	} catch (error) {
		console.error(
			"Error:",
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
}

main();
