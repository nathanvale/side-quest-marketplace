#!/usr/bin/env bun

/**
 * Git Intelligence MCP Server
 *
 * Provides git context and history tools for Claude Code.
 * Enables efficient git queries without burning conversation tokens.
 */

import {
	createCorrelationId,
	createPluginLogger,
} from "@sidequest/core/logging";
import { startServer, tool, z } from "@sidequest/core/mcp";
import {
	ensureCommandAvailable,
	spawnSyncCollect,
} from "@sidequest/core/spawn";

// Initialize logger
const { initLogger, getSubsystemLogger } = createPluginLogger({
	name: "git",
	subsystems: ["mcp"],
});

// Initialize logger on server startup
initLogger().catch(console.error);

const mcpLogger = getSubsystemLogger("mcp");

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

interface StatusFile {
	path: string;
	status: string;
}

interface StatusResult {
	branch: string;
	upstream?: string;
	ahead: number;
	behind: number;
	staged: StatusFile[];
	modified: StatusFile[];
	untracked: string[];
}

interface BranchInfo {
	name: string;
	current: boolean;
	tracking?: string;
}

interface BranchResult {
	current: string;
	tracking?: string;
	ahead: number;
	behind: number;
	local: BranchInfo[];
	remote: string[];
}

interface StashEntry {
	ref: string;
	message: string;
	date: string;
}

interface StashResult {
	count: number;
	stashes: StashEntry[];
}

interface SearchOptions {
	limit?: number;
	searchCode?: boolean;
	cwd?: string;
}

type GitResult<T> = T | ErrorResult;

/**
 * Response format options for tool output
 */
enum ResponseFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

function isError<T extends object>(
	result: GitResult<T>,
): result is ErrorResult {
	return typeof result === "object" && result !== null && "error" in result;
}

/**
 * Execute a git command safely using argument arrays (prevents command injection)
 * @param args - Array of arguments to pass to git
 * @param cwd - Working directory for the command
 */
function git(args: string[], cwd: string = process.cwd()): string {
	const gitCmd = ensureCommandAvailable("git");
	const result = spawnSyncCollect([gitCmd, ...args], {
		cwd,
	});

	if (result.exitCode !== 0) {
		const errorMessage =
			result.stderr?.trim() || `git exited with code ${result.exitCode}`;
		throw new Error(errorMessage);
	}

	return result.stdout.trim();
}

/**
 * Check if we're in a git repository
 */
