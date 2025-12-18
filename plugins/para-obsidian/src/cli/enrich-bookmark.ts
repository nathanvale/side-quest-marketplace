/**
 * Enrich Bookmark CLI Command
 *
 * Enriches bookmark metadata using Firecrawl to scrape the original page
 * and LLM to improve titles and generate summaries.
 *
 * Supports:
 * - Single file: para enrich-bookmark path/to/file.md
 * - Glob pattern: para enrich-bookmark "*.md" (filters to type:bookmark)
 * - Direct URL: para enrich-bookmark --url https://example.com
 *
 * @module cli/enrich-bookmark
 */

import { basename, join } from "node:path";
import { confirm } from "@inquirer/prompts";
import { color, emphasize } from "@sidequest/core/terminal";
import { glob } from "glob";
import { createSpinner } from "nanospinner";
import { parseFrontmatter, serializeFrontmatter } from "../frontmatter";
import {
	type BatchEnrichmentResult,
	type BookmarkEnrichment,
	BookmarkEnrichmentError,
	enrichBookmarkWithFirecrawl,
	RateLimiter,
} from "../inbox/enrich";
import { extractFrontmatterOnly } from "../inbox/scan/extractors/markdown";
import type { CommandContext, CommandResult } from "./types";

/**
 * Parsed arguments for the enrich-bookmark command.
 */
interface EnrichBookmarkArgs {
	/** File path or glob pattern */
	pattern?: string;
	/** Direct URL to enrich (creates output to stdout) */
	url?: string;
	/** Dry run - show what would be done */
	dryRun: boolean;
	/** Force re-enrichment even if already done */
	force: boolean;
	/** Delay between requests in ms */
	delay: number;
	/** Skip confirmation prompt */
	yes: boolean;
}

/**
 * Parse command-line arguments for enrich-bookmark.
 */
function parseArgs(
	flags: Record<string, unknown>,
	positional: readonly string[],
): EnrichBookmarkArgs {
	return {
		pattern: positional[0],
		url: typeof flags.url === "string" ? flags.url : undefined,
		dryRun: flags["dry-run"] === true,
		force: flags.force === true,
		delay: typeof flags.delay === "number" ? flags.delay : 2000,
		yes: flags.yes === true || flags.y === true,
	};
}

/**
 * Check if a file is a bookmark by reading its frontmatter.
 */
async function isBookmarkFile(filePath: string): Promise<boolean> {
	try {
		const frontmatter = await extractFrontmatterOnly(filePath);
		return frontmatter.type === "bookmark";
	} catch {
		return false;
	}
}

/**
 * Check if a file has already been enriched.
 */
async function isAlreadyEnriched(filePath: string): Promise<boolean> {
	try {
		const frontmatter = await extractFrontmatterOnly(filePath);
		return frontmatter.enrichedAt !== undefined;
	} catch {
		return false;
	}
}

/**
 * Get the URL from a bookmark file's frontmatter.
 */
async function getBookmarkUrl(filePath: string): Promise<string | null> {
	try {
		const frontmatter = await extractFrontmatterOnly(filePath);
		const url = frontmatter.url;
		return typeof url === "string" ? url : null;
	} catch {
		return null;
	}
}

/**
 * Apply enrichment to a bookmark file.
 * Updates frontmatter with improved title and summary.
 */
async function applyEnrichment(
	filePath: string,
	enrichment: BookmarkEnrichment,
): Promise<void> {
	const content = await Bun.file(filePath).text();
	const { attributes, body } = parseFrontmatter(content);

	// Update frontmatter with enrichment data
	const updatedAttributes = {
		...attributes,
		title: enrichment.formattedTitle,
		originalTitle: enrichment.originalTitle,
		summary: enrichment.summary,
		domain: enrichment.domain,
		enrichedAt: enrichment.enrichedAt,
	};

	// Rebuild the file
	const updatedContent = serializeFrontmatter(updatedAttributes, body);
	await Bun.write(filePath, updatedContent);
}

/**
 * Enrich a single bookmark file.
 */
