import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Import functions we'll implement
import {
	createAutoCommit,
	generateCommitMessage,
	getLastUserPrompt,
	parseGitStatus,
	printUserNotification,
	truncateForSubject,
} from "./auto-commit-on-stop";

describe("parseGitStatus", () => {
	test("parses clean status", () => {
		const result = parseGitStatus("");
		expect(result).toEqual({ staged: 0, modified: 0, untracked: 0 });
	});

	test("parses staged files", () => {
		const output = `M  src/index.ts
A  src/new-file.ts`;
		const result = parseGitStatus(output);
		expect(result).toEqual({ staged: 2, modified: 0, untracked: 0 });
	});

	test("parses modified files (unstaged)", () => {
		const output = ` M src/index.ts
 M src/other.ts`;
		const result = parseGitStatus(output);
		expect(result).toEqual({ staged: 0, modified: 2, untracked: 0 });
	});

	test("parses untracked files", () => {
		const output = `?? src/new-file.ts
?? src/another.ts`;
		const result = parseGitStatus(output);
		expect(result).toEqual({ staged: 0, modified: 0, untracked: 2 });
	});

	test("parses mixed status", () => {
		const output = `M  src/staged.ts
 M src/modified.ts
MM src/both.ts
?? src/untracked.ts`;
		const result = parseGitStatus(output);
		// M  = staged only (1)
		//  M = modified only (1)
		// MM = staged AND modified (counts as 1 staged + 1 modified)
		// ?? = untracked (1)
		expect(result).toEqual({ staged: 2, modified: 2, untracked: 1 });
	});

	test("ignores branch line", () => {
		const output = `## main...origin/main
M  src/index.ts`;
		const result = parseGitStatus(output);
		expect(result).toEqual({ staged: 1, modified: 0, untracked: 0 });
	});

	test("handles deleted files", () => {
		const output = `D  src/deleted.ts
 D src/deleted-unstaged.ts`;
		const result = parseGitStatus(output);
		expect(result).toEqual({ staged: 1, modified: 1, untracked: 0 });
	});

	test("handles renamed files", () => {
		const output = `R  src/old.ts -> src/new.ts`;
		const result = parseGitStatus(output);
		expect(result).toEqual({ staged: 1, modified: 0, untracked: 0 });
	});
});

