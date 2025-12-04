#!/usr/bin/env bun

/**
 * Kit Index CLI
 *
 * Command-line interface for PROJECT_INDEX.json management.
 * Centralizes all index operations with dual output formats (markdown/JSON).
 *
 * Usage:
 *   bun run src/cli.ts <command> [args] [--format md|json]
 *
 * Based on cinema-bandit CLI architecture pattern.
 */

import { parseOutputFormat } from "./formatters/output";
import { parseArgs } from "./utils/args";

function printUsage() {
	console.log(`
Kit Index CLI - PROJECT_INDEX.json Management

Usage:
  bun run src/cli.ts prime [--force]
  bun run src/cli.ts find <symbol> [--format md|json]
  bun run src/cli.ts overview <file> [--format md|json]
  bun run src/cli.ts callers <function> [--format md|json]
  bun run src/cli.ts calls <function> [--format md|json]
  bun run src/cli.ts deps <file> [--format md|json]
  bun run src/cli.ts dead [path] [--format md|json]
  bun run src/cli.ts blast <file:line|symbol> [--format md|json]
  bun run src/cli.ts api <directory> [--format md|json]
  bun run src/cli.ts stats [--format md|json]

Commands:
  prime       Generate/refresh PROJECT_INDEX.json
              Options: --force (regenerate even if < 24h old)

  find        Find symbol definitions by name
              Args: <symbol> - Symbol name to search for

  overview    List all symbols in a file
              Args: <file> - File path (relative or absolute)

  callers     Find who calls a function (call sites)
              Args: <function> - Function name to analyze

  calls       Find what a function calls (dependencies)
              Args: <function> - Function name to analyze

  deps        Show import/export relationships for a file
              Args: <file> - File path to analyze

  dead        Find unused exports (dead code detection)
              Args: [path] - Optional directory to scope search

  blast       Blast radius analysis (multi-level impact)
              Args: <file:line|symbol> - File location or symbol name

  api         List module public API (all exports)
              Args: <directory> - Directory path to analyze

  stats       Codebase health metrics and overview

Options:
  --format <type>   Output format: "md" (default) or "json"
                    Markdown is human-readable with colors
                    JSON is machine-readable for parsing

  --force           Force regenerate (prime command only)
  --help            Show this help message

Examples:
  # Generate index
  bun run src/cli.ts prime

  # Find symbol
  bun run src/cli.ts find MyFunction

  # Get file overview
  bun run src/cli.ts overview src/index.ts

  # Find callers with JSON output
  bun run src/cli.ts callers executeFind --format json

  # Check codebase stats
  bun run src/cli.ts stats
`);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	// Show help if no args or --help flag
	if (args.length === 0 || args.includes("--help")) {
		printUsage();
		process.exit(0);
	}

	const { command, positional, flags } = parseArgs(args);
	const format = parseOutputFormat(flags.format);

	try {
		switch (command) {
			case "prime": {
				const { executePrime } = await import("./commands/prime");
				await executePrime(flags.force === "true", format);
				break;
			}

			case "find": {
				const symbol = positional[0];
				if (!symbol) {
					console.error("Error: <symbol> required for find command");
					console.error("Usage: bun run src/cli.ts find <symbol>");
					process.exit(1);
				}
				const { executeFind } = await import("./commands/find");
				await executeFind(symbol, format);
				break;
			}

			case "overview": {
				const file = positional[0];
				if (!file) {
					console.error("Error: <file> required for overview command");
					console.error("Usage: bun run src/cli.ts overview <file>");
					process.exit(1);
				}
				const { executeOverview } = await import("./commands/overview");
				await executeOverview(file, format);
				break;
			}

			case "callers": {
				const functionName = positional[0];
				if (!functionName) {
					console.error("Error: <function> required for callers command");
					console.error("Usage: bun run src/cli.ts callers <function>");
					process.exit(1);
				}
				const { executeCallers } = await import("./commands/callers");
				await executeCallers(functionName, format);
				break;
			}

			case "calls": {
				const functionName = positional[0];
				if (!functionName) {
					console.error("Error: <function> required for calls command");
					console.error("Usage: bun run src/cli.ts calls <function>");
					process.exit(1);
				}
				const { executeCalls } = await import("./commands/calls");
				await executeCalls(functionName, format);
				break;
			}

			case "deps": {
				const file = positional[0];
				if (!file) {
					console.error("Error: <file> required for deps command");
					console.error("Usage: bun run src/cli.ts deps <file>");
					process.exit(1);
				}
				const { executeDeps } = await import("./commands/deps");
				await executeDeps(file, format);
				break;
			}

			case "dead": {
				const path = positional[0]; // Optional
				const { executeDead } = await import("./commands/dead");
				await executeDead(path, format);
				break;
			}

			case "blast": {
				const target = positional[0];
				if (!target) {
					console.error("Error: <file:line|symbol> required for blast command");
					console.error("Usage: bun run src/cli.ts blast <file:line|symbol>");
					process.exit(1);
				}
				const { executeBlast } = await import("./commands/blast");
				await executeBlast(target, format);
				break;
			}

			case "api": {
				const directory = positional[0];
				if (!directory) {
					console.error("Error: <directory> required for api command");
					console.error("Usage: bun run src/cli.ts api <directory>");
					process.exit(1);
				}
				const { executeApi } = await import("./commands/api");
				await executeApi(directory, format);
				break;
			}

			case "stats": {
				const { executeStats } = await import("./commands/stats");
				await executeStats(format);
				break;
			}

			default:
				console.error(`Unknown command: ${command}`);
				console.error("Run 'bun run src/cli.ts --help' for usage");
				process.exit(1);
		}
	} catch (error) {
		console.error("Error:", error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

main();
