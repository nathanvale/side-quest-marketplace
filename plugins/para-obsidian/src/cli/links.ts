/**
 * Links CLI commands.
 *
 * Handles commands for managing links and attachments in the vault.
 *
 * Commands:
 * - rename: Rename a note and update all links to it
 * - link-attachments: Link orphan attachments to notes
 * - find-orphans: Find broken links and orphan attachments
 * - clean-broken-links: Remove broken links from notes
 * - rewrite-links: Bulk rewrite links from one target to another
 *
 * @module cli/links
 */

import path from "node:path";
import { pathExistsSync, readTextFileSync } from "@side-quest/core/fs";
import { emphasize } from "@side-quest/core/terminal";
import { getErrorMessage } from "@side-quest/core/utils";
import { linkAttachmentsToNotes } from "../attachments/link";
import {
	autoCommitChanges,
	commitAllNotes,
	ensureGitGuard,
} from "../git/index";
import { cleanBrokenLinks } from "../links/clean";
import { renameWithLinkRewrite } from "../links/index";
import { findOrphans, formatFixCommand, suggestFixes } from "../links/orphans";
import { type RewriteMapping, rewriteLinks } from "../links/rewrite";
import type { CommandContext, CommandHandler, CommandResult } from "./types";
import { normalizeFlagValue, parseAttachments, parseDirs } from "./utils";

/**
 * Handle the 'rename' command.
 */
export const handleRename: CommandHandler = async (
	ctx: CommandContext,
): Promise<CommandResult> => {
	const { config, positional, flags, isJson, subcommand } = ctx;

	const from = subcommand;
	const to = positional[0];
	if (!from || !to) {
		console.error("rename requires <from> <to>");
		return { success: false, exitCode: 1 };
	}

	const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
	const attachments = parseAttachments(flags);

	if (!dryRun) {
		await ensureGitGuard(config);
	}

	const result = renameWithLinkRewrite(config, { from, to, dryRun });

	if (config.autoCommit && !dryRun) {
		const paths = [
			from,
			to,
			...result.rewrites.map((r) => r.file),
			...attachments,
		];
		await autoCommitChanges(config, paths, `rename ${from} → ${to}`);
	}

	if (isJson) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(
			emphasize.info(
				`${dryRun ? "Would rename" : "Renamed"} ${from} → ${to} (rewrites: ${result.rewrites.length})`,
			),
		);
	}

	return { success: true };
};

/**
 * Handle the 'link-attachments' command.
 */
export const handleLinkAttachments: CommandHandler = async (
	ctx: CommandContext,
): Promise<CommandResult> => {
	const { config, flags, isJson, subcommand } = ctx;

	const dir = subcommand;
	if (!dir) {
		console.error(emphasize.error("Usage: link-attachments <directory>"));
		console.error(
			"Example: link-attachments '01 Projects/2025 Tassie Holiday'",
		);
		return { success: false, exitCode: 1 };
	}

	const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
	const threshold =
		typeof flags.threshold === "number"
			? flags.threshold
			: typeof flags.threshold === "string"
				? Number.parseFloat(flags.threshold)
				: 0.3;

	if (!dryRun) {
		await ensureGitGuard(config);
	}

	const result = await linkAttachmentsToNotes(config.vault, dir, {
		dryRun,
		threshold,
	});

	if (isJson) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(
			emphasize.success(
				`${dryRun ? "Would link" : "Linked"} ${result.totalLinks} attachments to ${result.notesUpdated} notes`,
			),
		);
		if (result.notesUpdated > 0) {
			console.log("\nLinked attachments:");
			for (const { note, attachments } of result.updates) {
				console.log(`  ${note}:`);
				for (const att of attachments) {
					console.log(`    - ${att}`);
				}
			}
		}
	}

	if (config.autoCommit && !dryRun && result.notesUpdated > 0) {
		await commitAllNotes(config);
	}

	return { success: true };
};

/**
 * Handle the 'find-orphans' command.
 */
export const handleFindOrphans: CommandHandler = async (
	ctx: CommandContext,
): Promise<CommandResult> => {
	const { config, flags, isJson } = ctx;

	const dirs = parseDirs(
		normalizeFlagValue(flags.dir),
		config.defaultSearchDirs,
	);
	const suggest = flags.suggest === true || flags.suggest === "true";

	const result = findOrphans(config.vault, { dirs });
	const searchedDirs = dirs ?? config.defaultSearchDirs ?? ["."];

	// Generate suggestions if requested
	const fixes = suggest ? suggestFixes(config.vault, result.brokenLinks) : [];

	if (isJson) {
		console.log(
			JSON.stringify(
				{
					...result,
					dirs: searchedDirs,
					...(suggest && { suggestedFixes: fixes }),
				},
				null,
				2,
			),
		);
	} else {
		// Show which directories were searched
		console.log(emphasize.info(`Searching: ${searchedDirs.join(", ")}`));
		console.log("");

		if (result.brokenLinks.length > 0) {
			console.log(
				emphasize.error(`Found ${result.brokenLinks.length} broken links:`),
			);
			for (const { note, link, location } of result.brokenLinks) {
				console.log(`  ${note} (${location}): [[${link}]]`);
			}
			console.log("");
		}

		if (result.orphanAttachments.length > 0) {
			console.log(
				emphasize.warn(
					`Found ${result.orphanAttachments.length} orphan attachments:`,
				),
			);
			for (const att of result.orphanAttachments) {
				console.log(`  ${att}`);
			}
			console.log("");
		}

		if (
			result.brokenLinks.length === 0 &&
			result.orphanAttachments.length === 0
		) {
			console.log(emphasize.success("No orphans or broken links found!"));
		}

		// Show suggestions if requested
		if (suggest && fixes.length > 0) {
			console.log(emphasize.success(`\n✨ Suggested fixes (${fixes.length}):`));
			for (const fix of fixes) {
				console.log(
					`  ${emphasize.info(fix.from)} → ${emphasize.success(fix.to)}`,
				);
				console.log(`    ${fix.reason}`);
			}
			console.log("\n# Copy/paste to fix:");
			console.log(formatFixCommand(fixes));
		} else if (suggest && fixes.length === 0 && result.brokenLinks.length > 0) {
			console.log(
				emphasize.warn(
					"\nNo auto-fixes available (broken links don't match existing attachments)",
				),
			);
		}
	}

	return { success: true };
};