describe("getLastUserPrompt", () => {
	let tempDir: string;
	let transcriptPath: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `git-hook-test-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });
		transcriptPath = join(tempDir, "transcript.jsonl");
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("extracts last user prompt from valid transcript", async () => {
		const transcript = [
			{ type: "user", message: { role: "user", content: "first prompt" } },
			{
				type: "assistant",
				message: { role: "assistant", content: "response" },
			},
			{ type: "user", message: { role: "user", content: "second prompt" } },
		]
			.map((line) => JSON.stringify(line))
			.join("\n");

		await writeFile(transcriptPath, transcript);

		const result = await getLastUserPrompt(transcriptPath);
		expect(result).toBe("second prompt");
	});

	test("returns null for empty transcript", async () => {
		await writeFile(transcriptPath, "");

		const result = await getLastUserPrompt(transcriptPath);
		expect(result).toBe(null);
	});

	test("skips malformed JSONL lines", async () => {
		const transcript = [
			{ type: "user", message: { role: "user", content: "first prompt" } },
			"invalid json line",
			{ type: "user", message: { role: "user", content: "second prompt" } },
		]
			.map((line) => (typeof line === "string" ? line : JSON.stringify(line)))
			.join("\n");

		await writeFile(transcriptPath, transcript);

		const result = await getLastUserPrompt(transcriptPath);
		expect(result).toBe("second prompt");
	});

	test("returns null for non-existent file", async () => {
		const result = await getLastUserPrompt("/nonexistent/path.jsonl");
		expect(result).toBe(null);
	});

	test("returns null when no user messages found", async () => {
		const transcript = [
			{
				type: "assistant",
				message: { role: "assistant", content: "response" },
			},
			{ type: "system", message: { role: "system", content: "system msg" } },
		]
			.map((line) => JSON.stringify(line))
			.join("\n");

		await writeFile(transcriptPath, transcript);

		const result = await getLastUserPrompt(transcriptPath);
		expect(result).toBe(null);
	});

	test("handles transcript with only user messages", async () => {
		const transcript = [
			{ type: "user", message: { role: "user", content: "only user message" } },
		]
			.map((line) => JSON.stringify(line))
			.join("\n");

		await writeFile(transcriptPath, transcript);

		const result = await getLastUserPrompt(transcriptPath);
		expect(result).toBe("only user message");
	});
});

describe("truncateForSubject", () => {
	test("returns text unchanged when under max length", () => {
		const text = "short text";
		const result = truncateForSubject(text, 50);
		expect(result).toBe("short text");
	});

	test("truncates text at max length", () => {
		const text = "this is a very long text that needs to be truncated";
		const result = truncateForSubject(text, 20);
		expect(result).toBe("this is a very lo...");
	});

	test("handles empty string", () => {
		const result = truncateForSubject("", 50);
		expect(result).toBe("");
	});

	test("truncates exactly at boundary", () => {
		const text = "exactly twenty chars";
		const result = truncateForSubject(text, 20);
		expect(result).toBe("exactly twenty chars");
	});

	test("adds ellipsis when truncating", () => {
		const text = "twelve chars";
		const result = truncateForSubject(text, 8);
		expect(result).toBe("twelv...");
		expect(result.length).toBe(8);
	});

	test("handles single character max length", () => {
		const text = "hello";
		const result = truncateForSubject(text, 4);
		expect(result).toBe("h...");
		expect(result.length).toBe(4);
	});
});

describe("generateCommitMessage", () => {
	test("generates message with valid prompt", () => {
		const result = generateCommitMessage("add validation to form");
		expect(result).toContain("chore(wip): add validation to form");
		expect(result).toContain("Session work in progress");
	});

	test("uses fallback for null prompt", () => {
		const result = generateCommitMessage(null);
		expect(result).toContain("chore(wip): session checkpoint");
	});

	test("uses fallback for empty prompt", () => {
		const result = generateCommitMessage("");
		expect(result).toContain("chore(wip): session checkpoint");
	});

	test("truncates long prompts in subject line", () => {
		const longPrompt =
			"add validation to all form fields including email, password, and username with comprehensive error messages";
		const result = generateCommitMessage(longPrompt);
		const firstLine = result.split("\n")[0] ?? "";
		// Subject should be truncated to ~50 chars after "chore(wip): " (12 chars)
		expect(firstLine.length).toBeLessThanOrEqual(62); // 12 + 50
	});

	test("includes proper message structure", () => {
		const result = generateCommitMessage("test prompt");
		const lines = result.split("\n");

		expect(lines[0]).toMatch(/^chore\(wip\):/);
		expect(lines[1]).toBe("");
		expect(lines[2]).toContain("Session work in progress");
	});
});

describe("createAutoCommit", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `git-commit-test-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });

		// Initialize git repo
		await Bun.spawn(["git", "init"], { cwd: tempDir }).exited;
		await Bun.spawn(["git", "config", "user.name", "Test User"], {
			cwd: tempDir,
		}).exited;
		await Bun.spawn(["git", "config", "user.email", "test@example.com"], {
			cwd: tempDir,
		}).exited;
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("creates commit with staged and unstaged changes", async () => {
		// Create files
		await writeFile(join(tempDir, "file1.txt"), "content 1");
		await writeFile(join(tempDir, "file2.txt"), "content 2");

		const message = generateCommitMessage("test changes");
		const result = await createAutoCommit(tempDir, message);

		expect(result).toBe(true);

		// Verify commit was created
		const proc = Bun.spawn(["git", "log", "--oneline", "-1"], {
			cwd: tempDir,
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		expect(output).toContain("chore(wip): test changes");
	});

	test("returns false for non-git directory", async () => {
		const nonGitDir = join(tmpdir(), `non-git-${Date.now()}`);
		await mkdir(nonGitDir, { recursive: true });

		const message = generateCommitMessage("test");
		const result = await createAutoCommit(nonGitDir, message);

		expect(result).toBe(false);

		await rm(nonGitDir, { recursive: true, force: true });
	});

	test("handles commit with no changes gracefully", async () => {
		const message = generateCommitMessage("no changes");
		const result = await createAutoCommit(tempDir, message);

		// Should return false when nothing to commit
		expect(result).toBe(false);
	});

	test("stages all files including untracked", async () => {
		await writeFile(join(tempDir, "tracked.txt"), "tracked");
		await writeFile(join(tempDir, "untracked.txt"), "untracked");

		// Only stage one file initially
		await Bun.spawn(["git", "add", "tracked.txt"], { cwd: tempDir }).exited;
		await Bun.spawn(["git", "commit", "-m", "initial"], { cwd: tempDir })
			.exited;

		// Modify tracked and add new untracked
		await writeFile(join(tempDir, "tracked.txt"), "modified");
		await writeFile(join(tempDir, "new-untracked.txt"), "new");

		const message = generateCommitMessage("stage all");
		const result = await createAutoCommit(tempDir, message);

		expect(result).toBe(true);

		// Verify both files were committed
		const proc = Bun.spawn(["git", "show", "--name-only", "--format="], {
			cwd: tempDir,
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		expect(output).toContain("tracked.txt");
		expect(output).toContain("new-untracked.txt");
	});
});

describe("printUserNotification", () => {
	test("prints formatted notification to stdout", () => {
		const message = "chore(wip): add validation";
		const consoleSpy = {
			calls: [] as string[],
			log: function (msg: string) {
				this.calls.push(msg);
			},
		};

		const originalLog = console.log;
		console.log = consoleSpy.log.bind(consoleSpy);

		printUserNotification(message);

		console.log = originalLog;

		expect(consoleSpy.calls.length).toBeGreaterThan(0);
		const output = consoleSpy.calls.join("\n");
		expect(output).toContain("✓");
		expect(output).toContain("chore(wip): add validation");
		expect(output).toContain("/git:commit");
	});

	test("extracts subject line from full commit message", () => {
		const fullMessage = `chore(wip): add validation

Session work in progress - run /git:commit to squash.`;

		const consoleSpy = {
			calls: [] as string[],
			log: function (msg: string) {
				this.calls.push(msg);
			},
		};

		const originalLog = console.log;
		console.log = consoleSpy.log.bind(consoleSpy);

		printUserNotification(fullMessage);

		console.log = originalLog;

		const output = consoleSpy.calls.join("\n");
		expect(output).toContain("chore(wip): add validation");
		expect(output).not.toContain("Session work in progress"); // Body should not appear
	});
});
