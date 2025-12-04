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
  bun run src/cli.ts prime [path] [--force] [--format md|json]
  bun run src/cli.ts find <symbol> [--format md|json]
  bun run src/cli.ts overview <file> [--format md|json]
  bun run src/cli.ts search <query> [--path <dir>] [--top-k N] [--chunk-by symbols|lines] [--build-index] [--format md|json]
  bun run src/cli.ts callers <function> [--format md|json]
  bun run src/cli.ts calls <function> [--format md|json]
  bun run src/cli.ts deps <file> [--format md|json]
  bun run src/cli.ts dead [path] [--format md|json]
  bun run src/cli.ts blast <file:line|symbol> [--format md|json]
  bun run src/cli.ts api <directory> [--format md|json]
  bun run src/cli.ts stats [--format md|json]
  bun run src/cli.ts commit [--dry-run] [--model <model>] [--format md|json]
  bun run src/cli.ts summarize <pr-url> [--update-pr-body] [--model <model>] [--format md|json]

Commands:
  prime       Generate/refresh PROJECT_INDEX.json
              Args: [path] - Optional directory to index (defaults to git root or CWD)
              Options: --force (regenerate even if < 24h old)

  find        Find symbol definitions by name
              Args: <symbol> - Symbol name to search for

  overview    List all symbols in a file
              Args: <file> - File path (relative or absolute)

  search      Semantic search using natural language
              Args: <query> - Natural language search query
              Options:
                --path <dir> - Directory to search (default: git root)
                --top-k <N> - Number of results (default: 5)
                --chunk-by <mode> - Chunking strategy: symbols|lines (default: symbols)
                --build-index - Force rebuild vector index

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

  grep        Fast text search across repository files
              Args: <pattern> - Text or regex pattern to search for
              Options: --path, --include, --exclude, --case-insensitive, --max-results, --directory

  commit      Generate AI commit message from staged changes
              Options: --dry-run (default: true), --model <model>

  summarize   Generate PR summary using Kit CLI
              Args: <pr-url> - GitHub PR URL (https://github.com/owner/repo/pull/123)
              Options: --update-pr-body (update PR description), --model <model> (override LLM)

Options:
  --format <type>   Output format: "md" (default) or "json"
                    Markdown is human-readable with colors
                    JSON is machine-readable for parsing

  --force           Force regenerate (prime command only)
  --help            Show this help message

Examples:
  # Generate index at git root
  bun run src/cli.ts prime

  # Generate index for specific directory
  bun run src/cli.ts prime /path/to/project

  # Force regenerate
  bun run src/cli.ts prime --force

  # Find symbol
  bun run src/cli.ts find MyFunction

  # Get file overview
  bun run src/cli.ts overview src/index.ts

  # Find callers with JSON output
  bun run src/cli.ts callers executeFind --format json

  # Check codebase stats
  bun run src/cli.ts stats

  # Generate commit message (dry run)
  bun run src/cli.ts commit

  # Actually commit
  bun run src/cli.ts commit --dry-run=false

  # Use specific model
  bun run src/cli.ts commit --model claude-sonnet-4-20250514

  # Generate PR summary
  bun run src/cli.ts summarize https://github.com/owner/repo/pull/123

  # Update PR body with summary
  bun run src/cli.ts summarize https://github.com/owner/repo/pull/123 --update-pr-body true
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
				const path = positional[0]; // Optional path argument
				const { executePrime } = await import("./commands/prime");
				await executePrime(flags.force === "true", format, path);
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

			case "search": {
				const query = positional[0];
				if (!query) {
					console.error("Error: <query> required for search command");
					console.error("Usage: bun run src/cli.ts search <query> [options]");
					process.exit(1);
				}

				const { executeSearch } = await import("./commands/search");

				// Parse options
				const options = {
					path: flags.path,
					topK: flags["top-k"] ? Number(flags["top-k"]) : undefined,
					chunkBy: flags["chunk-by"] as "symbols" | "lines" | undefined,
					buildIndex: flags["build-index"] === "true",
				};

				await executeSearch(query, options, format);
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

			case "commit": {
				const dryRun = flags["dry-run"] !== "false"; // Default to true (safe)
				const model = flags.model as string | undefined;
				const { executeCommit } = await import("./commands/commit");
				await executeCommit(dryRun, model, format);
				break;
			}

			case "grep": {
				const pattern = positional[0];
				if (!pattern) {
					console.error("Error: <pattern> required for grep command");
					console.error("Usage: bun run src/cli.ts grep <pattern> [options]");
					process.exit(1);
				}
				const { executeGrep } = await import("./commands/grep");

				// Parse options from flags
				const options = {
					path: flags.path,
					include: flags.include,
					exclude: flags.exclude,
					caseSensitive: flags["case-insensitive"] !== "true",
					maxResults: flags["max-results"]
						? Number.parseInt(flags["max-results"], 10)
						: undefined,
					directory: flags.directory,
				};

				await executeGrep(pattern, format, options);
				break;
			}

			case "summarize": {
				const prUrl = positional[0];
				if (!prUrl) {
					console.error("Error: <pr-url> required for summarize command");
					console.error(
						"Usage: bun run src/cli.ts summarize <pr-url> [--update-pr-body] [--model <model>]",
					);
					process.exit(1);
				}
				const updatePrBody = flags["update-pr-body"] === "true";
				const model = flags.model;
				const { executeSummarize } = await import("./commands/summarize");
				await executeSummarize(prUrl, updatePrBody, model, format);
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