/**
 * Handle the 'clean-broken-links' command.
 */
export const handleCleanBrokenLinks: CommandHandler = async (
	ctx: CommandContext,
): Promise<CommandResult> => {
	const { config, flags, isJson, subcommand } = ctx;

	const dir = subcommand ?? ".";
	const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";

	if (!dryRun) {
		await ensureGitGuard(config);
	}

	const result = cleanBrokenLinks(config.vault, { dir, dryRun });

	if (isJson) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(
			emphasize.success(
				`${dryRun ? "Would remove" : "Removed"} ${result.linksRemoved} broken links from ${result.notesUpdated} notes`,
			),
		);
		if (result.notesUpdated > 0) {
			console.log("\nUpdated notes:");
			for (const { note, linksRemoved } of result.updates) {
				console.log(`  ${note}: ${linksRemoved} links removed`);
			}
		}
	}

	if (config.autoCommit && !dryRun && result.notesUpdated > 0) {
		await commitAllNotes(config);
	}

	return { success: true };
};

/**
 * Handle the 'rewrite-links' command.
 */
export const handleRewriteLinks: CommandHandler = async (
	ctx: CommandContext,
): Promise<CommandResult> => {
	const { config, flags, isJson } = ctx;

	// Support multiple --from/--to pairs or a single pair
	// Note: We need to access the raw flags which may have arrays
	const rawFlags = ctx.flags as Record<
		string,
		string | boolean | (string | boolean)[]
	>;

	const fromValues = Array.isArray(rawFlags.from)
		? rawFlags.from.filter((v): v is string => typeof v === "string")
		: typeof rawFlags.from === "string"
			? [rawFlags.from]
			: [];
	const toValues = Array.isArray(rawFlags.to)
		? rawFlags.to.filter((v): v is string => typeof v === "string")
		: typeof rawFlags.to === "string"
			? [rawFlags.to]
			: [];
	const mappingFile =
		typeof flags.mapping === "string" ? flags.mapping : undefined;
	const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
	const dirs = parseDirs(
		normalizeFlagValue(rawFlags.dir),
		config.defaultSearchDirs,
	);

	// Build mappings from either --from/--to pairs or --mapping file
	let mappings: RewriteMapping[] = [];

	if (mappingFile) {
		// Load mappings from JSON file
		const mappingPath = path.resolve(mappingFile);
		if (!pathExistsSync(mappingPath)) {
			console.error(`Mapping file not found: ${mappingPath}`);
			return { success: false, exitCode: 1 };
		}
		try {
			const raw = readTextFileSync(mappingPath);
			const parsed = JSON.parse(raw) as Record<string, string>;
			mappings = Object.entries(parsed).map(([fromLink, toLink]) => ({
				from: fromLink,
				to: toLink,
			}));
		} catch (error) {
			console.error(`Failed to parse mapping file: ${getErrorMessage(error)}`);
			return { success: false, exitCode: 1 };
		}
	} else if (fromValues.length > 0 && toValues.length > 0) {
		// Pair up --from and --to values
		if (fromValues.length !== toValues.length) {
			console.error(
				`Mismatched --from/--to pairs: got ${fromValues.length} --from and ${toValues.length} --to`,
			);
			return { success: false, exitCode: 1 };
		}
		for (let i = 0; i < fromValues.length; i++) {
			mappings.push({ from: fromValues[i]!, to: toValues[i]! });
		}
	} else {
		console.error(
			"rewrite-links requires either --from and --to, or --mapping",
		);
		return { success: false, exitCode: 1 };
	}

	if (!dryRun) {
		await ensureGitGuard(config);
	}

	const result = rewriteLinks(config.vault, mappings, { dryRun, dirs });

	if (isJson) {
		console.log(JSON.stringify({ ...result, dirs, dryRun }, null, 2));
	} else {
		console.log(emphasize.info(`Searching: ${(dirs ?? ["."]).join(", ")}`));
		console.log("");

		if (result.linksRewritten === 0) {
			console.log(emphasize.warn("No matching links found to rewrite."));
		} else {
			console.log(
				emphasize.success(
					`${dryRun ? "Would rewrite" : "Rewrote"} ${result.linksRewritten} link(s) in ${result.notesUpdated} note(s)`,
				),
			);

			if (result.updates.length > 0) {
				console.log("\nUpdated notes:");
				for (const { note, rewrites } of result.updates) {
					console.log(`  ${note}:`);
					for (const r of rewrites) {
						console.log(
							`    ${r.location}: [[${r.from}]] → [[${r.to}]] (${r.count}x)`,
						);
					}
				}
			}
		}
	}

	if (config.autoCommit && !dryRun && result.notesUpdated > 0) {
		const changedFiles = result.updates.map((u) => u.note);
		await autoCommitChanges(
			config,
			changedFiles,
			`rewrite ${result.linksRewritten} link(s)`,
		);
	}

	return { success: true };
};
