/**
 * Git-related CLI command handlers.
 *
 * Handlers for git guard and commit commands.
 *
 * @module cli/git
 */

import { color } from "@side-quest/core/terminal";
import {
	assertGitRepo,
	autoCommitChanges,
	commitAllNotes,
	commitNote,
	ensureGitGuard,
	gitStatus,
} from "../git/index";
import { type InsertMode, insertIntoNote } from "../notes/insert";
import type { CommandHandler } from "./types";
import {
	normalizeFlags,
	parseAttachments,
	withAutoDiscoveredAttachments,
} from "./utils";

/**
 * Handle the `insert` command.
 *
 * Inserts content into a note under a specific heading.
 */
export const handleInsert: CommandHandler = async (ctx) => {
	const { config, flags, subcommand, isJson } = ctx;
	const file = subcommand;
	const heading = typeof flags.heading === "string" ? flags.heading : undefined;
	const content = typeof flags.content === "string" ? flags.content : undefined;

	if (!file || !heading || !content) {
		console.error("insert requires <file>, --heading, and --content");
		return { success: false, exitCode: 1 };
	}

	const modes: InsertMode[] = ["append", "prepend", "before", "after"];
	const selected = modes.filter(
		(mode) => flags[mode] === true || flags[mode] === "true",
	);
	if (selected.length !== 1) {
		console.error(
			"insert requires exactly one of --append|--prepend|--before|--after",
		);
		return { success: false, exitCode: 1 };
	}
	const mode = selected[0] as InsertMode;
	const attachments = parseAttachments(normalizeFlags(flags));

	await ensureGitGuard(config);
	const result = insertIntoNote(config, {
		file,
		heading,
		content,
		mode,
	});

	if (config.autoCommit) {
		await autoCommitChanges(
			config,
			[file, ...withAutoDiscoveredAttachments(config, file, attachments)],
			`insert ${file}`,
		);
	}

	if (isJson) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		console.log(
			color(
				"green",
				`Inserted into ${result.relative} (${mode}) under "${heading}"`,
			),
		);
	}

	return { success: true };
};

/**
 * Handle the `git` command.
 *
 * Subcommands:
 * - guard: Check git status
 * - commit: Commit notes
 */
export const handleGit: CommandHandler = async (ctx) => {
	const { config, flags: _flags, subcommand, positional, isJson } = ctx;
	const action = subcommand;

	if (action === "guard") {
		try {
			await assertGitRepo(config.vault);
			const status = await gitStatus(config.vault);
			if (isJson) {
				console.log(
					JSON.stringify({ git: "ok", clean: status.clean }, null, 2),
				);
			} else {
				console.log(color("cyan", `Git OK (clean=${status.clean})`));
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Git guard failed";
			if (isJson) {
				console.log(JSON.stringify({ git: "error", message }, null, 2));
			} else {
				console.error(message);
			}
			return { success: false, exitCode: 1 };
		}
		return { success: true };
	}

	if (action === "commit") {
		const fileArg = positional[0];
		try {
			if (fileArg) {
				// Commit single file
				const result = await commitNote(config, fileArg);
				if (isJson) {
					console.log(JSON.stringify(result, null, 2));
				} else if (result.committed) {
					console.log(color("green", `✓ ${result.message}`));
					console.log(`  Files: ${result.files.join(", ")}`);
				} else {
					console.log(color("yellow", "Nothing to commit"));
				}
			} else {
				// Commit all uncommitted files
				const result = await commitAllNotes(config);
				if (isJson) {
					console.log(JSON.stringify(result, null, 2));
				} else if (result.total === 0) {
					console.log(color("cyan", "No uncommitted notes found"));
				} else {
					console.log(
						color(
							"green",
							`✓ Committed ${result.committed} of ${result.total} notes`,
						),
					);
					for (const r of result.results) {
						if (r.committed) {
							console.log(`  ${color("green", "✓")} ${r.message}`);
						} else {
							console.log(
								`  ${color("yellow", "○")} ${r.message} (no changes)`,
							);
						}
					}
				}
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Git commit failed";
			if (isJson) {
				console.log(
					JSON.stringify({ error: message, committed: false }, null, 2),
				);
			} else {
				console.error(color("red", message));
			}
			return { success: false, exitCode: 1 };
		}
		return { success: true };
	}

	console.error("git supports 'guard' and 'commit'");
	return { success: false, exitCode: 1 };
};