function isGitRepo(cwd: string = process.cwd()): boolean {
	try {
		git(["rev-parse", "--git-dir"], cwd);
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
function getRecentCommits(
	limit = 10,
	cwd: string = process.cwd(),
): GitResult<CommitResult> {
	if (!isGitRepo(cwd)) {
		return { error: "Not a git repository" };
	}

	try {
		const format = "%H%x00%h%x00%s%x00%an%x00%ar%x00%d";
		const output = git(
			["log", "--oneline", `-${limit}`, `--format=${format}`],
			cwd,
		);

		if (!output) {
			return { count: 0, commits: [] };
		}

		const commits = output
			.split("\n")
			.map((line) => parseCommitLine(line, true));

		return { count: commits.length, commits };
	} catch (error: unknown) {
		const err = error as Error;
		return { error: err.message };
	}
}

/**
 * Search commits by message or content
 */
function searchCommits(
	query: string,
	options: SearchOptions = {},
): GitResult<CommitResult> {
	const { limit = 20, searchCode = false, cwd = process.cwd() } = options;

	if (!isGitRepo(cwd)) {
		return { error: "Not a git repository" };
	}

	const format = "%H%x00%h%x00%s%x00%an%x00%ar";
	const args: string[] = ["log", `-${limit}`];

	if (searchCode) {
		args.push("-S", query);
	} else {
		args.push(`--grep=${query}`);
	}
	args.push(`--format=${format}`);

	try {
		const output = git(args, cwd);

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
 * Get file-specific commit history
 */
function getFileHistory(
	file: string,
	limit = 10,
	cwd: string = process.cwd(),
): GitResult<CommitResult> {
	if (!isGitRepo(cwd)) {
		return { error: "Not a git repository" };
	}

	try {
		const format = "%H%x00%h%x00%s%x00%an%x00%ar";
		const output = git(
			["log", "--follow", `-${limit}`, `--format=${format}`, "--", file],
			cwd,
		);

		if (!output) {
			return {
				count: 0,
				commits: [],
				message: `No commits found for file: ${file}`,
				file,
			};
		}

		const commits = output.split("\n").map((line) => parseCommitLine(line));

		return { count: commits.length, commits, file };
	} catch (error: unknown) {
		const err = error as Error;
		return { error: err.message };
	}
}

/**
 * Get diff summary
 */
function getDiffSummary(
	ref = "HEAD",
	cwd: string = process.cwd(),
): GitResult<DiffResult> {
	if (!isGitRepo(cwd)) {
		return { error: "Not a git repository" };
	}

	try {
		const numstat = git(["diff", "--numstat", ref], cwd);

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
 * Get repository status
 */
function getStatus(cwd: string = process.cwd()): GitResult<StatusResult> {
	if (!isGitRepo(cwd)) {
		return { error: "Not a git repository" };
	}

	try {
		const output = git(["status", "--porcelain=v2", "--branch"], cwd);
		const lines = output.split("\n");

		let branch = "";
		let upstream: string | undefined;
		let ahead = 0;
		let behind = 0;
		const staged: StatusFile[] = [];
		const modified: StatusFile[] = [];
		const untracked: string[] = [];

		for (const line of lines) {
			if (line.startsWith("# branch.head ")) {
				branch = line.slice(14);
			} else if (line.startsWith("# branch.upstream ")) {
				upstream = line.slice(18);
			} else if (line.startsWith("# branch.ab ")) {
				const match = line.match(/\+(\d+) -(\d+)/);
				if (match) {
					ahead = Number.parseInt(match[1] ?? "0", 10);
					behind = Number.parseInt(match[2] ?? "0", 10);
				}
			} else if (line.startsWith("1 ") || line.startsWith("2 ")) {
				// Changed entries: 1 = ordinary, 2 = renamed
				const parts = line.split(" ");
				const xy = parts[1] ?? "";
				const path = line.split("\t")[0]?.split(" ").pop() ?? "";

				if (xy[0] !== ".") {
					staged.push({ path, status: xy[0] ?? "" });
				}
				if (xy[1] !== ".") {
					modified.push({ path, status: xy[1] ?? "" });
				}
			} else if (line.startsWith("? ")) {
				// Untracked
				untracked.push(line.slice(2));
			}
		}

		return { branch, upstream, ahead, behind, staged, modified, untracked };
	} catch (error: unknown) {
		const err = error as Error;
		return { error: err.message };
	}
}

/**
 * Get branch information
 */
function getBranchInfo(cwd: string = process.cwd()): GitResult<BranchResult> {
	if (!isGitRepo(cwd)) {
		return { error: "Not a git repository" };
	}

	try {
		const current = git(["branch", "--show-current"], cwd);
		const localOutput = git(
			["branch", "--format=%(refname:short)|%(upstream:short)"],
			cwd,
		);
		const remoteOutput = git(
			["branch", "-r", "--format=%(refname:short)"],
			cwd,
		);

		let tracking: string | undefined;
		let ahead = 0;
		let behind = 0;

		// Get upstream tracking info
		try {
			tracking = git(["rev-parse", "--abbrev-ref", "@{u}"], cwd);
			const aheadStr = git(["rev-list", "--count", "@{u}..HEAD"], cwd);
			const behindStr = git(["rev-list", "--count", "HEAD..@{u}"], cwd);
			ahead = Number.parseInt(aheadStr, 10) || 0;
			behind = Number.parseInt(behindStr, 10) || 0;
		} catch {
			// No upstream set
		}

		const local: BranchInfo[] = localOutput
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const [name, upstreamRef] = line.split("|");
				return {
					name: name ?? "",
					current: name === current,
					...(upstreamRef ? { tracking: upstreamRef } : {}),
				};
			});

		const remote = remoteOutput.split("\n").filter(Boolean);

		return { current, tracking, ahead, behind, local, remote };
	} catch (error: unknown) {
		const err = error as Error;
		return { error: err.message };
	}
}

/**
 * Get stash list
 */
function getStashList(cwd: string = process.cwd()): GitResult<StashResult> {
	if (!isGitRepo(cwd)) {
		return { error: "Not a git repository" };
	}

	try {
		const output = git(["stash", "list", "--format=%gd|%gs|%ci"], cwd);

		if (!output) {
			return { count: 0, stashes: [] };
		}

		const stashes: StashEntry[] = output
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const [ref, message, date] = line.split("|");
				return {
					ref: ref ?? "",
					message: message ?? "",
					date: date ?? "",
				};
			});

		return { count: stashes.length, stashes };
	} catch (error: unknown) {
		const err = error as Error;
		return { error: err.message };
	}
}

/**
 * Format commits for display
 */
function formatCommits(
	results: GitResult<CommitResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(results)) {
		return format === ResponseFormat.JSON
			? JSON.stringify({ error: results.error }, null, 2)
			: `Error: ${results.error}`;
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(results, null, 2);
	}

	if (results.count === 0) {
		return results.message || "No commits found.";
	}

	let output = `Found ${results.count} commit${results.count === 1 ? "" : "s"}`;
	if (results.file) {
		output += ` for ${results.file}`;
	}
	output += ":\n\n";

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
function formatStatus(
	results: GitResult<StatusResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(results)) {
		return format === ResponseFormat.JSON
			? JSON.stringify({ error: results.error }, null, 2)
			: `Error: ${results.error}`;
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(results, null, 2);
	}

	let output = `Branch: ${results.branch}`;
	if (results.upstream) {
		output += ` → ${results.upstream}`;
		if (results.ahead > 0 || results.behind > 0) {
			output += ` [+${results.ahead}/-${results.behind}]`;
		}
	}
	output += "\n\n";

	if (results.staged.length > 0) {
		output += `Staged (${results.staged.length}):\n`;
		results.staged.forEach((f) => {
			output += `  [${f.status}] ${f.path}\n`;
		});
		output += "\n";
	}

	if (results.modified.length > 0) {
		output += `Modified (${results.modified.length}):\n`;
		results.modified.forEach((f) => {
			output += `  [${f.status}] ${f.path}\n`;
		});
		output += "\n";
	}

	if (results.untracked.length > 0) {
		output += `Untracked (${results.untracked.length}):\n`;
		results.untracked.forEach((f) => {
			output += `  ${f}\n`;
		});
		output += "\n";
	}

	if (
		results.staged.length === 0 &&
		results.modified.length === 0 &&
		results.untracked.length === 0
	) {
		output += "Working tree clean\n";
	}

	return output.trim();
}

/**
 * Format branch info for display
 */
function formatBranchInfo(
	results: GitResult<BranchResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(results)) {
		return format === ResponseFormat.JSON
			? JSON.stringify({ error: results.error }, null, 2)
			: `Error: ${results.error}`;
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(results, null, 2);
	}

	let output = `Current: ${results.current}`;
	if (results.tracking) {
		output += ` → ${results.tracking}`;
		if (results.ahead > 0 || results.behind > 0) {
			output += ` [+${results.ahead}/-${results.behind}]`;
		}
	}
	output += "\n\n";

	if (results.local.length > 0) {
		output += `Local branches (${results.local.length}):\n`;
		results.local.forEach((b) => {
			const marker = b.current ? "* " : "  ";
			output += `${marker}${b.name}`;
			if (b.tracking) {
				output += ` → ${b.tracking}`;
			}
			output += "\n";
		});
		output += "\n";
	}

	if (results.remote.length > 0) {
		output += `Remote branches (${results.remote.length}):\n`;
		results.remote.forEach((b) => {
			output += `  ${b}\n`;
		});
	}

	return output.trim();
}

