#!/usr/bin/env bun

/**
 * Git Intelligence MCP Server
 *
 * Provides git context and history tools for Claude Code.
 * Enables efficient git queries without burning conversation tokens.
 */

import { type ExecSyncOptionsWithStringEncoding, execSync } from "node:child_process";
import { startServer, tool, z } from "mcpez";

// Types

interface Commit {
	hash: string;
	short: string;
	subject: string;
	author: string;
	relative_time: string;
	refs?: string;
}

interface CommitResult {
	count: number;
	commits: Commit[];
	message?: string;
	file?: string;
}

interface ErrorResult {
	error: string;
}

interface FileChange {
	status: string;
	file: string;
}

interface StatusResult {
	branch: string;
	staged_count: number;
	modified_count: number;
	untracked_count: number;
	ahead: number;
	behind: number;
	files: {
		staged: FileChange[];
		modified: FileChange[];
		untracked: string[];
	};
}

interface DiffFile {
	file: string;
	added: number;
	deleted: number;
}

interface DiffResult {
	ref: string;
	files_changed: number;
	total_added: number;
	total_deleted: number;
	files: DiffFile[];
}

interface SearchOptions {
	limit?: number;
	searchCode?: boolean;
	cwd?: string;
}

type GitResult<T> = T | ErrorResult;

function isError<T extends object>(result: GitResult<T>): result is ErrorResult {
	return typeof result === "object" && result !== null && "error" in result;
}

/**
 * Execute a git command and return output
 */
function git(args: string, cwd: string = process.cwd()): string {
	try {
		const options: ExecSyncOptionsWithStringEncoding = {
			encoding: "utf8",
			cwd,
			maxBuffer: 10 * 1024 * 1024,
		};
		return execSync(`git ${args}`, options).trim();
	} catch (error: unknown) {
		const execError = error as { stderr?: string; message: string };
		if (execError.stderr) {
			throw new Error(execError.stderr.trim());
		}
		throw error;
	}
}

/**
 * Check if we're in a git repository
 */
function isGitRepo(cwd: string = process.cwd()): boolean {
	try {
		git("rev-parse --git-dir", cwd);
		return true;
	} catch {
		return false;
	}
}

/**
 * Parse commit line from git log output
 */
function parseCommitLine(line: string, includeRefs = false): Commit {
	const parts = line.split("\x00");
	return {
		hash: parts[0] ?? "",
		short: parts[1] ?? "",
		subject: parts[2] ?? "",
		author: parts[3] ?? "",
		relative_time: parts[4] ?? "",
		...(includeRefs ? { refs: (parts[5] ?? "").trim() } : {}),
	};
}

/**
 * Get recent commits with details
 */
function getRecentCommits(limit = 10, cwd: string = process.cwd()): GitResult<CommitResult> {
	if (!isGitRepo(cwd)) {
		return { error: "Not a git repository" };
	}

	const format = "%H%x00%h%x00%s%x00%an%x00%ar%x00%d";
	const output = git(`log --oneline -${limit} --format="${format}"`, cwd);

	if (!output) {
		return { count: 0, commits: [] };
	}

	const commits = output.split("\n").map((line) => parseCommitLine(line, true));

	return { count: commits.length, commits };
}

/**
 * Search commits by message or content
 */
function searchCommits(query: string, options: SearchOptions = {}): GitResult<CommitResult> {
	const { limit = 20, searchCode = false, cwd = process.cwd() } = options;

	if (!isGitRepo(cwd)) {
		return { error: "Not a git repository" };
	}

	const format = "%H%x00%h%x00%s%x00%an%x00%ar";
	let cmd: string;

	if (searchCode) {
		cmd = `log -${limit} -S "${query}" --format="${format}"`;
	} else {
		cmd = `log -${limit} --grep="${query}" --format="${format}"`;
	}

	try {
		const output = git(cmd, cwd);

		if (!output) {
			return {
				count: 0,
				commits: [],
				message: `No commits found matching: ${query}`,
			};
		}

		const commits = output.split("\n").map((line) => parseCommitLine(line));

		return { count: commits.length, commits };
	} catch (error: unknown) {
		const err = error as Error;
		return { error: err.message };
	}
}

