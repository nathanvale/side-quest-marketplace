/**
 * Tests for inbox-move CLI command
 *
 * Covers scanning for routable notes, JSON/markdown output modes,
 * error handling, and the complete move workflow.
 *
 * @module cli/inbox-move.test
 */

import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	test,
} from "bun:test";
import { OutputFormat } from "@sidequest/core/terminal";
import { loadConfig } from "../config/index";
import {
	createTestVault,
	useTestVaultCleanup,
	vaultFileExists,
	writeVaultFile,
} from "../testing/utils";
import { handleInboxMove } from "./inbox-move";
import type { CommandContext } from "./types";

// =============================================================================
// Mock Session Tracking
// =============================================================================

const mockEndSession = mock(() => {});
const mockStartSession = mock(() => ({
	sessionCid: "test-session-123",
	startTime: Date.now(),
	end: mockEndSession,
}));

mock.module("./shared/session", () => ({
	startSession: mockStartSession,
}));

// =============================================================================
// Mock Inquirer (for interactive confirmation)
// =============================================================================

const mockConfirm = mock(async () => true);

mock.module("@inquirer/prompts", () => ({
	confirm: mockConfirm,
}));

// =============================================================================
// Mock globFiles to avoid Bun.Glob issues in test environment
// =============================================================================

import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Mock globFiles that matches real API:
 * - Accepts (pattern, options) where options can be string (cwd) or { cwd: string }
 * - Returns ABSOLUTE paths by default (matches core/glob behavior)
 */
const mockGlobFiles = async (
	_pattern: string,
	options?: string | { cwd?: string },
) => {
	// Normalize options - real impl accepts string or object
	const cwd =
		typeof options === "string" ? options : (options?.cwd ?? process.cwd());

	// Simple implementation that finds .md files in directory
	try {
		const files: string[] = [];
		const entries = readdirSync(cwd, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isFile() && entry.name.endsWith(".md")) {
				// Return ABSOLUTE paths (matches real globFiles default behavior)
				files.push(join(cwd, entry.name));
			}
		}
		return files;
	} catch {
		return [];
	}
};

mock.module("@sidequest/core/glob", () => ({
	globFiles: mockGlobFiles,
}));

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create test CommandContext with defaults
 * Note: This is different from createInboxTestContext which creates ExecutionContext
 */
function createCommandContext(overrides: {
	positional?: string[];
	flags?: Record<string, string | boolean>;
	isJson?: boolean;
}): CommandContext {
	const vault = process.env.PARA_VAULT;
	if (!vault) {
		throw new Error(
			"PARA_VAULT environment variable must be set in beforeEach",
		);
	}

	const config = loadConfig();

	return {
		config,
		positional: overrides.positional ?? [],
		flags: overrides.flags ?? {},
		format: overrides.isJson ? OutputFormat.JSON : OutputFormat.MARKDOWN,
		isJson: overrides.isJson ?? false,
		subcommand: undefined,
	};
}

/**
 * Capture console.log output for async functions
 */
async function captureConsoleOutputAsync(
	fn: () => Promise<void>,
): Promise<string[]> {
	const logs: string[] = [];
	const originalLog = console.log;
	console.log = (...args: unknown[]) =>
		logs.push(args.map((a) => String(a)).join(" "));

	try {
		await fn();
	} finally {
		console.log = originalLog;
	}

	return logs;
}

/**
 * Find and parse JSON from console logs
 */
function findJsonOutput(logs: string[]): unknown {
	for (const log of logs) {
		try {
			if (log.trim().startsWith("{")) {
				return JSON.parse(log);
			}
		} catch {
			// Not JSON, continue
		}
	}
	throw new Error("No JSON output found in logs");
}

/**
 * Create an area folder with default area note
 */
function setupAreaFolder(vault: string, areaName: string): void {
	writeVaultFile(vault, `02 Areas/${areaName}/${areaName}.md`, `# ${areaName}`);
}

/**
 * Create a project folder with default project note
 */
function setupProjectFolder(vault: string, projectName: string): void {
	writeVaultFile(
		vault,
		`01 Projects/${projectName}/${projectName}.md`,
		`# ${projectName}`,
	);
}

/**
 * Create an inbox note with frontmatter
 */
function createInboxNote(
	vault: string,
	filename: string,
	frontmatter: Record<string, unknown>,
	content = "",
): void {
	const fmLines = Object.entries(frontmatter).map(([key, val]) => {
		const value = typeof val === "string" ? `"${val}"` : JSON.stringify(val);
		return `${key}: ${value}`;
	});
	const note = `---
${fmLines.join("\n")}
---
${content}`;
	writeVaultFile(vault, `00 Inbox/${filename}`, note);
}