/**
 * Format diff summary for display
 */
function formatDiffSummary(
	results: GitResult<DiffResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(results)) {
		return format === ResponseFormat.JSON
			? JSON.stringify({ error: results.error }, null, 2)
			: `Error: ${results.error}`;
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(results, null, 2);
	}

	if (results.files_changed === 0) {
		return `No changes compared to ${results.ref}`;
	}

	let output = `Changes vs ${results.ref}:\n`;
	output += `${results.files_changed} file${results.files_changed === 1 ? "" : "s"} changed, `;
	output += `+${results.total_added} -${results.total_deleted}\n\n`;

	results.files.forEach((f) => {
		output += `  +${f.added} -${f.deleted}\t${f.file}\n`;
	});

	return output.trim();
}

/**
 * Format stash list for display
 */
function formatStashList(
	results: GitResult<StashResult>,
	format: ResponseFormat = ResponseFormat.MARKDOWN,
): string {
	if (isError(results)) {
		return format === ResponseFormat.JSON
			? JSON.stringify({ error: results.error }, null, 2)
			: `Error: ${results.error}`;
	}

	if (format === ResponseFormat.JSON) {
		return JSON.stringify(results, null, 2);
	}

	if (results.count === 0) {
		return "No stashes found.";
	}

	let output = `Found ${results.count} stash${results.count === 1 ? "" : "es"}:\n\n`;

	results.stashes.forEach((stash, idx) => {
		output += `${idx + 1}. ${stash.ref}: ${stash.message}\n`;
		output += `   ${stash.date}\n\n`;
	});

	return output.trim();
}

