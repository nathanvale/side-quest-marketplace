/**
 * Prime command - Generate or refresh PROJECT_INDEX.json
 *
 * Migrated from prime-reporter.ts to integrate with kit-index CLI.
 * Supports dual output formats (markdown with colors, or JSON).
 */

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { color, OutputFormat } from "../formatters/output";

interface IndexStats {
	files: number;
	symbols: number;
	hasTree: boolean;
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
		files: unknown[];
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
 * Report existing index (markdown format)
 */
async function reportExistingMarkdown(ageHours: number): Promise<void> {
	const stats = await parseIndexStats();
	const size = getFileSize();

	console.log(color("cyan", "\n📊 PROJECT_INDEX.json exists\n"));
	console.log(color("dim", `Age: ${ageHours.toFixed(1)} hours`));
	console.log(color("dim", `Files: ${stats.files}`));
	console.log(color("dim", `Symbols: ${stats.symbols}`));
	console.log(color("dim", `Size: ${size}`));
	console.log(
		color(
			"yellow",
			"\n⚠️  Index is less than 24 hours old. Use --force to regenerate.",
		),
	);
}

/**
 * Report existing index (JSON format)
 */
async function reportExistingJSON(ageHours: number): Promise<void> {
	const stats = await parseIndexStats();
	const size = getFileSize();

	console.log(
		JSON.stringify(
			{
				status: "exists",
				ageHours: Number.parseFloat(ageHours.toFixed(1)),
				files: stats.files,
				symbols: stats.symbols,
				size,
				message: "Index is less than 24 hours old. Use --force to regenerate.",
			},
			null,
			2,
		),
	);
}

/**
 * Report successful generation (markdown format)
 */
async function reportSuccessMarkdown(durationSec: number): Promise<void> {
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
		`  ${color("dim", "•")} ${color("magenta", "bun run src/cli.ts find <symbol>")} - Find symbol definitions`,
	);
	console.log(
		`  ${color("dim", "•")} ${color("magenta", "bun run src/cli.ts callers <fn>")} - Find who calls a function`,
	);
	console.log(
		`  ${color("dim", "•")} ${color("magenta", "bun run src/cli.ts overview <file>")} - Get file symbol summary`,
	);
	console.log(
		`  ${color("dim", "•")} ${color("magenta", "bun run src/cli.ts stats")} - Codebase overview`,
	);
}

/**
 * Report successful generation (JSON format)
 */
async function reportSuccessJSON(durationSec: number): Promise<void> {
	const stats = await parseIndexStats();
	const size = getFileSize();

	console.log(
		JSON.stringify(
			{
				success: true,
				stats: {
					files: stats.files,
					symbols: stats.symbols,
					hasTree: stats.hasTree,
					size,
					durationSec: Number.parseFloat(durationSec.toFixed(1)),
				},
			},
			null,
			2,
		),
	);
}

/**
 * Execute prime command
 *
 * @param force - Force regenerate even if index is fresh
 * @param format - Output format (markdown or JSON)
 */
export async function executePrime(
	force: boolean,
	format: OutputFormat,
): Promise<void> {
	try {
		const ageHours = getIndexAge();

		// Check if index exists and is fresh
		if (ageHours !== null && ageHours < MAX_AGE_HOURS && !force) {
			if (format === OutputFormat.JSON) {
				await reportExistingJSON(ageHours);
			} else {
				await reportExistingMarkdown(ageHours);
			}
			return;
		}

		// Generate progress indicator (markdown only)
		if (format === OutputFormat.MARKDOWN) {
			console.log(color("blue", "▶ Generating index..."));
		}

		// Generate new index
		const { durationSec } = generateIndex();

		// Report success
		if (format === OutputFormat.JSON) {
			await reportSuccessJSON(durationSec);
		} else {
			await reportSuccessMarkdown(durationSec);
		}
	} catch (error) {
		if (format === OutputFormat.JSON) {
			console.error(
				JSON.stringify(
					{
						error: error instanceof Error ? error.message : "Unknown error",
						isError: true,
					},
					null,
					2,
				),
			);
		} else {
			console.error(color("red", "\n❌ Error:"), error);

			// Check if kit is installed
			const whichResult = spawnSync("which", ["kit"], { encoding: "utf-8" });
			if (whichResult.status !== 0) {
				console.error(color("yellow", "\n💡 Kit CLI not found. Install with:"));
				console.error(color("dim", "  uv tool install cased-kit"));
				console.error(color("dim", "  # or"));
				console.error(color("dim", "  pipx install cased-kit"));
			}
		}

		process.exit(1);
	}
}
