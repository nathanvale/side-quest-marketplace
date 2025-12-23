/**
 * Tests for routing executor
 *
 * Tests file move operations with atomic operations and security checks.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	createTestVault,
	useTestVaultCleanup,
	vaultFileExists,
	writeVaultFile,
} from "../../testing/utils";
import { moveNote } from "./executor";
import type { RoutingCandidate, RoutingResult } from "./types";

// ─── Test Helpers ───────────────────────────────────────────────────────────

interface BasicScenario {
	inboxPath: string;
	destPath: string;
	filename: string;
	content: string;
	colocate?: {
		readonly sourceNotePath: string;
		readonly folderPath: string;
	};
}

/**
 * Sets up a basic test scenario with inbox and destination folders
 * @returns RoutingCandidate ready for moveNote
 */
function setupBasicScenario(
	vaultPath: string,
	scenario: BasicScenario,
): RoutingCandidate {
	const { inboxPath, destPath, filename, content, colocate } = scenario;

	// Create folders
	mkdirSync(join(vaultPath, inboxPath), { recursive: true });
	mkdirSync(join(vaultPath, destPath), { recursive: true });

	// Write file
	const filePath = `${inboxPath}/${filename}`;
	writeVaultFile(vaultPath, filePath, content);

	// Extract title from frontmatter or use filename
	const titleMatch = content.match(/^title:\s*(.+)$/m);
	const title = titleMatch?.[1]?.trim() || filename.replace(".md", "");

	// Extract area/project from frontmatter
	const areaMatch = content.match(/^area:\s*(.+)$/m);
	const projectMatch = content.match(/^project:\s*(.+)$/m);

	return {
		path: filePath,
		title,
		...(areaMatch?.[1] && { area: areaMatch[1].trim() }),
		...(projectMatch?.[1] && { project: projectMatch[1].trim() }),
		destination: destPath,
		...(colocate && { colocate }),
	};
}

/**
 * Asserts a successful move operation
 */
function expectSuccessfulMove(
	result: RoutingResult,
	vaultPath: string,
	expectedTo: string,
	originalFrom: string,
): void {
	expect(result.success).toBe(true);
	expect(result.movedFrom).toBe(originalFrom);
	expect(result.movedTo).toBe(expectedTo);
	expect(vaultFileExists(vaultPath, expectedTo)).toBe(true);
	expect(vaultFileExists(vaultPath, originalFrom)).toBe(false);
}

/**
 * Asserts a failed move operation with error pattern
 */
function expectFailedMove(
	result: RoutingResult,
	errorPattern: string | RegExp,
): void {
	expect(result.success).toBe(false);
	expect(result.error).toBeDefined();

	if (typeof errorPattern === "string") {
		expect(result.error).toContain(errorPattern);
	} else {
		expect(result.error).toMatch(errorPattern);
	}
}

/**
 * Ensures filesystem timing is safe for collision tests
 * Adds a small delay to prevent same-millisecond collisions
 */
async function ensureFilesystemTiming(): Promise<void> {
	await Bun.sleep(10); // 10ms buffer for filesystem timestamp resolution
}

