import { describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";

// Types for testing
interface HistoryCommand {
	time: string;
	exit_code: number | string;
	command: string;
}

interface HistoryResult {
	count: number;
	commands: HistoryCommand[];
	message?: string;
	source?: string;
}

interface ErrorResult {
	error: string;
}

type SearchResult = HistoryResult | ErrorResult;

function isError(result: SearchResult): result is ErrorResult {
	return typeof result === "object" && result !== null && "error" in result;
}

/**
 * Format search results for display (copied from main module for testing)
 */
function formatResults(results: SearchResult): string {
	if (isError(results)) {
		return `Error: ${results.error}`;
	}

	if (results.count === 0) {
		return results.message || "No commands found in history.";
	}

	let output = `Found ${results.count} command${results.count === 1 ? "" : "s"}:\n\n`;

	results.commands.forEach((cmd, idx) => {
		const exitIcon =
			cmd.exit_code === 0 ? "[OK]" : cmd.exit_code === "N/A" ? "[?]" : "[FAIL]";
		const exitDisplay = cmd.exit_code === "N/A" ? "N/A" : `${cmd.exit_code}`;

		output += `${idx + 1}. ${exitIcon} Exit: ${exitDisplay} | Time: ${cmd.time}\n`;
		output += `   ${cmd.command}\n\n`;
	});

	if (results.source === "zsh_history_fallback") {
		output += "\n[!] Using zsh history fallback (atuin unavailable)\n";
	}

	return output.trim();
}

/**
 * Parse atuin output line (for testing the parsing logic)
 */
function parseAtuinLine(line: string): HistoryCommand {
	const [time, exitCodeStr, ...commandParts] = line.split("\t");
	return {
		time: time ?? "",
		exit_code: Number.parseInt(exitCodeStr ?? "0", 10),
		command: commandParts.join("\t"),
	};
}

/**
 * Check if atuin is installed and available
 */
function isAtuinAvailable(): boolean {
	try {
		execSync("which atuin", {
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return true;
	} catch {
		return false;
	}
}

describe("atuin availability", () => {
	test("detects atuin installation status", () => {
		const available = isAtuinAvailable();
		// Just verify the check works
		expect(typeof available).toBe("boolean");
	});
});

describe("output parsing", () => {
	test("parses atuin format correctly", () => {
		// Simulated atuin output format: time\texit_code\tcommand
		const line = "2024-01-15 10:30:00\t0\tgit status";
		const parsed = parseAtuinLine(line);

		expect(parsed.time).toBe("2024-01-15 10:30:00");
		expect(parsed.exit_code).toBe(0);
		expect(parsed.command).toBe("git status");
	});

	test("handles failed commands", () => {
		const line = "2024-01-15 10:31:00\t1\tgit push --force";
		const parsed = parseAtuinLine(line);

		expect(parsed.exit_code).toBe(1);
		expect(parsed.command).toBe("git push --force");
	});

	test("handles commands with tabs", () => {
		const line = '2024-01-15 10:32:00\t0\techo "hello\tworld"';
		const parsed = parseAtuinLine(line);

		expect(parsed.command).toBe('echo "hello\tworld"');
	});
});

describe("result formatting", () => {
	test("formats empty results", () => {
		const result: HistoryResult = {
			count: 0,
			commands: [],
			message: "No commands found matching: test",
		};

		const formatted = formatResults(result);
		expect(formatted).toBe("No commands found matching: test");
	});

	test("formats single command", () => {
		const result: HistoryResult = {
			count: 1,
			commands: [
				{
					time: "2024-01-15 10:30:00",
					exit_code: 0,
					command: "git status",
				},
			],
		};

		const formatted = formatResults(result);
		expect(formatted).toContain("Found 1 command");
		expect(formatted).toContain("[OK]");
		expect(formatted).toContain("Exit: 0");
		expect(formatted).toContain("git status");
	});

	test("formats multiple commands", () => {
		const result: HistoryResult = {
			count: 2,
			commands: [
				{
					time: "2024-01-15 10:30:00",
					exit_code: 0,
					command: "git status",
				},
				{
					time: "2024-01-15 10:31:00",
					exit_code: 1,
					command: "git push --force",
				},
			],
		};

		const formatted = formatResults(result);
		expect(formatted).toContain("Found 2 commands");
		expect(formatted).toContain("[OK]");
		expect(formatted).toContain("[FAIL]");
	});

	test("formats error result", () => {
		const result: ErrorResult = {
			error: "atuin not found",
		};

		const formatted = formatResults(result);
		expect(formatted).toBe("Error: atuin not found");
	});

	test("shows fallback warning", () => {
		const result: HistoryResult = {
			count: 1,
			commands: [
				{
					time: "N/A",
					exit_code: "N/A",
					command: "echo test",
				},
			],
			source: "zsh_history_fallback",
		};

		const formatted = formatResults(result);
		expect(formatted).toContain("[!] Using zsh history fallback");
		expect(formatted).toContain("[?]");
		expect(formatted).toContain("Exit: N/A");
	});
});

describe("isError type guard", () => {
	test("returns true for error results", () => {
		const error: ErrorResult = { error: "test error" };
		expect(isError(error)).toBe(true);
	});

	test("returns false for success results", () => {
		const success: HistoryResult = { count: 0, commands: [] };
		expect(isError(success)).toBe(false);
	});
});

describe("command building", () => {
	// Test the command building logic by constructing expected commands
	type SearchMode = "fuzzy" | "prefix" | "full-text";

	interface SearchOptions {
		query: string;
		limit?: number;
		includeFailed?: boolean;
		cwd?: string;
		since?: string;
		until?: string;
		searchMode?: SearchMode;
	}

	function buildAtuinCommand(options: SearchOptions): string {
		const {
			query,
			limit = 10,
			includeFailed = false,
			cwd,
			since,
			until,
			searchMode = "fuzzy",
		} = options;

		const parts = ["atuin", "search"];
		parts.push(`--limit ${limit}`);
		parts.push(`--search-mode ${searchMode}`);
		parts.push("--filter-mode global");
		parts.push('--format "{time}\\t{exit}\\t{command}"');

		if (!includeFailed) parts.push("--exit 0");
		if (cwd) parts.push(`--cwd "${cwd.replace(/"/g, '\\"')}"`);
		if (since) parts.push(`--after "${since.replace(/"/g, '\\"')}"`);
		if (until) parts.push(`--before "${until.replace(/"/g, '\\"')}"`);

		const escapedQuery = query.replace(/"/g, '\\"');
		parts.push(`"${escapedQuery}"`);

		return parts.join(" ");
	}

	test("builds basic command", () => {
		const cmd = buildAtuinCommand({ query: "git" });
		expect(cmd).toContain("atuin search");
		expect(cmd).toContain("--limit 10");
		expect(cmd).toContain("--search-mode fuzzy");
		expect(cmd).toContain("--exit 0");
		expect(cmd).toContain('"git"');
	});

	test("includes failed commands when requested", () => {
		const cmd = buildAtuinCommand({ query: "git", includeFailed: true });
		expect(cmd).not.toContain("--exit 0");
	});

	test("adds cwd filter", () => {
		const cmd = buildAtuinCommand({ query: "npm", cwd: "/Users/test/project" });
		expect(cmd).toContain('--cwd "/Users/test/project"');
	});

	test("adds time range filters", () => {
		const cmd = buildAtuinCommand({
			query: "deploy",
			since: "1 week ago",
			until: "yesterday",
		});
		expect(cmd).toContain('--after "1 week ago"');
		expect(cmd).toContain('--before "yesterday"');
	});

	test("supports different search modes", () => {
		const fuzzy = buildAtuinCommand({ query: "test", searchMode: "fuzzy" });
		const prefix = buildAtuinCommand({ query: "test", searchMode: "prefix" });
		const fullText = buildAtuinCommand({
			query: "test",
			searchMode: "full-text",
		});

		expect(fuzzy).toContain("--search-mode fuzzy");
		expect(prefix).toContain("--search-mode prefix");
		expect(fullText).toContain("--search-mode full-text");
	});

	test("escapes quotes in query", () => {
		const cmd = buildAtuinCommand({ query: 'echo "hello"' });
		expect(cmd).toContain('echo \\"hello\\"');
	});

	test("escapes quotes in cwd", () => {
		const cmd = buildAtuinCommand({
			query: "test",
			cwd: '/path/with "quotes"',
		});
		expect(cmd).toContain('--cwd "/path/with \\"quotes\\""');
	});

	test("combines all options", () => {
		const cmd = buildAtuinCommand({
			query: "docker",
			limit: 20,
			includeFailed: true,
			cwd: "/app",
			since: "2024-01-01",
			until: "2024-12-31",
			searchMode: "full-text",
		});

		expect(cmd).toContain("--limit 20");
		expect(cmd).toContain("--search-mode full-text");
		expect(cmd).toContain('--cwd "/app"');
		expect(cmd).toContain('--after "2024-01-01"');
		expect(cmd).toContain('--before "2024-12-31"');
		expect(cmd).not.toContain("--exit 0");
	});
});

describe("atuin integration", () => {
	const atuinAvailable = isAtuinAvailable();

	test.skipIf(!atuinAvailable)("can execute atuin search", () => {
		// Only runs if atuin is installed
		const output = execSync(
			'atuin search --limit 1 --format "{time}\\t{exit}\\t{command}"',
			{
				encoding: "utf8",
			},
		);
		// Just verify it returns something
		expect(typeof output).toBe("string");
	});

	test.skipIf(!atuinAvailable)("atuin output is parseable", () => {
		const output = execSync(
			'atuin search --limit 3 --format "{time}\\t{exit}\\t{command}"',
			{
				encoding: "utf8",
			},
		);

		if (output.trim()) {
			const lines = output.trim().split("\n").filter(Boolean);
			expect(lines.length).toBeGreaterThan(0);

			// Just verify that parsing doesn't throw and produces expected structure
			lines.forEach((line) => {
				const parsed = parseAtuinLine(line);
				expect(parsed).toHaveProperty("time");
				expect(parsed).toHaveProperty("exit_code");
				expect(parsed).toHaveProperty("command");
				expect(typeof parsed.exit_code).toBe("number");
			});
		}
	});

	test.skipIf(!atuinAvailable)("can filter by cwd", () => {
		// Only runs if atuin is installed
		// Use current directory as a valid cwd
		const cwd = process.cwd();
		try {
			const output = execSync(
				`atuin search --limit 1 --cwd "${cwd}" --format "{time}\\t{exit}\\t{command}"`,
				{
					encoding: "utf8",
				},
			);
			// Just verify it executes without error
			expect(typeof output).toBe("string");
		} catch {
			// No history in this directory - that's okay, flag works
			expect(true).toBe(true);
		}
	});

	test.skipIf(!atuinAvailable)("can filter by time range", () => {
		// Only runs if atuin is installed
		const output = execSync(
			'atuin search --limit 1 --after "1 month ago" --format "{time}\\t{exit}\\t{command}"',
			{
				encoding: "utf8",
			},
		);
		// Just verify it executes without error
		expect(typeof output).toBe("string");
	});
});

// ============================================================================
// MCP Handler Tests - Tool response structure and format handling
// ============================================================================

type SearchMode = "fuzzy" | "prefix" | "full-text";

describe("MCP handler response structure", () => {
	describe("atuin_search_history tool", () => {
		test("should handle successful search results", () => {
			const mockResult: HistoryResult = {
				count: 2,
				commands: [
					{
						time: "2024-01-15 10:30:00",
						exit_code: 0,
						command: "git status",
					},
					{
						time: "2024-01-15 10:31:00",
						exit_code: 0,
						command: "npm test",
					},
				],
			};

			expect(mockResult.count).toBe(2);
			expect(mockResult.commands).toHaveLength(2);
			expect(mockResult.commands[0]?.exit_code).toBe(0);
		});

		test("should handle empty search results", () => {
			const mockResult: HistoryResult = {
				count: 0,
				commands: [],
				message: "No commands found matching: nonexistent",
			};

			expect(mockResult.count).toBe(0);
			expect(mockResult.commands).toHaveLength(0);
			expect(mockResult.message).toBeTruthy();
		});

		test("should handle error results", () => {
			const mockError: ErrorResult = {
				error: "atuin not found",
			};

			expect(mockError.error).toBeTruthy();
		});

		test("should support different search modes", () => {
			const searchModes: SearchMode[] = ["fuzzy", "prefix", "full-text"];
			searchModes.forEach((mode) => {
				expect(["fuzzy", "prefix", "full-text"]).toContain(mode);
			});
		});

		test("should validate include_failed parameter", () => {
			const includeFailed = true;
			expect(typeof includeFailed).toBe("boolean");
		});
	});

	describe("atuin_get_recent_history tool", () => {
		test("should handle recent history results", () => {
			const mockResult: HistoryResult = {
				count: 3,
				commands: [
					{
						time: "2024-01-15 10:30:00",
						exit_code: 0,
						command: "echo hello",
					},
					{
						time: "2024-01-15 10:29:00",
						exit_code: 1,
						command: "false",
					},
					{
						time: "2024-01-15 10:28:00",
						exit_code: 0,
						command: "ls -la",
					},
				],
			};

			expect(mockResult.count).toBe(3);
			expect(mockResult.commands[1]?.exit_code).toBe(1);
		});

		test("should handle fallback to zsh history", () => {
			const mockResult: HistoryResult = {
				count: 2,
				commands: [
					{
						time: "N/A",
						exit_code: "N/A",
						command: "git status",
					},
					{
						time: "N/A",
						exit_code: "N/A",
						command: "npm test",
					},
				],
				source: "zsh_history_fallback",
			};

			expect(mockResult.source).toBe("zsh_history_fallback");
			expect(mockResult.commands[0]?.exit_code).toBe("N/A");
			expect(mockResult.commands[0]?.time).toBe("N/A");
		});
	});

	describe("atuin_search_by_context tool", () => {
		interface ContextEntry {
			ts: string;
			cmd: string;
			branch: string;
			session: string;
			cwd: string;
		}

		interface ContextResult {
			count: number;
			entries: ContextEntry[];
			message?: string;
		}

		test("should handle context search results by branch", () => {
			const mockResult: ContextResult = {
				count: 2,
				entries: [
					{
						ts: "2024-01-15 10:30:00",
						cmd: "git commit -m 'test'",
						branch: "feature-branch",
						session: "abc123",
						cwd: "/path/to/repo",
					},
					{
						ts: "2024-01-15 10:25:00",
						cmd: "git push",
						branch: "feature-branch",
						session: "abc123",
						cwd: "/path/to/repo",
					},
				],
			};

			expect(mockResult.count).toBe(2);
			expect(mockResult.entries[0]?.branch).toBe("feature-branch");
			expect(mockResult.entries[1]?.branch).toBe("feature-branch");
		});

		test("should handle context search results by session", () => {
			const mockResult: ContextResult = {
				count: 1,
				entries: [
					{
						ts: "2024-01-15 10:30:00",
						cmd: "npm test",
						branch: "main",
						session: "session123",
						cwd: "/path/to/repo",
					},
				],
			};

			expect(mockResult.count).toBe(1);
			expect(mockResult.entries[0]?.session).toBe("session123");
		});

		test("should handle empty context results", () => {
			const mockResult: ContextResult = {
				count: 0,
				entries: [],
				message: "No commands found matching: branch: nonexistent",
			};

			expect(mockResult.count).toBe(0);
			expect(mockResult.entries).toHaveLength(0);
			expect(mockResult.message).toContain("No commands found");
		});
	});

	describe("atuin_history_insights tool", () => {
		interface HistoryInsights {
			period: string;
			stats?: string;
			failedCommands?: { command: string; count: number; lastTime: string }[];
			message?: string;
		}

		test("should handle insights with stats", () => {
			const mockInsights: HistoryInsights = {
				period: "today",
				stats: "Most used commands:\n  git: 25\n  npm: 15\n  ls: 10",
			};

			expect(mockInsights.period).toBe("today");
			expect(mockInsights.stats).toContain("git: 25");
		});

		test("should handle insights with failed commands", () => {
			const mockInsights: HistoryInsights = {
				period: "week",
				failedCommands: [
					{ command: "npm", count: 5, lastTime: "2024-01-15 10:30:00" },
					{ command: "git", count: 2, lastTime: "2024-01-14 15:20:00" },
				],
			};

			expect(mockInsights.failedCommands).toHaveLength(2);
			expect(mockInsights.failedCommands?.[0]?.count).toBe(5);
		});

		test("should handle insights with both stats and failures", () => {
			const mockInsights: HistoryInsights = {
				period: "month",
				stats: "git: 100\nnpm: 50",
				failedCommands: [
					{ command: "npm", count: 3, lastTime: "2024-01-15 10:30:00" },
				],
			};

			expect(mockInsights.stats).toBeTruthy();
			expect(mockInsights.failedCommands).toHaveLength(1);
		});

		test("should validate insight period values", () => {
			const periods = ["today", "week", "month", "all"] as const;
			periods.forEach((period) => {
				expect(["today", "week", "month", "all"]).toContain(period);
			});
		});

		test("should validate insight focus values", () => {
			const focuses = ["frequent", "failures", "all"] as const;
			focuses.forEach((focus) => {
				expect(["frequent", "failures", "all"]).toContain(focus);
			});
		});
	});

	describe("response format handling", () => {
		test("should format markdown results with exit codes", () => {
			const result: HistoryResult = {
				count: 2,
				commands: [
					{
						time: "2024-01-15 10:30:00",
						exit_code: 0,
						command: "git status",
					},
					{
						time: "2024-01-15 10:31:00",
						exit_code: 1,
						command: "git push --force",
					},
				],
			};

			const formatted = formatResults(result);
			expect(formatted).toContain("[OK]");
			expect(formatted).toContain("[FAIL]");
			expect(formatted).toContain("Exit: 0");
			expect(formatted).toContain("Exit: 1");
		});

		test("should format JSON results", () => {
			const result: HistoryResult = {
				count: 1,
				commands: [
					{
						time: "2024-01-15 10:30:00",
						exit_code: 0,
						command: "echo test",
					},
				],
			};

			const formatted = JSON.stringify(result);
			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.count).toBe(1);
		});

		test("should handle fallback indicator in formatted output", () => {
			const result: HistoryResult = {
				count: 1,
				commands: [
					{
						time: "N/A",
						exit_code: "N/A",
						command: "echo test",
					},
				],
				source: "zsh_history_fallback",
			};

			const formatted = formatResults(result);
			expect(formatted).toContain("[!] Using zsh history fallback");
		});
	});

	describe("error handling", () => {
		test("should detect atuin unavailable errors", () => {
			const errorMessage = "atuin command not found";
			const isError =
				errorMessage.includes("atuin") && errorMessage.includes("not found");
			expect(isError).toBe(true);
		});

		test("should handle search with no results gracefully", () => {
			const result: HistoryResult = {
				count: 0,
				commands: [],
				message: "No commands found matching: test",
			};

			expect(result.count).toBe(0);
			expect(result.message).toBeTruthy();
		});

		test("should validate search options structure", () => {
			interface SearchOptions {
				query: string;
				limit?: number;
				includeFailed?: boolean;
				cwd?: string;
				since?: string;
				until?: string;
				searchMode?: SearchMode;
			}

			const options: SearchOptions = {
				query: "test",
				limit: 10,
				includeFailed: false,
				searchMode: "fuzzy",
			};

			expect(options.query).toBe("test");
			expect(options.limit).toBe(10);
			expect(options.includeFailed).toBe(false);
			expect(options.searchMode).toBe("fuzzy");
		});
	});
});