// Register tools

tool(
	"mcp__git_git-intelligence__git_get_recent_commits",
	{
		description:
			"Get recent git commits with hash, message, author, and relative time. Use this to understand recent changes before making related edits.",
		inputSchema: {
			limit: z
				.number()
				.optional()
				.describe("Number of commits to retrieve (default: 10)"),
			path: z
				.string()
				.optional()
				.describe("Repository path (default: current directory)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { limit?: number; path?: string; response_format?: string }) => {
		const cid = createCorrelationId();
		const startTime = Date.now();
		const { limit, path, response_format } = args;

		mcpLogger.info("Tool request", {
			cid,
			tool: "git_get_recent_commits",
			limit: limit ?? 10,
			path,
		});

		const format =
			response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		try {
			const results = getRecentCommits(limit ?? 10, path);

			if (isError(results)) {
				mcpLogger.error("Tool failed", {
					cid,
					tool: "git_get_recent_commits",
					error: results.error,
					durationMs: Date.now() - startTime,
				});
				return {
					isError: true,
					content: [
						{ type: "text" as const, text: formatCommits(results, format) },
					],
				};
			}

			mcpLogger.info("Tool response", {
				cid,
				tool: "git_get_recent_commits",
				success: true,
				count: results.count,
				durationMs: Date.now() - startTime,
			});

			return {
				content: [
					{ type: "text" as const, text: formatCommits(results, format) },
				],
			};
		} catch (error) {
			mcpLogger.error("Tool failed", {
				cid,
				tool: "git_get_recent_commits",
				error: error instanceof Error ? error.message : "Unknown error",
				durationMs: Date.now() - startTime,
			});
			throw error;
		}
	},
);

tool(
	"mcp__git_git-intelligence__git_search_commits",
	{
		description:
			"Search git commit history by message or code changes. Use --grep style search for commit messages, or -S style search for code changes.",
		inputSchema: {
			query: z.string().describe("Search query for commit messages or code"),
			search_code: z
				.boolean()
				.optional()
				.describe(
					"Search for code changes (-S) instead of commit messages (default: false)",
				),
			limit: z
				.number()
				.optional()
				.describe("Maximum results to return (default: 20)"),
			path: z
				.string()
				.optional()
				.describe("Repository path (default: current directory)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const cid = createCorrelationId();
		const startTime = Date.now();
		const { query, search_code, limit, path, response_format } = args as {
			query: string;
			search_code?: boolean;
			limit?: number;
			path?: string;
			response_format?: string;
		};

		mcpLogger.info("Tool request", {
			cid,
			tool: "git_search_commits",
			query,
			search_code,
			limit: limit ?? 20,
		});

		const format =
			response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		try {
			const results = searchCommits(query, {
				limit: limit ?? 20,
				searchCode: search_code ?? false,
				cwd: path,
			});

			if (isError(results)) {
				mcpLogger.error("Tool failed", {
					cid,
					tool: "git_search_commits",
					error: results.error,
					durationMs: Date.now() - startTime,
				});
			} else {
				mcpLogger.info("Tool response", {
					cid,
					tool: "git_search_commits",
					success: true,
					count: results.count,
					durationMs: Date.now() - startTime,
				});
			}

			return {
				...(isError(results) ? { isError: true } : {}),
				content: [
					{ type: "text" as const, text: formatCommits(results, format) },
				],
			};
		} catch (error) {
			mcpLogger.error("Tool failed", {
				cid,
				tool: "git_search_commits",
				error: error instanceof Error ? error.message : "Unknown error",
				durationMs: Date.now() - startTime,
			});
			throw error;
		}
	},
);

tool(
	"mcp__git_git-intelligence__git_get_file_history",
	{
		description:
			"Get commit history for a specific file, following renames. Use this to understand how a file evolved over time.",
		inputSchema: {
			file: z.string().describe("Path to the file to get history for"),
			limit: z
				.number()
				.optional()
				.describe("Number of commits to retrieve (default: 10)"),
			path: z
				.string()
				.optional()
				.describe("Repository path (default: current directory)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: Record<string, unknown>) => {
		const cid = createCorrelationId();
		const startTime = Date.now();
		const { file, limit, path, response_format } = args as {
			file: string;
			limit?: number;
			path?: string;
			response_format?: string;
		};

		mcpLogger.info("Tool request", {
			cid,
			tool: "git_get_file_history",
			file,
			limit: limit ?? 10,
		});

		const format =
			response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		try {
			const results = getFileHistory(file, limit ?? 10, path);

			if (isError(results)) {
				mcpLogger.error("Tool failed", {
					cid,
					tool: "git_get_file_history",
					error: results.error,
					durationMs: Date.now() - startTime,
				});
			} else {
				mcpLogger.info("Tool response", {
					cid,
					tool: "git_get_file_history",
					success: true,
					count: results.count,
					durationMs: Date.now() - startTime,
				});
			}

			return {
				...(isError(results) ? { isError: true } : {}),
				content: [
					{ type: "text" as const, text: formatCommits(results, format) },
				],
			};
		} catch (error) {
			mcpLogger.error("Tool failed", {
				cid,
				tool: "git_get_file_history",
				error: error instanceof Error ? error.message : "Unknown error",
				durationMs: Date.now() - startTime,
			});
			throw error;
		}
	},
);

tool(
	"mcp__git_git-intelligence__git_get_status",
	{
		description:
			"Get current repository status including branch, staged changes, modified files, and untracked files.",
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe("Repository path (default: current directory)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { path?: string; response_format?: string }) => {
		const cid = createCorrelationId();
		const startTime = Date.now();
		const { path, response_format } = args;

		mcpLogger.info("Tool request", { cid, tool: "git_get_status", path });

		const format =
			response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		try {
			const results = getStatus(path);

			if (isError(results)) {
				mcpLogger.error("Tool failed", {
					cid,
					tool: "git_get_status",
					error: results.error,
					durationMs: Date.now() - startTime,
				});
			} else {
				mcpLogger.info("Tool response", {
					cid,
					tool: "git_get_status",
					success: true,
					staged: results.staged.length,
					modified: results.modified.length,
					untracked: results.untracked.length,
					durationMs: Date.now() - startTime,
				});
			}

			return {
				...(isError(results) ? { isError: true } : {}),
				content: [
					{ type: "text" as const, text: formatStatus(results, format) },
				],
			};
		} catch (error) {
			mcpLogger.error("Tool failed", {
				cid,
				tool: "git_get_status",
				error: error instanceof Error ? error.message : "Unknown error",
				durationMs: Date.now() - startTime,
			});
			throw error;
		}
	},
);

tool(
	"mcp__git_git-intelligence__git_get_branch_info",
	{
		description:
			"Get branch information including current branch, tracking status, and list of local/remote branches.",
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe("Repository path (default: current directory)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { path?: string; response_format?: string }) => {
		const cid = createCorrelationId();
		const startTime = Date.now();
		const { path, response_format } = args;

		mcpLogger.info("Tool request", { cid, tool: "git_get_branch_info", path });

		const format =
			response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		try {
			const results = getBranchInfo(path);

			if (isError(results)) {
				mcpLogger.error("Tool failed", {
					cid,
					tool: "git_get_branch_info",
					error: results.error,
					durationMs: Date.now() - startTime,
				});
			} else {
				mcpLogger.info("Tool response", {
					cid,
					tool: "git_get_branch_info",
					success: true,
					current: results.current,
					localCount: results.local.length,
					remoteCount: results.remote.length,
					durationMs: Date.now() - startTime,
				});
			}

			return {
				...(isError(results) ? { isError: true } : {}),
				content: [
					{ type: "text" as const, text: formatBranchInfo(results, format) },
				],
			};
		} catch (error) {
			mcpLogger.error("Tool failed", {
				cid,
				tool: "git_get_branch_info",
				error: error instanceof Error ? error.message : "Unknown error",
				durationMs: Date.now() - startTime,
			});
			throw error;
		}
	},
);

tool(
	"mcp__git_git-intelligence__git_get_diff_summary",
	{
		description:
			"Get a summary of changes (files changed, lines added/deleted) compared to a reference.",
		inputSchema: {
			ref: z
				.string()
				.optional()
				.describe("Git reference to compare against (default: HEAD)"),
			path: z
				.string()
				.optional()
				.describe("Repository path (default: current directory)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { ref?: string; path?: string; response_format?: string }) => {
		const cid = createCorrelationId();
		const startTime = Date.now();
		const { ref, path, response_format } = args;

		mcpLogger.info("Tool request", {
			cid,
			tool: "git_get_diff_summary",
			ref: ref ?? "HEAD",
		});

		const format =
			response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		try {
			const results = getDiffSummary(ref ?? "HEAD", path);

			if (isError(results)) {
				mcpLogger.error("Tool failed", {
					cid,
					tool: "git_get_diff_summary",
					error: results.error,
					durationMs: Date.now() - startTime,
				});
			} else {
				mcpLogger.info("Tool response", {
					cid,
					tool: "git_get_diff_summary",
					success: true,
					filesChanged: results.files_changed,
					durationMs: Date.now() - startTime,
				});
			}

			return {
				...(isError(results) ? { isError: true } : {}),
				content: [
					{ type: "text" as const, text: formatDiffSummary(results, format) },
				],
			};
		} catch (error) {
			mcpLogger.error("Tool failed", {
				cid,
				tool: "git_get_diff_summary",
				error: error instanceof Error ? error.message : "Unknown error",
				durationMs: Date.now() - startTime,
			});
			throw error;
		}
	},
);

tool(
	"mcp__git_git-intelligence__git_get_stash_list",
	{
		description:
			"Get list of stashed changes. Use this to see saved work before operations or to recover stashed changes.",
		inputSchema: {
			path: z
				.string()
				.optional()
				.describe("Repository path (default: current directory)"),
			response_format: z
				.enum(["markdown", "json"])
				.optional()
				.describe("Output format: 'markdown' (default) or 'json'"),
		},
		annotations: {
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
	},
	async (args: { path?: string; response_format?: string }) => {
		const cid = createCorrelationId();
		const startTime = Date.now();
		const { path, response_format } = args;

		mcpLogger.info("Tool request", { cid, tool: "git_get_stash_list", path });

		const format =
			response_format === "json"
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;

		try {
			const results = getStashList(path);

			if (isError(results)) {
				mcpLogger.error("Tool failed", {
					cid,
					tool: "git_get_stash_list",
					error: results.error,
					durationMs: Date.now() - startTime,
				});
			} else {
				mcpLogger.info("Tool response", {
					cid,
					tool: "git_get_stash_list",
					success: true,
					count: results.count,
					durationMs: Date.now() - startTime,
				});
			}

			return {
				...(isError(results) ? { isError: true } : {}),
				content: [
					{ type: "text" as const, text: formatStashList(results, format) },
				],
			};
		} catch (error) {
			mcpLogger.error("Tool failed", {
				cid,
				tool: "git_get_stash_list",
				error: error instanceof Error ? error.message : "Unknown error",
				durationMs: Date.now() - startTime,
			});
			throw error;
		}
	},
);

// Start the MCP server
startServer("git-intelligence", { version: "1.0.0" });