describe("inbox/routing/executor", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	let vaultPath: string;

	beforeEach(() => {
		vaultPath = createTestVault();
		trackVault(vaultPath);
	});

	afterEach(getAfterEachHook());

	describe("moveNote", () => {
		describe("basic move operations", () => {
			test("moves note from inbox to area folder", async () => {
				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "02 Areas/Health",
					filename: "Medical Report.md",
					content: `---
title: Medical Report
area: Health
---

Content.
`,
				});

				const result = await moveNote(candidate, vaultPath);

				expectSuccessfulMove(
					result,
					vaultPath,
					"02 Areas/Health/Medical Report.md",
					"00 Inbox/Medical Report.md",
				);
			});

			test("moves note from inbox to project folder", async () => {
				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "01 Projects/Alpha",
					filename: "Task.md",
					content: `---
title: Project Task
project: Alpha
---

Task details.
`,
				});

				const result = await moveNote(candidate, vaultPath);

				expectSuccessfulMove(
					result,
					vaultPath,
					"01 Projects/Alpha/Project Task.md",
					"00 Inbox/Task.md",
				);
			});

			test("renames file to match title during move", async () => {
				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "02 Areas/Health",
					filename: "temp-file-123.md",
					content: `---
title: Proper Title
area: Health
---

Content.
`,
				});

				const result = await moveNote(candidate, vaultPath);

				expect(result.success).toBe(true);
				expect(result.movedTo).toBe("02 Areas/Health/Proper Title.md");
				expect(
					vaultFileExists(vaultPath, "02 Areas/Health/Proper Title.md"),
				).toBe(true);
			});
		});

		describe("filename sanitization", () => {
			test("sanitizes unsafe characters in filename", async () => {
				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "02 Areas/Health",
					filename: "Note.md",
					content: `---
title: File/With\\Bad:Chars?
area: Health
---
`,
				});

				const result = await moveNote(candidate, vaultPath);

				expect(result.success).toBe(true);
				expect(result.movedTo).toBe("02 Areas/Health/File-With-Bad-Chars-.md");
				expect(
					vaultFileExists(vaultPath, "02 Areas/Health/File-With-Bad-Chars-.md"),
				).toBe(true);
			});

			test("normalizes whitespace in filename", async () => {
				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "02 Areas/Health",
					filename: "Note.md",
					content: `---\ntitle: "  Too   Much   Space  "\n---\n`,
				});

				const result = await moveNote(candidate, vaultPath);

				expect(result.success).toBe(true);
				// The executor's sanitization converts leading/trailing spaces to dashes
				expect(result.movedTo).toBe("02 Areas/Health/- Too Much Space -.md");
			});

			test("limits filename length", async () => {
				const longTitle = "A".repeat(250);
				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "02 Areas/Health",
					filename: "Note.md",
					content: `---\ntitle: "${longTitle}"\n---\n`,
				});

				const result = await moveNote(candidate, vaultPath);

				expect(result.success).toBe(true);
				// Filename should be truncated to 200 chars + .md extension
				const filename = result.movedTo.split("/").pop() ?? "";
				expect(filename.length).toBeLessThanOrEqual(204); // 200 + ".md"
			});
		});

		describe("collision handling", () => {
			test("appends number when destination file exists", async () => {
				mkdirSync(join(vaultPath, "00 Inbox"), { recursive: true });
				mkdirSync(join(vaultPath, "02 Areas/Health"), { recursive: true });

				// Create existing file
				writeVaultFile(
					vaultPath,
					"02 Areas/Health/Medical Report.md",
					"Existing content",
				);

				await ensureFilesystemTiming();

				// Create inbox file with same title
				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "02 Areas/Health",
					filename: "Report.md",
					content: `---
title: Medical Report
area: Health
---

New content.
`,
				});

				const result = await moveNote(candidate, vaultPath);

				expect(result.success).toBe(true);
				expect(result.movedTo).toBe("02 Areas/Health/Medical Report 1.md");
				expect(
					vaultFileExists(vaultPath, "02 Areas/Health/Medical Report.md"),
				).toBe(true);
				expect(
					vaultFileExists(vaultPath, "02 Areas/Health/Medical Report 1.md"),
				).toBe(true);
			});

			test("increments number for multiple collisions", async () => {
				mkdirSync(join(vaultPath, "00 Inbox"), { recursive: true });
				mkdirSync(join(vaultPath, "02 Areas/Health"), { recursive: true });

				// Create existing files
				writeVaultFile(vaultPath, "02 Areas/Health/Report.md", "v1");
				await ensureFilesystemTiming();
				writeVaultFile(vaultPath, "02 Areas/Health/Report 1.md", "v2");
				await ensureFilesystemTiming();
				writeVaultFile(vaultPath, "02 Areas/Health/Report 2.md", "v3");
				await ensureFilesystemTiming();

				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "02 Areas/Health",
					filename: "Report.md",
					content: `---\ntitle: Report\n---\n`,
				});

				const result = await moveNote(candidate, vaultPath);

				expect(result.success).toBe(true);
				expect(result.movedTo).toBe("02 Areas/Health/Report 3.md");
			});
		});

		describe("colocate handling", () => {
			test("creates folder and moves area note when colocate required", async () => {
				mkdirSync(join(vaultPath, "00 Inbox"), { recursive: true });
				mkdirSync(join(vaultPath, "02 Areas"), { recursive: true });

				// Create area as standalone file
				writeVaultFile(
					vaultPath,
					"02 Areas/Career.md",
					"---\ntitle: Career\n---\n",
				);

				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "02 Areas/Career",
					filename: "Contract.md",
					content: `---
title: Contract Note
area: Career
---
`,
					colocate: {
						sourceNotePath: "02 Areas/Career.md",
						folderPath: "02 Areas/Career",
					},
				});

				const result = await moveNote(candidate, vaultPath);

				expect(result.success).toBe(true);
				expect(vaultFileExists(vaultPath, "02 Areas/Career/Career.md")).toBe(
					true,
				);
				expect(
					vaultFileExists(vaultPath, "02 Areas/Career/Contract Note.md"),
				).toBe(true);
				expect(vaultFileExists(vaultPath, "02 Areas/Career.md")).toBe(false);
				expect(vaultFileExists(vaultPath, "00 Inbox/Contract.md")).toBe(false);
			});

			test("creates folder and moves project note when colocate required", async () => {
				mkdirSync(join(vaultPath, "00 Inbox"), { recursive: true });
				mkdirSync(join(vaultPath, "01 Projects"), { recursive: true });

				// Create project as standalone file
				writeVaultFile(
					vaultPath,
					"01 Projects/Alpha.md",
					"---\ntitle: Alpha\n---\n",
				);

				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "01 Projects/Alpha",
					filename: "Task.md",
					content: `---
title: Task One
project: Alpha
---
`,
					colocate: {
						sourceNotePath: "01 Projects/Alpha.md",
						folderPath: "01 Projects/Alpha",
					},
				});

				const result = await moveNote(candidate, vaultPath);

				expect(result.success).toBe(true);
				expect(vaultFileExists(vaultPath, "01 Projects/Alpha/Alpha.md")).toBe(
					true,
				);
				expect(
					vaultFileExists(vaultPath, "01 Projects/Alpha/Task One.md"),
				).toBe(true);
				expect(vaultFileExists(vaultPath, "01 Projects/Alpha.md")).toBe(false);
			});

			test("fails when area note is missing during colocate", async () => {
				mkdirSync(join(vaultPath, "00 Inbox"), { recursive: true });
				mkdirSync(join(vaultPath, "02 Areas"), { recursive: true });

				// Create the inbox file
				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					`---
title: Note
area: Career
---
`,
				);

				const candidate: RoutingCandidate = {
					path: "00 Inbox/Note.md",
					title: "Note",
					area: "Career",
					destination: "02 Areas/Career",
					colocate: {
						sourceNotePath: "02 Areas/Career.md",
						folderPath: "02 Areas/Career",
					},
				};

				const result = await moveNote(candidate, vaultPath);

				// Can fail with ENOENT or path validation error depending on existence check order
				expectFailedMove(
					result,
					/ENOENT|not found|does not exist|path escapes vault/i,
				);
			});
		});

		describe("security and validation", () => {
			test("prevents path traversal in source path", async () => {
				mkdirSync(join(vaultPath, "00 Inbox"), { recursive: true });
				mkdirSync(join(vaultPath, "02 Areas/Health"), { recursive: true });

				const candidate: RoutingCandidate = {
					path: "../../etc/passwd",
					title: "Malicious",
					area: "Health",
					destination: "02 Areas/Health",
				};

				const result = await moveNote(candidate, vaultPath);

				expectFailedMove(result, "path escapes vault");
			});

			test("prevents path traversal in destination path", async () => {
				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "../../etc",
					filename: "Note.md",
					content: "content",
				});

				const result = await moveNote(candidate, vaultPath);

				expectFailedMove(result, "path escapes vault");
			});

			test("validates colocate source path stays in vault", async () => {
				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "02 Areas/Health",
					filename: "Note.md",
					content: "content",
					colocate: {
						sourceNotePath: "../../etc/passwd",
						folderPath: "02 Areas/Health",
					},
				});

				const result = await moveNote(candidate, vaultPath);

				expectFailedMove(result, "path escapes vault");
			});
		});

		describe("error handling", () => {
			test("returns error when source file does not exist", async () => {
				mkdirSync(join(vaultPath, "00 Inbox"), { recursive: true });
				mkdirSync(join(vaultPath, "02 Areas/Health"), { recursive: true });

				const candidate: RoutingCandidate = {
					path: "00 Inbox/Nonexistent.md",
					title: "Nonexistent",
					area: "Health",
					destination: "02 Areas/Health",
				};

				const result = await moveNote(candidate, vaultPath);

				// Can fail with ENOENT or path validation error depending on existence check order
				expectFailedMove(
					result,
					/ENOENT|not found|does not exist|path escapes vault/i,
				);
			});

			test("fails when destination parent directory does not exist", async () => {
				// Setup creates file but we'll use a different candidate that references non-existent parent
				setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "02 Areas/NewArea",
					filename: "Note.md",
					content: `---\ntitle: Note\n---\n`,
				});

				// Don't create "02 Areas" parent directory - setupBasicScenario created it
				// We need to manually create a scenario where parent doesn't exist
				const candidate: RoutingCandidate = {
					path: "00 Inbox/Note.md",
					title: "Note",
					area: "NewArea",
					destination: "99 NonExistent/NewArea",
				};

				const result = await moveNote(candidate, vaultPath);

				expectFailedMove(result, /ENOENT|not found|does not exist/i);
			});
		});

		describe("correlation context", () => {
			test("accepts correlation context", async () => {
				const candidate = setupBasicScenario(vaultPath, {
					inboxPath: "00 Inbox",
					destPath: "02 Areas/Health",
					filename: "Note.md",
					content: `---\ntitle: Note\n---\n`,
				});

				const ctx = {
					sessionCid: "test-session-123",
					parentCid: "test-parent-456",
				};

				const result = await moveNote(candidate, vaultPath, ctx);

				expect(result.success).toBe(true);
			});
		});
	});
});