// =============================================================================
// Tests
// =============================================================================

describe("handleInboxMove", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	let vault: string;

	beforeEach(() => {
		vault = createTestVault();
		trackVault(vault);
		mockStartSession.mockClear();
		mockEndSession.mockClear();
		mockConfirm.mockClear();
		mockConfirm.mockResolvedValue(true);
	});

	afterEach(getAfterEachHook());

	afterAll(() => {
		// Restore all module mocks to prevent global state pollution
		mock.restore();
	});

	describe("no routable notes", () => {
		test("returns success with message when inbox is empty (markdown)", async () => {
			writeVaultFile(vault, "00 Inbox/.gitkeep", "");

			const ctx = createCommandContext({ isJson: false });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const output = logs.join("\n");
			expect(output).toContain("No notes ready to move");
			expect(output).toContain("need area or project in frontmatter");
		});

		test("returns structured JSON when inbox is empty (JSON)", async () => {
			writeVaultFile(vault, "00 Inbox/.gitkeep", "");

			const ctx = createCommandContext({ isJson: true });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.success).toBe(true);
			expect(jsonOutput.moved).toBe(0);
			expect(jsonOutput.message).toContain("No notes ready to move");
			expect(jsonOutput.hint).toContain("area or project in frontmatter");
		});

		test("skips notes missing title", async () => {
			writeVaultFile(
				vault,
				"00 Inbox/no-title.md",
				`---
area: "[[Health]]"
---
# Content without title
`,
			);

			const ctx = createCommandContext({ isJson: true });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.success).toBe(true);
			expect(jsonOutput.moved).toBe(0);
		});

		test("skips notes without area or project", async () => {
			writeVaultFile(
				vault,
				"00 Inbox/no-routing.md",
				`---
title: "Note Without Routing"
type: bookmark
---
# Content
`,
			);

			const ctx = createCommandContext({ isJson: true });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.success).toBe(true);
			expect(jsonOutput.moved).toBe(0);
		});
	});

	describe("JSON preview mode", () => {
		test("returns candidate list without executing moves", async () => {
			setupAreaFolder(vault, "Health");
			createInboxNote(vault, "medical-note.md", {
				title: "Medical Note",
				area: "[[Health]]",
				type: "bookmark",
			});

			const ctx = createCommandContext({ isJson: true });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.candidates).toBeDefined();
			expect(Array.isArray(jsonOutput.candidates)).toBe(true);
			expect(jsonOutput.count).toBe(1);

			const candidates = jsonOutput.candidates as Array<{
				title: string;
				from: string;
				to: string;
				area?: string;
			}>;
			expect(candidates[0]?.title).toBe("Medical Note");
			expect(candidates[0]?.from).toContain("00 Inbox/medical-note.md");
			expect(candidates[0]?.to).toContain("02 Areas/Health");
			expect(candidates[0]?.area).toBe("[[Health]]");

			// Verify file was NOT moved
			expect(vaultFileExists(vault, "00 Inbox/medical-note.md")).toBe(true);
		});

		test("includes colocate information when present", async () => {
			// Create area as a FILE (not folder) to trigger colocate
			writeVaultFile(vault, "02 Areas/Fitness.md", "# Fitness");
			writeVaultFile(
				vault,
				"00 Inbox/workout.md",
				`---
title: "Workout Log"
area: "[[Fitness]]"
---
# Content
`,
			);

			const ctx = createCommandContext({ isJson: true });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			const candidates = jsonOutput.candidates as Array<{
				colocate: unknown | null;
			}>;
			// Colocate should be present (non-null) since Fitness is a file
			expect(candidates[0]?.colocate).not.toBeNull();
		});

		test("handles multiple routable notes", async () => {
			setupAreaFolder(vault, "Health");
			setupProjectFolder(vault, "Project A");

			createInboxNote(vault, "note1.md", {
				title: "Note 1",
				area: "[[Health]]",
			});
			createInboxNote(vault, "note2.md", {
				title: "Note 2",
				project: "[[Project A]]",
			});

			const ctx = createCommandContext({ isJson: true });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.count).toBe(2);
			expect(Array.isArray(jsonOutput.candidates)).toBe(true);
			const candidates = jsonOutput.candidates as Array<{ title: string }>;
			expect(candidates).toHaveLength(2);
		});
	});

	describe("markdown interactive mode", () => {
		test("shows preview with file paths", async () => {
			setupAreaFolder(vault, "Health");
			createInboxNote(vault, "test.md", {
				title: "Test Note",
				area: "[[Health]]",
			});

			mockConfirm.mockResolvedValue(false); // Cancel

			const ctx = createCommandContext({ isJson: false });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const output = logs.join("\n");
			expect(output).toContain("Found 1 note(s) ready to move");
			expect(output).toContain("Test Note");
			expect(output).toContain("00 Inbox/test.md");
			expect(output).toContain("02 Areas/Health");
		});

		test("shows colocate warning icon when folder needs creation", async () => {
			writeVaultFile(vault, "02 Areas/Fitness.md", "# Fitness");
			writeVaultFile(
				vault,
				"00 Inbox/workout.md",
				`---
title: "Workout"
area: "[[Fitness]]"
---`,
			);

			mockConfirm.mockResolvedValue(false);

			const ctx = createCommandContext({ isJson: false });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const output = logs.join("\n").toLowerCase();
			expect(output).toMatch(/will create folder/i);
		});

		test("exits when user cancels confirmation", async () => {
			setupAreaFolder(vault, "Health");
			createInboxNote(vault, "test.md", {
				title: "Test",
				area: "[[Health]]",
			});

			mockConfirm.mockResolvedValue(false);

			const ctx = createCommandContext({ isJson: false });

			const result = await handleInboxMove(ctx);

			expect(result.success).toBe(true);
			expect(mockEndSession).toHaveBeenCalledWith({ success: true });
			// File should NOT be moved
			expect(vaultFileExists(vault, "00 Inbox/test.md")).toBe(true);
		});
	});

	describe("move execution", () => {
		test("successfully moves note to area", async () => {
			setupAreaFolder(vault, "Health");
			createInboxNote(
				vault,
				"medical.md",
				{
					title: "Medical Record",
					area: "[[Health]]",
					type: "document",
				},
				"# Content",
			);

			mockConfirm.mockResolvedValue(true);

			const ctx = createCommandContext({ isJson: false });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const output = logs.join("\n");
			expect(output).toContain("✓ Moved:");
			expect(output).toContain("Done. Moved 1/1 notes");

			// Verify file moved
			expect(vaultFileExists(vault, "00 Inbox/medical.md")).toBe(false);
			expect(vaultFileExists(vault, "02 Areas/Health/Medical Record.md")).toBe(
				true,
			);
		});

		test("successfully moves note to project", async () => {
			setupProjectFolder(vault, "Project Alpha");
			createInboxNote(vault, "task.md", {
				title: "Task Note",
				project: "[[Project Alpha]]",
			});

			mockConfirm.mockResolvedValue(true);

			const ctx = createCommandContext({ isJson: false });

			await handleInboxMove(ctx);

			expect(vaultFileExists(vault, "00 Inbox/task.md")).toBe(false);
			expect(
				vaultFileExists(vault, "01 Projects/Project Alpha/Task Note.md"),
			).toBe(true);
		});

		test("handles colocate by creating folder and moving area note", async () => {
			// Create area as FILE (triggers colocate)
			writeVaultFile(
				vault,
				"02 Areas/Fitness.md",
				`---
title: "Fitness"
---
# Fitness Area
`,
			);
			writeVaultFile(
				vault,
				"00 Inbox/workout.md",
				`---
title: "Workout Log"
area: "[[Fitness]]"
---`,
			);

			mockConfirm.mockResolvedValue(true);

			const ctx = createCommandContext({ isJson: false });

			await handleInboxMove(ctx);

			// Original area file should be gone
			expect(vaultFileExists(vault, "02 Areas/Fitness.md")).toBe(false);
			// Folder should exist with area note inside
			expect(vaultFileExists(vault, "02 Areas/Fitness/Fitness.md")).toBe(true);
			// Inbox note should be moved into folder
			expect(vaultFileExists(vault, "02 Areas/Fitness/Workout Log.md")).toBe(
				true,
			);
		});

		test("handles filename collision by appending number", async () => {
			setupAreaFolder(vault, "Health");
			// Create existing file with same title
			writeVaultFile(vault, "02 Areas/Health/Note.md", "# Existing");

			createInboxNote(
				vault,
				"note.md",
				{ title: "Note", area: "[[Health]]" },
				"# New note",
			);

			mockConfirm.mockResolvedValue(true);

			const ctx = createCommandContext({ isJson: false });

			await handleInboxMove(ctx);

			// Original should remain
			expect(vaultFileExists(vault, "02 Areas/Health/Note.md")).toBe(true);
			// New one should have number suffix
			expect(vaultFileExists(vault, "02 Areas/Health/Note 1.md")).toBe(true);
		});

		test("uses title as filename (already safe characters)", async () => {
			setupAreaFolder(vault, "Health");
			createInboxNote(vault, "safe-title.md", {
				title: "Note-With-Safe-Chars",
				area: "[[Health]]",
			});

			mockConfirm.mockResolvedValue(true);

			const ctx = createCommandContext({ isJson: false });

			await handleInboxMove(ctx);

			// File should be moved with title as filename
			expect(
				vaultFileExists(vault, "02 Areas/Health/Note-With-Safe-Chars.md"),
			).toBe(true);
			// Verify source file was removed
			expect(vaultFileExists(vault, "00 Inbox/safe-title.md")).toBe(false);
		});

		test("reports partial success when some moves fail", async () => {
			setupAreaFolder(vault, "Health");
			// Valid note
			createInboxNote(vault, "valid.md", {
				title: "Valid",
				area: "[[Health]]",
			});
			// Invalid note (missing destination - will be skipped by scanner)
			createInboxNote(vault, "invalid.md", {
				title: "Invalid",
				area: "[[NonExistent]]",
			});

			mockConfirm.mockResolvedValue(true);

			const ctx = createCommandContext({ isJson: false });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const output = logs.join("\n");
			// Only valid note should be moved (invalid skipped during scan)
			expect(output).toContain("Done. Moved 1/1 notes");
		});

		test("processes multiple notes sequentially", async () => {
			setupAreaFolder(vault, "Health");
			setupAreaFolder(vault, "Finance");

			createInboxNote(vault, "note1.md", {
				title: "Health Note",
				area: "[[Health]]",
			});
			createInboxNote(vault, "note2.md", {
				title: "Finance Note",
				area: "[[Finance]]",
			});

			mockConfirm.mockResolvedValue(true);

			const ctx = createCommandContext({ isJson: false });

			const result = await handleInboxMove(ctx);

			expect(result.success).toBe(true);

			expect(vaultFileExists(vault, "02 Areas/Health/Health Note.md")).toBe(
				true,
			);
			expect(vaultFileExists(vault, "02 Areas/Finance/Finance Note.md")).toBe(
				true,
			);
		});
	});

	describe("observability", () => {
		test("creates session with correlation ID", async () => {
			writeVaultFile(vault, "00 Inbox/.gitkeep", "");

			const ctx = createCommandContext({ isJson: false });

			await handleInboxMove(ctx);

			expect(mockStartSession).toHaveBeenCalledWith("para move", {
				silent: false,
			});
		});

		test("passes silent flag in JSON mode", async () => {
			writeVaultFile(vault, "00 Inbox/.gitkeep", "");

			const ctx = createCommandContext({ isJson: true });

			await handleInboxMove(ctx);

			expect(mockStartSession).toHaveBeenCalledWith("para move", {
				silent: true,
			});
		});

		test("ends session on completion", async () => {
			writeVaultFile(vault, "00 Inbox/.gitkeep", "");

			const ctx = createCommandContext({ isJson: false });

			await handleInboxMove(ctx);

			expect(mockEndSession).toHaveBeenCalledWith({ success: true });
		});

		test("ends session on cancellation", async () => {
			writeVaultFile(vault, "02 Areas/Health/Health.md", "# Health");
			writeVaultFile(
				vault,
				"00 Inbox/test.md",
				`---
title: "Test"
area: "[[Health]]"
---`,
			);

			mockConfirm.mockResolvedValue(false);

			const ctx = createCommandContext({ isJson: false });

			await handleInboxMove(ctx);

			expect(mockEndSession).toHaveBeenCalledWith({ success: true });
		});
	});

	describe("frontmatter handling", () => {
		test("handles array values for area field (uses first element)", async () => {
			setupAreaFolder(vault, "Health");
			createInboxNote(vault, "test.md", {
				title: "Test",
				area: ["[[Health]]", "[[Fitness]]"],
			});

			mockConfirm.mockResolvedValue(true);

			const ctx = createCommandContext({ isJson: false });

			await handleInboxMove(ctx);

			expect(vaultFileExists(vault, "02 Areas/Health/Test.md")).toBe(true);
		});

		test("handles array values for project field (uses first element)", async () => {
			setupProjectFolder(vault, "Project A");
			createInboxNote(vault, "test.md", {
				title: "Test",
				project: ["[[Project A]]", "[[Project B]]"],
			});

			mockConfirm.mockResolvedValue(true);

			const ctx = createCommandContext({ isJson: false });

			await handleInboxMove(ctx);

			expect(vaultFileExists(vault, "01 Projects/Project A/Test.md")).toBe(
				true,
			);
		});

		test("prioritizes project over area when both present", async () => {
			setupProjectFolder(vault, "Project A");
			setupAreaFolder(vault, "Health");
			createInboxNote(vault, "test.md", {
				title: "Test",
				area: "[[Health]]",
				project: "[[Project A]]",
			});

			mockConfirm.mockResolvedValue(true);

			const ctx = createCommandContext({ isJson: false });

			await handleInboxMove(ctx);

			// Should go to project, not area
			expect(vaultFileExists(vault, "01 Projects/Project A/Test.md")).toBe(
				true,
			);
			expect(vaultFileExists(vault, "02 Areas/Health/Test.md")).toBe(false);
		});
	});

	describe("path traversal prevention", () => {
		test("scanner rejects paths with .. components", async () => {
			// Scanner reads files from disk, so we need valid frontmatter
			// But the resolver should prevent escaping vault boundaries
			writeVaultFile(
				vault,
				"00 Inbox/malicious.md",
				`---
title: "Malicious"
area: "[[../../etc/passwd]]"
---`,
			);

			const ctx = createCommandContext({ isJson: true });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			// Should have no candidates (destination won't resolve)
			expect(jsonOutput.success).toBe(true);
			const count = jsonOutput.moved ?? jsonOutput.count ?? 0;
			expect(count).toBe(0);
		});

		test("scanner rejects paths with slashes", async () => {
			writeVaultFile(
				vault,
				"00 Inbox/malicious2.md",
				`---
title: "Malicious"
area: "[[Health/../../etc]]"
---`,
			);

			const ctx = createCommandContext({ isJson: true });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.success).toBe(true);
			const count = jsonOutput.moved ?? jsonOutput.count ?? 0;
			expect(count).toBe(0);
		});
	});

	describe("error handling", () => {
		test("handles invalid frontmatter gracefully", async () => {
			writeVaultFile(
				vault,
				"00 Inbox/invalid.md",
				`---
invalid yaml: [
---`,
			);

			const ctx = createCommandContext({ isJson: true });

			// Should not crash
			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.success).toBe(true);
			expect(jsonOutput.moved).toBe(0);
		});

		test("handles missing inbox folder gracefully", async () => {
			// Don't create inbox folder
			const ctx = createCommandContext({ isJson: true });

			// Should not crash, but should return error
			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.success).toBe(false);
			expect(jsonOutput.error).toBe("Inbox folder '00 Inbox' not found");
		});
	});

	describe("edge cases", () => {
		test("handles notes with very long titles", async () => {
			setupAreaFolder(vault, "Health");
			const longTitle = "A".repeat(300); // Exceeds 200 char limit
			createInboxNote(vault, "long.md", {
				title: longTitle,
				area: "[[Health]]",
			});

			mockConfirm.mockResolvedValue(true);

			const ctx = createCommandContext({ isJson: false });

			await handleInboxMove(ctx);

			// Should truncate to 200 chars
			const truncated = longTitle.slice(0, 200);
			expect(vaultFileExists(vault, `02 Areas/Health/${truncated}.md`)).toBe(
				true,
			);
		});

		test("handles notes with unicode characters in title", async () => {
			setupAreaFolder(vault, "Health");
			createInboxNote(vault, "unicode.md", {
				title: "健康筆記 🏥",
				area: "[[Health]]",
			});

			mockConfirm.mockResolvedValue(true);

			const ctx = createCommandContext({ isJson: false });

			await handleInboxMove(ctx);

			expect(vaultFileExists(vault, "02 Areas/Health/健康筆記 🏥.md")).toBe(
				true,
			);
		});

		test("handles empty inbox folder (only .gitkeep)", async () => {
			writeVaultFile(vault, "00 Inbox/.gitkeep", "");

			const ctx = createCommandContext({ isJson: false });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const output = logs.join("\n");
			expect(output).toContain("No notes ready to move");
		});

		test("handles inbox with only non-markdown files", async () => {
			writeVaultFile(vault, "00 Inbox/image.png", "fake-image-data");
			writeVaultFile(vault, "00 Inbox/document.pdf", "fake-pdf-data");

			const ctx = createCommandContext({ isJson: true });

			const logs = await captureConsoleOutputAsync(async () => {
				await handleInboxMove(ctx);
			});

			const jsonOutput = findJsonOutput(logs) as Record<string, unknown>;
			expect(jsonOutput.success).toBe(true);
			const count = jsonOutput.moved ?? jsonOutput.count ?? 0;
			expect(count).toBe(0);
		});
	});
});
