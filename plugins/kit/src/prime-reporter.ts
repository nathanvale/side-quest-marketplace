#!/usr/bin/env bun

/**
 * Prime Reporter - Colorized output for /kit:prime command
 *
 * Generates and reports PROJECT_INDEX.json statistics with visual hierarchy
 * using Bun's built-in color support for ADHD-friendly output.
 */

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";

// ANSI color codes for terminal output
const colors = {
	reset: "\x1b[0m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	blue: "\x1b[34m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	magenta: "\x1b[35m",
};

function color(colorName: keyof typeof colors, text: string): string {
	return `${colors[colorName]}${text}${colors.reset}`;
}

interface IndexStats {
	files: number;
	symbols: number;
	hasTree: boolean;
}

interface ReportOptions {
	force?: boolean;
}

const INDEX_FILE = "PROJECT_INDEX.json";
const MAX_AGE_HOURS = 24;

/**
 * Check if index exists and return its age in hours
 */
function getIndexAge(): number | null {
	if (!existsSync(INDEX_FILE)) {
		return null;
	}

	const stats = statSync(INDEX_FILE);
	const ageMs = Date.now() - stats.mtimeMs;
	return ageMs / (1000 * 60 * 60); // Convert to hours
}

/**
 * Get human-readable file size
 */
function getFileSize(): string {
	const stats = statSync(INDEX_FILE);
	const mb = stats.size / (1024 * 1024);
	return `${mb.toFixed(2)} MB`;
}

/**
 * Parse index stats from PROJECT_INDEX.json
 */
async function parseIndexStats(): Promise<IndexStats> {
	const file = Bun.file(INDEX_FILE);
	const json = (await file.json()) as {
		files: string[];
		symbols: Record<string, unknown[]>;
		file_tree?: unknown;
	};

	const symbolCount = Object.values(json.symbols).reduce(
		(sum, arr) => sum + arr.length,
		0,
	);

	return {
		files: json.files.length,
		symbols: symbolCount,
		hasTree: json.file_tree !== undefined,
	};
}

/**
 * Generate the index using kit CLI
 */
function generateIndex(): { durationSec: number } {
	console.log(color("blue", "▶ Generating index..."));

	const startTime = Date.now();
	const result = spawnSync("kit", ["index", ".", "-o", INDEX_FILE], {
		encoding: "utf-8",
	});

	if (result.status !== 0) {
		throw new Error(`kit index failed: ${result.stderr}`);
	}

	const durationSec = (Date.now() - startTime) / 1000;
	return { durationSec };
}

/**
 * Report existing index status
 */
async function reportExisting(ageHours: number): Promise<void> {
	const stats = await parseIndexStats();
	const size = getFileSize();

	console.log(color("cyan", "\n📊 PROJECT_INDEX.json exists\n"));
	console.log(color("dim", `Age: ${ageHours.toFixed(1)} hours`));
	console.log(color("dim", `Files: ${stats.files}`));
	console.log(color("dim", `Symbols: ${stats.symbols}`));
	console.log(color("dim", `Size: ${size}`));
}

/**
 * Report successful generation
 */
async function reportSuccess(durationSec: number): Promise<void> {
	const stats = await parseIndexStats();
	const size = getFileSize();

	console.log(
		color("green", "\n✅ PROJECT_INDEX.json generated successfully\n"),
	);

	console.log(color("cyan", "Stats:"));
	console.log(
		`  ${color("dim", "•")} Files indexed: ${color("blue", stats.files.toString())}`,
	);
	console.log(
		`  ${color("dim", "•")} Symbols extracted: ${color("blue", stats.symbols.toString())}`,
	);
	console.log(`  ${color("dim", "•")} Index size: ${color("blue", size)}`);
	console.log(
		`  ${color("dim", "•")} Time taken: ${color("blue", `${durationSec.toFixed(1)}s`)}`,
	);

	console.log(color("cyan", "\nYou can now use:"));
	console.log(
		`  ${color("dim", "•")} ${color("magenta", "/kit:find <symbol>")} - Find symbol definitions`,
	);
	console.log(
		`  ${color("dim", "•")} ${color("magenta", "/kit:callers <fn>")} - Find who calls a function`,
	);
	console.log(
		`  ${color("dim", "•")} ${color("magenta", "/kit:overview <file>")} - Get file symbol summary`,
	);
	console.log(
		`  ${color("dim", "•")} ${color("magenta", "/kit:stats")} - Codebase overview`,
	);
}

/**
 * Main entry point
 */
async function main() {
	const args = process.argv.slice(2);
	const options: ReportOptions = {
		force: args.includes("--force"),
	};

	try {
		const ageHours = getIndexAge();

		// Check if index exists and is fresh
		if (ageHours !== null && ageHours < MAX_AGE_HOURS && !options.force) {
			await reportExisting(ageHours);
			console.log(
				color(
					"yellow",
					"\n⚠️  Index is less than 24 hours old. Use --force to regenerate.",
				),
			);
			process.exit(0);
		}

		// Generate new index
		const { durationSec } = generateIndex();
		await reportSuccess(durationSec);
	} catch (error) {
		console.error(color("red", "\n❌ Error:"), error);

		// Check if kit is installed
		const whichResult = spawnSync("which", ["kit"], { encoding: "utf-8" });
		if (whichResult.status !== 0) {
			console.error(color("yellow", "\n💡 Kit CLI not found. Install with:"));
			console.error(color("dim", "  uv tool install cased-kit"));
			console.error(color("dim", "  # or"));
			console.error(color("dim", "  pipx install cased-kit"));
		}

		process.exit(1);
	}
}

main();
