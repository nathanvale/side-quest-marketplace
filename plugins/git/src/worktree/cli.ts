#!/usr/bin/env bun
/**
 * Git worktree CLI.
 *
 * Provides create, list, delete, and init subcommands for managing
 * git worktrees with automatic file copying and dependency installation.
 *
 * All output is JSON to stdout for consumption by the SKILL.md prompt.
 *
 * @module worktree/cli
 */

import { parseArgs } from "@side-quest/core/cli";
import { getGitRoot } from "@side-quest/core/git";
import { getErrorMessage } from "@side-quest/core/utils";
import { loadOrDetectConfig, writeConfig } from "./config.js";
import { createWorktree } from "./create.js";
import { checkBeforeDelete, deleteWorktree } from "./delete.js";
import { listWorktrees } from "./list.js";

/** Output result as JSON to stdout. */
function output(data: unknown): void {
	console.log(JSON.stringify(data, null, 2));
}

/** Output error as JSON to stderr and exit. */
function fail(message: string): never {
	console.error(JSON.stringify({ error: message }));
	process.exit(1);
}

async function main(): Promise<void> {
	const { command, subcommand, positional, flags } = parseArgs(
		process.argv.slice(2),
	);

	// parseArgs treats the second positional as `subcommand`, but for our CLI
	// it's actually the first argument (e.g., branch name). Combine them.
	const args = subcommand ? [subcommand, ...positional] : positional;

	const gitRoot = await getGitRoot();
	if (!gitRoot) {
		fail("Not in a git repository");
	}

	switch (command) {
		case "create": {
			const branchName = args[0];
			if (!branchName) {
				fail("Usage: worktree create <branch-name> [--no-install]");
			}
			const noInstall = flags["no-install"] === true;
			const noFetch = flags["no-fetch"] === true;
			const result = await createWorktree(gitRoot, branchName, {
				noInstall,
				noFetch,
			});
			output(result);
			break;
		}

		case "list": {
			const worktrees = await listWorktrees(gitRoot);
			// Filter out the main worktree by default unless --all is passed
			const showAll = flags.all === true;
			const filtered = showAll ? worktrees : worktrees.filter((w) => !w.isMain);
			output(filtered);
			break;
		}

		case "delete": {
			const branchName = args[0];
			if (!branchName) {
				fail(
					"Usage: worktree delete <branch-name> [--force] [--delete-branch]",
				);
			}
			const force = flags.force === true;
			const deleteBranch = flags["delete-branch"] === true;
			const result = await deleteWorktree(gitRoot, branchName, {
				force,
				deleteBranch,
			});
			output(result);
			break;
		}

		case "check": {
			const branchName = args[0];
			if (!branchName) {
				fail("Usage: worktree check <branch-name>");
			}
			const check = await checkBeforeDelete(gitRoot, branchName);
			output(check);
			break;
		}

		case "init": {
			const { config, autoDetected } = loadOrDetectConfig(gitRoot);
			if (!autoDetected) {
				output({
					message: ".worktrees.json already exists",
					config,
				});
			} else {
				writeConfig(gitRoot, config);
				output({
					message: "Created .worktrees.json with auto-detected settings",
					config,
				});
			}
			break;
		}

		default:
			fail(
				`Unknown command: ${command || "(none)"}. Available: create, list, delete, check, init`,
			);
	}
}

main().catch((err) => {
	fail(getErrorMessage(err));
});
