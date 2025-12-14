/**
 * Notes-related CLI command handlers.
 *
 * Handlers for basic note operations: list, read, delete.
 *
 * @module cli/notes
 */

import { emphasize } from "@sidequest/core/terminal";
import { autoCommitChanges, ensureGitGuard } from "../git/index";
import { deleteFile } from "../notes/delete";
import { listDir, readFile } from "../shared/fs";
import type { CommandHandler } from "./types";
import { normalizeFlags, parseAttachments } from "./utils";

/**
 * Helper to auto-discover attachments for a file.
 * This replicates logic from the main cli.ts
 */
function withAutoDiscoveredAttachments(
	_config: { vault: string },
	_file: string,
	explicitAttachments: string[],
): string[] {
	// If explicit attachments provided, use those
	if (explicitAttachments.length > 0) {
		return explicitAttachments;
	}
	// Otherwise, auto-discover is handled at commit time by git
	return [];
}

/**
 * Handle the `list` command.
 *
 * Lists files in a vault directory.
 */
export const handleList: CommandHandler = async (ctx) => {
	const { config, subcommand, isJson } = ctx;
	const dir = subcommand ?? ".";

	const entries = listDir(config.vault, dir);

	if (isJson) {
		console.log(JSON.stringify({ dir, entries }, null, 2));
	} else {
		console.log(entries.join("\n"));
	}

	return { success: true };
};

/**
 * Handle the `read` command.
 *
 * Reads and displays a file's content.
 */
export const handleRead: CommandHandler = async (ctx) => {
	const { config, subcommand, isJson } = ctx;
	const file = subcommand;

	if (!file) {
		console.error("read requires <file>");
		return { success: false, exitCode: 1 };
	}

	const content = readFile(config.vault, file);

	if (isJson) {
		console.log(JSON.stringify({ file, content }, null, 2));
	} else {
		console.log(content);
	}

	return { success: true };
};

/**
 * Handle the `delete` command.
 *
 * Deletes a file and optionally its attachments.
 */
export const handleDelete: CommandHandler = async (ctx) => {
	const { config, flags, subcommand, isJson } = ctx;
	const file = subcommand;

	if (!file) {
		console.error("delete requires <file>");
		return { success: false, exitCode: 1 };
	}

	const confirm = flags.confirm === true || flags.confirm === "true";
	const dryRun = flags["dry-run"] === true || flags["dry-run"] === "true";
	const attachments = parseAttachments(normalizeFlags(flags));

	if (!dryRun) {
		await ensureGitGuard(config);
	}

	const result = deleteFile(config, { file, confirm, dryRun });

	if (config.autoCommit && !dryRun) {
		await autoCommitChanges(
			config,
			[file, ...withAutoDiscoveredAttachments(config, file, attachments)],
			`delete ${file}`,
		);
	}

	if (isJson) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(
			emphasize.warn(
				`${dryRun ? "Would delete" : "Deleted"} ${result.relative}`,
			),
		);
	}

	return { success: true };
};
