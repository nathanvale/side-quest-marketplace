#!/usr/bin/env bun

import { join } from "node:path";
import { ensureDir, pathExists } from "@sidequest/core/fs";
import { ClaudeDocsFetcher } from "./fetcher";

// Output to plugin's docs directory
const DEFAULT_OUTPUT_DIR = join(import.meta.dir, "..", "docs");

const VERSION = "1.0.0";

function showHelp() {
	console.log(`
╭─────────────────────────────────────────────────────────────╮
│  📚 Claude Code Documentation Fetcher v${VERSION}              │
│                                                             │
│  Fetch and maintain Claude Agent SDK documentation         │
│  with automatic change detection and updates.              │
╰─────────────────────────────────────────────────────────────╯

USAGE:
  bun run cli.ts [OPTIONS] [OUTPUT_DIR]

OPTIONS:
  -h, --help     Show this help message
  -v, --version  Show version information
  -f, --force    Force re-fetch all files (ignore manifest)

ARGUMENTS:
  OUTPUT_DIR     Directory to save documentation
                 Default: ./docs/ (plugin directory)

EXAMPLES:
  # Fetch/update docs to default location (plugin/docs/)
  bun run cli.ts

  # Fetch to custom directory
  bun run cli.ts /tmp/claude-docs

  # Force re-fetch all documentation
  bun run cli.ts --force

WHAT IT DOES:
  1. 🌐 Fetches sitemap from docs.claude.com
  2. 📥 Downloads Agent SDK documentation pages
  3. ✅ Validates markdown content
  4. 🔍 Detects changes via SHA256 hashing
  5. 💾 Saves only new/changed files
  6. 📑 Generates INDEX.md navigation file

OUTPUT STRUCTURE:
  plugins/claude-docs/docs/
  ├── INDEX.md           # Navigation index
  ├── manifest.json      # Change tracking
  ├── overview.md        # Individual docs
  ├── custom-tools.md
  └── ...

AUTOMATION:
  The plugin includes a PreToolUse hook that automatically
  checks for documentation updates every 24 hours.

MORE INFO:
  • GitHub: https://github.com/side-quest-marketplace
  • Tech Spec: See TECH_SPEC.md for architecture details
  • Issues: Report bugs via GitHub Issues
`);
}

function showVersion() {
	console.log(`Claude Code Documentation Fetcher v${VERSION}`);
}

async function main() {
	const args = process.argv.slice(2);

	// Handle help flag
	if (args.includes("-h") || args.includes("--help")) {
		showHelp();
		process.exit(0);
	}

	// Handle version flag
	if (args.includes("-v") || args.includes("--version")) {
		showVersion();
		process.exit(0);
	}

	// Parse force flag
	const forceRefresh = args.includes("-f") || args.includes("--force");
	const nonFlagArgs = args.filter((arg) => !arg.startsWith("-"));
	const outputDir = nonFlagArgs[0] || DEFAULT_OUTPUT_DIR;

	// Welcome banner
	console.log("");
	console.log(
		"╭─────────────────────────────────────────────────────────────╮",
	);
	console.log("│  📚 Claude Code Documentation Fetcher                      │");
	console.log(
		"╰─────────────────────────────────────────────────────────────╯",
	);
	console.log("");

	// Show configuration
	console.log("⚙️  Configuration:");
	console.log(`   📂 Output: ${outputDir}`);
	console.log(
		`   🔄 Mode: ${forceRefresh ? "Force refresh (all files)" : "Smart update (changed only)"}`,
	);
	console.log("   🌐 Source: https://code.claude.com/docs/sitemap.xml");
	console.log("");

	// Check if this is first run
	const manifestPath = join(outputDir, "manifest.json");
	const isFirstRun = !(await pathExists(manifestPath));

	if (isFirstRun) {
		console.log("🆕 First run detected - fetching all documentation...");
		console.log("   This may take a few minutes.");
	} else {
		console.log("🔍 Checking for documentation updates...");
	}
	console.log("");

	const _startTime = Date.now();

	try {
		// Ensure output directory exists
		await ensureDir(outputDir);

		const fetcher = new ClaudeDocsFetcher(outputDir);

		// Show progress
		console.log("⏳ Fetching documentation...");

		const result = await fetcher.fetch();

		const duration = (result.duration / 1000).toFixed(2);

		console.log("");
		console.log(
			"╭─────────────────────────────────────────────────────────────╮",
		);
		console.log(
			"│  ✅ Fetch Complete!                                         │",
		);
		console.log(
			"╰─────────────────────────────────────────────────────────────╯",
		);
		console.log("");
		console.log("📊 Results:");
		console.log(
			`   ✨ Fetched: ${result.fetched} ${result.fetched === 1 ? "file" : "files"}`,
		);
		console.log(
			`   ⏭️  Skipped: ${result.skipped} ${result.skipped === 1 ? "file" : "files"} (unchanged)`,
		);
		console.log(
			`   ❌ Failed:  ${result.failed} ${result.failed === 1 ? "file" : "files"}`,
		);
		console.log(
			`   📚 Total:   ${result.total} ${result.total === 1 ? "file" : "files"} processed`,
		);
		console.log(`   ⏱️  Time:    ${duration}s`);

		if (result.errors.length > 0) {
			console.log("");
			console.log("⚠️  Errors encountered:");
			for (const error of result.errors) {
				console.log(`   • ${error.url}`);
				console.log(`     ${error.error}`);
			}
		}

		console.log("");
		console.log("📁 Output files:");
		console.log(`   📑 INDEX.md at ${join(outputDir, "INDEX.md")}`);
		console.log(`   📋 manifest.json at ${join(outputDir, "manifest.json")}`);

		if (result.fetched > 0) {
			console.log("");
			console.log("💡 Tip: Use /docs command in Claude Code for easy updates!");
		}

		console.log("");

		if (result.failed > 0) {
			console.log("⚠️  Completed with errors");
			process.exit(1);
		} else {
			console.log("✨ All done! Documentation is up to date.");
			process.exit(0);
		}
	} catch (error) {
		console.log("");
		console.log(
			"╭─────────────────────────────────────────────────────────────╮",
		);
		console.log(
			"│  ❌ Error                                                    │",
		);
		console.log(
			"╰─────────────────────────────────────────────────────────────╯",
		);
		console.log("");
		console.log(`${(error as Error).message}`);
		console.log("");
		console.log("💡 Troubleshooting:");
		console.log("   • Check your internet connection");
		console.log("   • Verify the output directory is writable");
		console.log("   • Try again in a few moments");
		console.log("   • Use --help for usage information");
		console.log("");
		process.exit(1);
	}
}

main();