async function enrichSingleFile(
	filePath: string,
	args: EnrichBookmarkArgs,
): Promise<{
	success: boolean;
	enrichment?: BookmarkEnrichment;
	error?: string;
}> {
	// Check if it's a bookmark
	if (!(await isBookmarkFile(filePath))) {
		return { success: false, error: "Not a bookmark file (type != bookmark)" };
	}

	// Check if already enriched (unless --force)
	if (!args.force && (await isAlreadyEnriched(filePath))) {
		return {
			success: false,
			error: "Already enriched (use --force to re-enrich)",
		};
	}

	// Get URL from frontmatter
	const url = await getBookmarkUrl(filePath);
	if (!url) {
		return { success: false, error: "No URL found in frontmatter" };
	}

	// Get original title
	const frontmatter = await extractFrontmatterOnly(filePath);
	const originalTitle =
		(frontmatter.title as string) || basename(filePath, ".md");

	// Dry run - just show what would happen
	if (args.dryRun) {
		return {
			success: true,
			enrichment: {
				originalTitle,
				improvedTitle: "[would be improved]",
				formattedTitle: `Bookmark [would be improved]`,
				summary: "[would be generated]",
				domain: new URL(url).hostname,
				enrichedAt: new Date().toISOString(),
			},
		};
	}

	// Perform enrichment
	try {
		const enrichment = await enrichBookmarkWithFirecrawl(url, originalTitle, {
			maxRetries: 3,
			baseDelayMs: 1000,
		});

		// Apply to file
		await applyEnrichment(filePath, enrichment);

		return { success: true, enrichment };
	} catch (error) {
		if (error instanceof BookmarkEnrichmentError) {
			return { success: false, error: `${error.code}: ${error.message}` };
		}
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Handle the enrich-bookmark command.
 */
export async function handleEnrichBookmark(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, flags, positional, subcommand, isJson } = ctx;
	// The file/pattern comes as subcommand (first positional after command name)
	const allPositional = subcommand
		? [subcommand, ...positional]
		: [...positional];
	const args = parseArgs(flags, allPositional);

	// Mode 1: Direct URL (output to stdout, no file modification)
	if (args.url) {
		return handleDirectUrl(args.url, isJson);
	}

	// Mode 2: File/glob pattern
	if (!args.pattern) {
		console.error(
			color("red", "Error: Please provide a file path, glob pattern, or --url"),
		);
		console.log("\nUsage:");
		console.log("  para enrich-bookmark <file.md>        # Single file");
		console.log(
			'  para enrich-bookmark "**/*.md"        # Glob pattern (filters to type:bookmark)',
		);
		console.log(
			"  para enrich-bookmark --url <url>      # Direct URL (outputs to stdout)",
		);
		console.log("\nOptions:");
		console.log(
			"  --dry-run    Show what would be done without making changes",
		);
		console.log("  --force      Re-enrich even if already enriched");
		console.log("  --delay N    Delay between requests in ms (default: 2000)");
		console.log("  --yes, -y    Skip confirmation prompt");
		return { success: false };
	}

	// Resolve files from pattern
	const vaultPath = config.vault;
	const isGlob = args.pattern.includes("*");

	let filePaths: string[];
	if (isGlob) {
		// Glob pattern - resolve relative to vault
		const pattern = args.pattern.startsWith("/")
			? args.pattern
			: join(vaultPath, args.pattern);
		filePaths = await glob(pattern, { nodir: true });
	} else {
		// Single file - resolve relative to vault if not absolute
		const filePath = args.pattern.startsWith("/")
			? args.pattern
			: join(vaultPath, args.pattern);
		filePaths = [filePath];
	}

	if (filePaths.length === 0) {
		console.error(color("red", `No files found matching: ${args.pattern}`));
		return { success: false };
	}

	// Filter to bookmark files only
	const bookmarkFiles: string[] = [];
	const spinner = createSpinner("Scanning for bookmark files...").start();

	for (const filePath of filePaths) {
		if (await isBookmarkFile(filePath)) {
			bookmarkFiles.push(filePath);
		}
	}

	spinner.success({ text: `Found ${bookmarkFiles.length} bookmark file(s)` });

	if (bookmarkFiles.length === 0) {
		console.log(
			color(
				"yellow",
				"No bookmark files found (files must have type: bookmark in frontmatter)",
			),
		);
		return { success: true };
	}

	// Show preview and confirm
	if (!args.yes && !args.dryRun) {
		console.log("\nFiles to enrich:");
		for (const filePath of bookmarkFiles.slice(0, 10)) {
			const relativePath = filePath.replace(vaultPath + "/", "");
			console.log(`  ${color("cyan", "→")} ${relativePath}`);
		}
		if (bookmarkFiles.length > 10) {
			console.log(`  ... and ${bookmarkFiles.length - 10} more`);
		}

		const proceed = await confirm({
			message: `Enrich ${bookmarkFiles.length} bookmark(s)?`,
			default: true,
		});

		if (!proceed) {
			console.log(emphasize.info("Cancelled."));
			return { success: true };
		}
	}

	// Process files with rate limiting
	const rateLimiter = new RateLimiter(args.delay);
	const result: BatchEnrichmentResult = {
		succeeded: 0,
		failed: 0,
		skipped: 0,
		total: bookmarkFiles.length,
		details: [],
	};

	const details: BatchEnrichmentResult["details"][number][] = [];

	for (let i = 0; i < bookmarkFiles.length; i++) {
		const filePath = bookmarkFiles[i]!;
		const relativePath = filePath.replace(vaultPath + "/", "");

		// Rate limit (except for first request)
		if (i > 0) {
			await rateLimiter.wait();
		}

		const progressSpinner = createSpinner(
			`[${i + 1}/${bookmarkFiles.length}] ${relativePath}`,
		).start();

		const enrichResult = await enrichSingleFile(filePath, args);

		if (enrichResult.success) {
			if (enrichResult.enrichment) {
				progressSpinner.success({
					text: `[${i + 1}/${bookmarkFiles.length}] ${relativePath} → ${enrichResult.enrichment.formattedTitle}`,
				});
				details.push({
					path: relativePath,
					status: "success",
					enrichment: enrichResult.enrichment,
				});
				(result as { succeeded: number }).succeeded++;
			}
		} else if (
			enrichResult.error?.includes("Already enriched") ||
			enrichResult.error?.includes("Not a bookmark")
		) {
			progressSpinner.warn({
				text: `[${i + 1}/${bookmarkFiles.length}] ${relativePath} - ${enrichResult.error}`,
			});
			details.push({
				path: relativePath,
				status: "skipped",
				reason: enrichResult.error,
			});
			(result as { skipped: number }).skipped++;
		} else {
			progressSpinner.error({
				text: `[${i + 1}/${bookmarkFiles.length}] ${relativePath} - ${enrichResult.error}`,
			});
			details.push({
				path: relativePath,
				status: "failed",
				reason: enrichResult.error,
			});
			(result as { failed: number }).failed++;
		}
	}

	// Final summary
	console.log("");
	if (result.succeeded > 0) {
		console.log(color("green", `✓ Enriched: ${result.succeeded}`));
	}
	if (result.skipped > 0) {
		console.log(color("yellow", `○ Skipped: ${result.skipped}`));
	}
	if (result.failed > 0) {
		console.log(color("red", `✗ Failed: ${result.failed}`));
	}

	if (isJson) {
		console.log(JSON.stringify({ ...result, details }, null, 2));
	}

	return { success: result.failed === 0 };
}

/**
 * Handle direct URL mode - enrich and output to stdout.
 */
async function handleDirectUrl(
	url: string,
	isJson: boolean,
): Promise<CommandResult> {
	const spinner = createSpinner(`Enriching ${url}...`).start();

	try {
		const enrichment = await enrichBookmarkWithFirecrawl(url, "Untitled", {
			maxRetries: 3,
			baseDelayMs: 1000,
		});

		spinner.success({ text: "Enriched successfully" });

		if (isJson) {
			console.log(JSON.stringify(enrichment, null, 2));
		} else {
			console.log("");
			console.log(`${color("cyan", "Title:")} ${enrichment.formattedTitle}`);
			console.log(`${color("cyan", "Summary:")} ${enrichment.summary}`);
			console.log(`${color("cyan", "Domain:")} ${enrichment.domain}`);
			console.log(`${color("cyan", "Enriched:")} ${enrichment.enrichedAt}`);
		}

		return { success: true };
	} catch (error) {
		if (error instanceof BookmarkEnrichmentError) {
			spinner.error({ text: `${error.code}: ${error.message}` });
			if (error.retryable) {
				console.log(
					emphasize.info("This error is retryable. Please try again later."),
				);
			}
		} else {
			spinner.error({
				text: error instanceof Error ? error.message : "Unknown error",
			});
		}
		return { success: false };
	}
}
