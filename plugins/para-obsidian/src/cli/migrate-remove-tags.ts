/**
 * Migration script to remove tags field from all notes (v1.0.0 migration).
 *
 * This command scans all markdown files in the vault and removes the `tags`
 * frontmatter field. Useful when migrating from frontmatter tags to inline tags
 * or when cleaning up legacy tag systems.
 *
 * @module cli/migrate-remove-tags
 */

import fs from "node:fs";
import path from "node:path";
import { color, emphasize } from "@sidequest/core/terminal";
import { glob } from "glob";
import type { ParaObsidianConfig } from "../config/index";
import { parseFrontmatter, serializeFrontmatter } from "../frontmatter/index";
import { atomicWriteFile } from "../shared/atomic-fs.js";
import type { CommandContext, CommandResult } from "./types";

/**
 * Result of a migration operation.
 */
export interface MigrationResult {
	/** Total number of markdown files scanned */
	totalFiles: number;
	/** Number of files modified (had tags field removed) */
	modifiedFiles: number;
	/** Errors encountered during migration */
	errors: Array<{ file: string; error: string }>;
	/** Changes made to files */
	changes: Array<{ file: string; removedTags: string | readonly string[] }>;
}

/**
 * Remove tags field from all notes in the vault.
 *
 * This function scans all .md files in the vault, parses their frontmatter,
 * and removes the `tags` field if present. It supports both string and array
 * tag values.
 *
 * @param config - Para Obsidian configuration with vault path
 * @param options - Migration options
 * @returns Migration result with statistics and changes
 *
 * @example
 * ```typescript
 * const result = await migrateRemoveTags(config, { dryRun: true, verbose: true });
 * console.log(`Would modify ${result.modifiedFiles} files`);
 * ```
 */
export async function migrateRemoveTags(
	config: ParaObsidianConfig,
	options: {
		dryRun?: boolean;
		verbose?: boolean;
	} = {},
): Promise<MigrationResult> {
	const { dryRun = false, verbose = false } = options;

	const result: MigrationResult = {
		totalFiles: 0,
		modifiedFiles: 0,
		errors: [],
		changes: [],
	};

	// Find all markdown files in vault
	const pattern = path.join(config.vault, "**/*.md");
	const files = await glob(pattern, {
		nodir: true,
		absolute: true,
	});

	result.totalFiles = files.length;

	if (verbose) {
		console.log(color("cyan", `\nScanning ${files.length} markdown files...`));
	}

	// Process each file
	for (const filePath of files) {
		try {
			// Read file content
			const content = fs.readFileSync(filePath, "utf-8");

			// Parse frontmatter
			const { attributes, body } = parseFrontmatter(content);

			// Check if tags field exists
			if (!("tags" in attributes)) {
				if (verbose) {
					console.log(
						color(
							"dim",
							`  ⊘ No tags: ${path.relative(config.vault, filePath)}`,
						),
					);
				}
				continue;
			}

			// Extract tags for reporting
			const removedTags = attributes.tags;

			// Remove tags field
			const { tags: _removed, ...rest } = attributes;

			// Reconstruct frontmatter
			const newContent = serializeFrontmatter(rest, body);

			// Write back to file (if not dry-run)
			// Uses atomic write (temp + rename) to prevent partial corruption
			if (!dryRun) {
				await atomicWriteFile(filePath, newContent);
			}

			// Track change
			result.modifiedFiles++;
			result.changes.push({
				file: path.relative(config.vault, filePath),
				removedTags:
					typeof removedTags === "string"
						? removedTags
						: Array.isArray(removedTags)
							? [...removedTags]
							: String(removedTags),
			});

			if (verbose) {
				const tagsDisplay =
					typeof removedTags === "string"
						? removedTags
						: Array.isArray(removedTags)
							? removedTags.join(", ")
							: String(removedTags);
				console.log(
					color(
						"green",
						`  ✓ ${dryRun ? "Would remove" : "Removed"}: ${path.relative(config.vault, filePath)}`,
					),
				);
				console.log(color("dim", `    Tags: ${tagsDisplay}`));
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			result.errors.push({
				file: path.relative(config.vault, filePath),
				error: errorMsg,
			});

			if (verbose) {
				console.log(
					color("red", `  ✗ Error: ${path.relative(config.vault, filePath)}`),
				);
				console.log(color("dim", `    ${errorMsg}`));
			}
		}
	}

	return result;
}

/**
 * Handle migrate:remove-tags command.
 *
 * CLI handler that orchestrates the migration, validates options,
 * and formats output according to the requested format (JSON or Markdown).
 */
export async function handleMigrateRemoveTags(
	ctx: CommandContext,
): Promise<CommandResult> {
	const { config, flags, isJson } = ctx;

	const dryRun = flags["dry-run"] === true;
	const verbose = flags.verbose === true;

	if (!isJson && !dryRun) {
		console.log(
			color("yellow", "\n⚠ This will modify all notes in your vault!"),
		);
		console.log(emphasize.info("Run with --dry-run first to preview changes."));
		console.log();
	}

	try {
		const result = await migrateRemoveTags(config, { dryRun, verbose });

		// Output results
		if (isJson) {
			console.log(
				JSON.stringify(
					{
						success: true,
						totalFiles: result.totalFiles,
						modifiedFiles: result.modifiedFiles,
						errors: result.errors,
						changes: result.changes,
						dryRun,
					},
					null,
					2,
				),
			);
		} else {
			console.log(color("cyan", "\n=== Migration Results ==="));
			console.log(`Total files scanned: ${result.totalFiles}`);
			console.log(
				`Files ${dryRun ? "to modify" : "modified"}: ${result.modifiedFiles}`,
			);
			console.log(`Errors: ${result.errors.length}`);

			if (result.errors.length > 0) {
				console.log(color("red", "\nErrors:"));
				for (const error of result.errors) {
					console.log(`  ${error.file}: ${error.error}`);
				}
			}

			if (dryRun && result.modifiedFiles > 0) {
				console.log(
					emphasize.info(
						"\n[DRY-RUN] No files were modified. Run without --dry-run to apply changes.",
					),
				);
			} else if (!dryRun && result.modifiedFiles > 0) {
				console.log(
					color(
						"green",
						`\n✓ Successfully removed tags from ${result.modifiedFiles} files.`,
					),
				);
			} else if (result.modifiedFiles === 0) {
				console.log(color("yellow", "\nNo files with tags field found."));
			}

			console.log();
		}

		return { success: true };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";

		if (isJson) {
			console.log(
				JSON.stringify({
					success: false,
					error: errorMsg,
				}),
			);
		} else {
			console.log(color("red", `\nMigration failed: ${errorMsg}`));
		}

		return { success: false, exitCode: 1 };
	}
}
