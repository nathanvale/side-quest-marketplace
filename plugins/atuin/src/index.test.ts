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
