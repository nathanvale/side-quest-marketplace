#!/usr/bin/env bun
/**
 * Teams-scrape CLI entry point.
 *
 * Provides commands for processing Teams clipboard content,
 * loading stored chat history, and listing all stored chats.
 *
 * @module teams-scrape/cli
 */

import { observe } from "@side-quest/core/instrumentation";
import { getErrorMessage } from "@side-quest/core/utils";
import { cliLogger, createCorrelationId, initLogger } from "./logger.js";
import { parseTeamsClipboard } from "./parser.js";
import { listStoredChats, loadStoredChat, mergeAndSave } from "./storage.js";
import type { CliCommand } from "./types.js";

/**
 * Print usage information and exit.
 */
function printUsage(): void {
	console.log(`
teams-scrape - Extract and persist Microsoft Teams chat messages

USAGE:
  teams-scrape <command> [target]

COMMANDS:
  process <target>  Read clipboard from stdin, parse, diff, save, output result
  load <target>     Load existing chat history (read-only)
  list              List all stored chats with metadata

EXAMPLES:
  # Process clipboard content (pipe from pbpaste or macos-automator)
  pbpaste | bun run plugins/teams-scrape/src/cli.ts process "Ben Laughlin"

  # Load existing history
  bun run plugins/teams-scrape/src/cli.ts load "Ben Laughlin"

  # List all stored chats
  bun run plugins/teams-scrape/src/cli.ts list

STORAGE:
  Chat history is stored in ~/.config/teams-scrape/<target-slug>.json
  Each scrape is compared against existing history for deterministic
  new message detection.
`);
}

/**
 * Process command: Read stdin, parse, merge, save, output result.
 */
async function processCommand(target: string, cid: string): Promise<void> {
	cliLogger.info("Starting process command", { cid, target });

	// Read raw clipboard text from stdin
	const raw = await Bun.stdin.text();

	if (!raw || raw.trim().length === 0) {
		cliLogger.warn("Empty input received", { cid, target });
		console.error("Error: No input received on stdin");
		console.error("Usage: pbpaste | bun run cli.ts process <target>");
		process.exit(1);
	}

	const result = await observe(
		cliLogger,
		"processClipboard",
		async () => {
			// 1. Parse clipboard content
			cliLogger.info("Parsing clipboard content", {
				cid,
				inputLength: raw.length,
			});
			const parsed = parseTeamsClipboard(raw);
			cliLogger.info("Parsed messages", { cid, count: parsed.length });

			// 2. Merge and save (handles loading existing, deduplication, atomic write)
			const scrapeResult = await mergeAndSave(target, parsed, cid);

			return scrapeResult;
		},
		{
			onSuccess: (r) => {
				cliLogger.info("Process completed successfully", {
					cid,
					target,
					totalMessages: r.totalMessages,
					newMessages: r.newMessages.length,
				});
			},
			onError: (error) => {
				cliLogger.error("Process failed", {
					cid,
					target,
					error: getErrorMessage(error),
				});
			},
		},
	);

	// Output result as JSON
	console.log(JSON.stringify(result, null, 2));
}

/**
 * Load command: Display stored chat history.
 */
async function loadCommand(target: string, cid: string): Promise<void> {
	cliLogger.info("Starting load command", { cid, target });

	const chat = await loadStoredChat(target);

	if (!chat) {
		console.error(`No stored chat found for "${target}"`);
		process.exit(1);
	}

	// Output chat as JSON
	console.log(JSON.stringify(chat, null, 2));
}

/**
 * List command: Display all stored chats.
 */
async function listCommand(cid: string): Promise<void> {
	cliLogger.info("Starting list command", { cid });

	const result = await listStoredChats();

	// Output as JSON
	console.log(JSON.stringify(result, null, 2));
}

/**
 * Main CLI entry point.
 */
async function main(): Promise<void> {
	// Initialize logging
	await initLogger();

	const cid = createCorrelationId();
	const args = process.argv.slice(2);
	const command = args[0] as CliCommand | undefined;
	const target = args[1];

	cliLogger.info("CLI invoked", { cid, command, target, args });

	try {
		switch (command) {
			case "process":
				if (!target) {
					console.error("Error: process command requires a target name");
					printUsage();
					process.exit(1);
				}
				await processCommand(target, cid);
				break;

			case "load":
				if (!target) {
					console.error("Error: load command requires a target name");
					printUsage();
					process.exit(1);
				}
				await loadCommand(target, cid);
				break;

			case "list":
				await listCommand(cid);
				break;

			default:
				printUsage();
				process.exit(command ? 1 : 0);
		}
	} catch (error) {
		cliLogger.error("CLI failed", {
			cid,
			command,
			target,
			error: getErrorMessage(error),
		});
		console.error(`Error: ${getErrorMessage(error)}`);
		process.exit(1);
	}
}

// Run main
main().catch((error) => {
	console.error(`Fatal error: ${getErrorMessage(error)}`);
	process.exit(1);
});