/**
 * Get current git status
 */
function getStatus(cwd: string = process.cwd()): GitResult<StatusResult> {
	if (!isGitRepo(cwd)) {
		return { error: "Not a git repository" };
	}

	try {
		const branch = git("branch --show-current", cwd) || "(detached)";
		const statusOutput = git("status --porcelain", cwd);

		const files: StatusResult["files"] = {
			staged: [],
			modified: [],
			untracked: [],
		};

		if (statusOutput) {
			statusOutput.split("\n").forEach((line) => {
				const index = line[0] ?? " ";
				const worktree = line[1] ?? " ";
				const file = line.slice(3);

				if (index !== " " && index !== "?") {
					files.staged.push({ status: index, file });
				}
				if (worktree === "M" || worktree === "D") {
					files.modified.push({ status: worktree, file });
				}
				if (index === "?") {
					files.untracked.push(file);
				}
			});
		}

		let ahead = 0;
		let behind = 0;
		try {
			const tracking = git("rev-list --left-right --count @{u}...HEAD", cwd);
			const parts = tracking.split("\t");
			behind = Number.parseInt(parts[0] ?? "0", 10) || 0;
			ahead = Number.parseInt(parts[1] ?? "0", 10) || 0;
		} catch {
			// No upstream tracking
		}

		return {
			branch,
			staged_count: files.staged.length,
			modified_count: files.modified.length,
			untracked_count: files.untracked.length,
			ahead,
			behind,
			files,
		};
	} catch (error: unknown) {
		const err = error as Error;
		return { error: err.message };
	}
}

/**
 * Get diff summary
 */
function getDiffSummary(ref = "HEAD", cwd: string = process.cwd()): GitResult<DiffResult> {
	if (!isGitRepo(cwd)) {
		return { error: "Not a git repository" };
	}

	try {
		const numstat = git(`diff --numstat ${ref}`, cwd);

		const files: DiffFile[] = [];
		if (numstat) {
			numstat.split("\n").forEach((line) => {
				const parts = line.split("\t");
				const added = parts[0] ?? "0";
				const deleted = parts[1] ?? "0";
				const file = parts[2] ?? "";
				files.push({
					file,
					added: Number.parseInt(added, 10) || 0,
					deleted: Number.parseInt(deleted, 10) || 0,
				});
			});
		}

		const totalAdded = files.reduce((sum, f) => sum + f.added, 0);
		const totalDeleted = files.reduce((sum, f) => sum + f.deleted, 0);

		return {
			ref,
			files_changed: files.length,
			total_added: totalAdded,
			total_deleted: totalDeleted,
			files,
		};
	} catch (error: unknown) {
		const err = error as Error;
		return { error: err.message };
	}
}

/**
 * Format commits for display
 */
function formatCommits(results: GitResult<CommitResult>): string {
	if (isError(results)) {
		return `Error: ${results.error}`;
	}

	if (results.count === 0) {
		return results.message || "No commits found.";
	}

	let output = `Found ${results.count} commit${results.count === 1 ? "" : "s"}:\n\n`;

	results.commits.forEach((commit, idx) => {
		output += `${idx + 1}. ${commit.short} - ${commit.subject}\n`;
		output += `   Author: ${commit.author} | ${commit.relative_time}`;
		if (commit.refs) {
			output += ` | ${commit.refs}`;
		}
		output += "\n\n";
	});

	return output.trim();
}

/**
 * Format status for display
 */
function formatStatus(status: GitResult<StatusResult>): string {
	if (isError(status)) {
		return `Error: ${status.error}`;
	}

	let output = `Branch: ${status.branch}`;

	if (status.ahead || status.behind) {
		output += " (";
		if (status.ahead) output += `${status.ahead} ahead`;
		if (status.ahead && status.behind) output += ", ";
		if (status.behind) output += `${status.behind} behind`;
		output += ")";
	}

	output += "\n\n";

	if (status.staged_count === 0 && status.modified_count === 0 && status.untracked_count === 0) {
		output += "Working tree clean.";
		return output;
	}

	if (status.staged_count > 0) {
		output += `Staged (${status.staged_count}):\n`;
		status.files.staged.forEach((f) => {
			output += `  ${f.status} ${f.file}\n`;
		});
		output += "\n";
	}

	if (status.modified_count > 0) {
		output += `Modified (${status.modified_count}):\n`;
		status.files.modified.forEach((f) => {
			output += `  ${f.status} ${f.file}\n`;
		});
		output += "\n";
	}

	if (status.untracked_count > 0) {
		output += `Untracked (${status.untracked_count}):\n`;
		status.files.untracked.forEach((f) => {
			output += `  ? ${f}\n`;
		});
	}

	return output.trim();
}

// Register tools

tool(
	"get_recent_commits",
	{
		description:
			"Get recent git commits with hash, message, author, and relative time. Use this to understand recent changes before making related edits.",
		inputSchema: {
			limit: z.number().optional().describe("Number of commits to retrieve (default: 10)"),
			path: z.string().optional().describe("Repository path (default: current directory)"),
		},
	},
	async (args: { limit?: number; path?: string }) => {
		const { limit, path } = args;
		const results = getRecentCommits(limit ?? 10, path);
		return {
			content: [{ type: "text" as const, text: formatCommits(results) }],
		};
	}
);

tool(
	"search_commits",
	{
		description:
			"Search git commit history by message or code changes. Use --grep style search for commit messages, or -S style search for code changes.",
		inputSchema: {
			query: z.string().describe("Search query for commit messages or code"),
			search_code: z
				.boolean()
				.optional()
				.describe("Search for code changes (-S) instead of commit messages (default: false)"),
			limit: z.number().optional().describe("Maximum results to return (default: 20)"),
			path: z.string().optional().describe("Repository path (default: current directory)"),
		},
	},
	async (args: Record<string, unknown>) => {
		const { query, search_code, limit, path } = args as {
			query: string;
			search_code?: boolean;
			limit?: number;
			path?: string;
		};
		const results = searchCommits(query, {
			limit: limit ?? 20,
			searchCode: search_code ?? false,
			cwd: path,
		});
		return {
			content: [{ type: "text" as const, text: formatCommits(results) }],
		};
	}
);

tool(
	"get_status",
	{
		description:
			"Get current git status including branch, staged/modified/untracked files, and ahead/behind tracking info.",
		inputSchema: {
			path: z.string().optional().describe("Repository path (default: current directory)"),
		},
	},
	async (args: { path?: string }) => {
		const { path } = args;
		const status = getStatus(path);
		return { content: [{ type: "text" as const, text: formatStatus(status) }] };
	}
);

tool(
	"get_diff_summary",
	{
		description:
			"Get a summary of changes (files changed, lines added/deleted) compared to a reference.",
		inputSchema: {
			ref: z.string().optional().describe("Git reference to compare against (default: HEAD)"),
			path: z.string().optional().describe("Repository path (default: current directory)"),
		},
	},
	async (args: { ref?: string; path?: string }) => {
		const { ref, path } = args;
		const diff = getDiffSummary(ref ?? "HEAD", path);

		if (isError(diff)) {
			return {
				content: [{ type: "text" as const, text: `Error: ${diff.error}` }],
			};
		}

		if (diff.files_changed === 0) {
			return {
				content: [{ type: "text" as const, text: `No changes compared to ${diff.ref}` }],
			};
		}

		let output = `Changes vs ${diff.ref}:\n`;
		output += `${diff.files_changed} file${diff.files_changed === 1 ? "" : "s"} changed, `;
		output += `+${diff.total_added} -${diff.total_deleted}\n\n`;

		diff.files.forEach((f) => {
			output += `  +${f.added} -${f.deleted}\t${f.file}\n`;
		});

		return { content: [{ type: "text" as const, text: output.trim() }] };
	}
);

// Start the MCP server
startServer("git-intelligence", { version: "1.0.0" });
