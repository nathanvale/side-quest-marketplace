/**
 * Tests for inbox scanner
 *
 * Tests file discovery and routing candidate extraction from inbox.
 */

import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
	createTestVault,
	useTestVaultCleanup,
	writeVaultFile,
} from "../../testing/utils";
import { scanForRoutableNotes } from "./scanner";
import type { RoutingScanResult } from "./types";

// =============================================================================
// Mock globFiles to avoid Bun.Glob issues in test environment
// =============================================================================

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

	// Recursive implementation that finds .md files in directory and subdirectories
	const findMdFiles = (currentDir: string): string[] => {
		try {
			const files: string[] = [];
			const entries = readdirSync(currentDir, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isFile() && entry.name.endsWith(".md")) {
					// Return ABSOLUTE paths (matches real globFiles default behavior)
					files.push(join(currentDir, entry.name));
				} else if (entry.isDirectory()) {
					files.push(...findMdFiles(join(currentDir, entry.name)));
				}
			}
			return files;
		} catch {
			return [];
		}
	};
	return findMdFiles(cwd);
};

mock.module("@sidequest/core/glob", () => ({
	globFiles: mockGlobFiles,
}));

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Frontmatter templates to reduce duplication
 */
const FRONTMATTER = {
	withArea: (title: string, area: string) => `---
title: ${title}
type: document
area: ${area}
---

Content here.
`,
	withProject: (title: string, project: string) => `---
title: ${title}
type: task
project: ${project}
---

Task details.
`,
	withBoth: (title: string, project: string, area: string) => `---
title: ${title}
project: ${project}
area: ${area}
---

Content.
`,
	withWikilink: (title: string, area: string) => `---
title: ${title}
area: "[[${area}]]"
---

Content.
`,
	noTitle: (area: string) => `---
area: ${area}
---

Content.
`,
	noRouting: (title: string) => `---
title: ${title}
type: document
---

Content.
`,
	arrayArea: (title: string, areas: string[]) => `---
title: ${title}
area:
  - ${areas.join("\n  - ")}
---

Content.
`,
	arrayProject: (title: string, projects: string[]) => `---
title: ${title}
project:
  - ${projects.join("\n  - ")}
---

Content.
`,
	empty: () => `---
---

Content.
`,
};

/**
 * Setup inbox folder and any PARA folders needed
 */
function setupInboxWithFolders(vaultPath: string, folders: string[]): void {
	mkdirSync(join(vaultPath, "00 Inbox"), { recursive: true });
	for (const folder of folders) {
		mkdirSync(join(vaultPath, folder), { recursive: true });
	}
}

/**
 * Assert on scan result structure
 */
function expectScanResult(
	result: RoutingScanResult,
	expectedCandidates: number,
	expectedSkipped: number,
): void {
	expect(result.candidates).toHaveLength(expectedCandidates);
	expect(result.skipped).toHaveLength(expectedSkipped);
}

describe("inbox/routing/scanner", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	let vaultPath: string;

	afterEach(getAfterEachHook());

	afterAll(() => {
		mock.restore();
	});

	/**
	 * Helper function to reduce DRY violations in test setup
	 * Creates test vault and optionally sets up inbox with PARA folders
	 */
	function setupTest(folders: string[] = []): string {
		const vault = createTestVault();
		trackVault(vault);
		if (folders.length > 0) {
			setupInboxWithFolders(vault, folders);
		} else {
			// Still create inbox folder even when no PARA folders specified
			mkdirSync(join(vault, "00 Inbox"), { recursive: true });
		}
		return vault;
	}

	describe("scanForRoutableNotes", () => {
		describe("basic scanning", () => {
			test("returns empty arrays when inbox is empty", async () => {
				vaultPath = setupTest();

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 0);
			});

			test("finds note with area field", async () => {
				vaultPath = setupTest(["02 Areas/Health"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					FRONTMATTER.withArea("Medical Report", "Health"),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 1, 0);
				const candidate = result.candidates[0];
				expect(candidate).toBeDefined();
				expect(candidate).toMatchObject({
					path: "00 Inbox/Note.md",
					title: "Medical Report",
					type: "document",
					area: "Health",
					destination: "02 Areas/Health",
				});
				expect(candidate?.colocate).toBeUndefined();
			});

			test("finds note with project field", async () => {
				vaultPath = setupTest(["01 Projects/Alpha"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Task.md",
					FRONTMATTER.withProject("Project Task", "Alpha"),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 1, 0);
				const candidate = result.candidates[0];
				expect(candidate).toBeDefined();
				expect(candidate).toMatchObject({
					path: "00 Inbox/Task.md",
					title: "Project Task",
					type: "task",
					project: "Alpha",
					destination: "01 Projects/Alpha",
				});
			});

			test("prioritizes project over area", async () => {
				vaultPath = setupTest(["01 Projects/Alpha", "02 Areas/Health"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					FRONTMATTER.withBoth("Hybrid Note", "Alpha", "Health"),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 1, 0);
				expect(result.candidates[0]?.destination).toBe("01 Projects/Alpha");
				expect(result.candidates[0]?.project).toBe("Alpha");
			});

			test("handles wikilink format in frontmatter", async () => {
				vaultPath = setupTest(["02 Areas/Health"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					FRONTMATTER.withWikilink("Medical Note", "Health"),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 1, 0);
				// Scanner preserves raw value, resolver strips wikilink
				expect(result.candidates[0]?.area).toBe("[[Health]]");
				expect(result.candidates[0]?.destination).toBe("02 Areas/Health");
			});
		});

		describe("array field handling", () => {
			test("takes first element when area is array", async () => {
				vaultPath = setupTest(["02 Areas/Health"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					FRONTMATTER.arrayArea("Multi-Area Note", ["Health", "Finance"]),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 1, 0);
				expect(result.candidates[0]?.area).toBe("Health");
			});

			test("takes first element when project is array", async () => {
				vaultPath = setupTest(["01 Projects/Alpha"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					FRONTMATTER.arrayProject("Multi-Project Note", ["Alpha", "Beta"]),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 1, 0);
				expect(result.candidates[0]?.project).toBe("Alpha");
			});
		});

		describe("colocate detection", () => {
			test("detects when area is a file and needs colocate", async () => {
				vaultPath = setupTest(["02 Areas"]);

				writeVaultFile(
					vaultPath,
					"02 Areas/Career & Contracting.md",
					"---\ntitle: Career\n---\n",
				);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					FRONTMATTER.withArea("Contract Note", "Career & Contracting"),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 1, 0);
				expect(result.candidates[0]?.colocate).toEqual({
					sourceNotePath: "02 Areas/Career & Contracting.md",
					folderPath: "02 Areas/Career & Contracting",
				});
			});

			test("detects when project is a file and needs colocate", async () => {
				vaultPath = setupTest(["01 Projects"]);

				writeVaultFile(
					vaultPath,
					"01 Projects/Alpha.md",
					"---\ntitle: Alpha\n---\n",
				);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					FRONTMATTER.withProject("Project Note", "Alpha"),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 1, 0);
				expect(result.candidates[0]?.colocate).toEqual({
					sourceNotePath: "01 Projects/Alpha.md",
					folderPath: "01 Projects/Alpha",
				});
			});
		});

		describe("skipped items", () => {
			test("skips notes without title", async () => {
				vaultPath = setupTest(["02 Areas/Health"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/NoTitle.md",
					FRONTMATTER.noTitle("Health"),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 1);
				expect(result.skipped[0]).toMatchObject({
					path: "00 Inbox/NoTitle.md",
					reason: "Missing title in frontmatter",
				});
			});

			test("skips notes without area or project", async () => {
				vaultPath = setupTest();

				writeVaultFile(
					vaultPath,
					"00 Inbox/NoRouting.md",
					FRONTMATTER.noRouting("Unroutable Note"),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 1);
				expect(result.skipped[0]).toMatchObject({
					path: "00 Inbox/NoRouting.md",
					reason: "Missing area or project in frontmatter",
				});
			});

			test("skips notes when destination does not exist", async () => {
				vaultPath = setupTest();
				// Don't create the Health area folder

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					FRONTMATTER.withArea("Medical Note", "Health"),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 1);
				expect(result.skipped[0]).toMatchObject({
					path: "00 Inbox/Note.md",
					reason: "Destination folder does not exist",
				});
			});

			test("skips notes with parse errors", async () => {
				vaultPath = setupTest();

				writeVaultFile(
					vaultPath,
					"00 Inbox/Invalid.md",
					`---
title: Test
area: [invalid yaml here
---

Content.
`,
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 1);
				expect(result.skipped[0]?.path).toBe("00 Inbox/Invalid.md");
				expect(result.skipped[0]?.reason).toContain("Parse error:");
			});
		});

		describe("multiple files", () => {
			test("processes multiple valid files", async () => {
				vaultPath = setupTest(["01 Projects/Alpha", "02 Areas/Health"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note1.md",
					FRONTMATTER.withArea("Note One", "Health"),
				);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note2.md",
					FRONTMATTER.withProject("Note Two", "Alpha"),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 2, 0);
				expect(result.candidates[0]?.title).toBe("Note One");
				expect(result.candidates[1]?.title).toBe("Note Two");
			});

			test("handles mix of valid and skipped files", async () => {
				vaultPath = setupTest(["02 Areas/Health"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Valid.md",
					FRONTMATTER.withArea("Valid Note", "Health"),
				);

				writeVaultFile(
					vaultPath,
					"00 Inbox/NoTitle.md",
					FRONTMATTER.noTitle("Health"),
				);

				writeVaultFile(
					vaultPath,
					"00 Inbox/NoRouting.md",
					FRONTMATTER.noRouting("No Routing"),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 1, 2);
			});
		});

		describe("custom inbox folder", () => {
			test("scans custom inbox folder", async () => {
				vaultPath = createTestVault();
				trackVault(vaultPath);
				mkdirSync(join(vaultPath, "Inbox"), { recursive: true });
				mkdirSync(join(vaultPath, "02 Areas/Health"), { recursive: true });

				writeVaultFile(
					vaultPath,
					"Inbox/Note.md",
					FRONTMATTER.withArea("Custom Inbox Note", "Health"),
				);

				const result = await scanForRoutableNotes(vaultPath, "Inbox");

				expectScanResult(result, 1, 0);
				expect(result.candidates[0]?.path).toBe("Inbox/Note.md");
			});
		});

		describe("nested files in inbox", () => {
			test("finds notes in subdirectories", async () => {
				vaultPath = createTestVault();
				trackVault(vaultPath);
				// Custom setup needed - creating subdirectory within inbox
				mkdirSync(join(vaultPath, "00 Inbox/subfolder"), { recursive: true });
				mkdirSync(join(vaultPath, "02 Areas/Health"), { recursive: true });

				writeVaultFile(
					vaultPath,
					"00 Inbox/subfolder/Note.md",
					FRONTMATTER.withArea("Nested Note", "Health"),
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 1, 0);
				expect(result.candidates[0]?.path).toBe("00 Inbox/subfolder/Note.md");
			});
		});

		describe("correlation context", () => {
			test("accepts correlation context", async () => {
				vaultPath = setupTest();

				const ctx = {
					sessionCid: "test-session-123",
					parentCid: "test-parent-456",
				};

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox", ctx);

				// Should not throw and return valid result
				expect(result).toBeDefined();
				expectScanResult(result, 0, 0);
			});
		});

		describe("edge cases", () => {
			test("handles inbox folder that does not exist", async () => {
				vaultPath = createTestVault();
				trackVault(vaultPath);
				// Don't create inbox folder - testing edge case

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 0);
			});

			test("handles non-markdown files in inbox", async () => {
				vaultPath = setupTest();

				writeVaultFile(vaultPath, "00 Inbox/file.txt", "Not a markdown file");
				writeVaultFile(vaultPath, "00 Inbox/file.pdf", "Binary content");

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				// Should only scan .md files
				expectScanResult(result, 0, 0);
			});

			test("handles empty frontmatter", async () => {
				vaultPath = setupTest();

				writeVaultFile(vaultPath, "00 Inbox/Empty.md", FRONTMATTER.empty());

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 1);
			});

			test("handles markdown without frontmatter", async () => {
				vaultPath = setupTest();

				writeVaultFile(
					vaultPath,
					"00 Inbox/NoFrontmatter.md",
					`# Just content

No frontmatter here.
`,
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 1);
			});
		});

		describe("type validation for frontmatter fields", () => {
			test("skips notes when area is empty array", async () => {
				vaultPath = setupTest(["02 Areas/Health"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					`---
title: "Empty Array Area"
area: []
---

Content.
`,
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 1);
				expect(result.skipped[0]).toMatchObject({
					path: "00 Inbox/Note.md",
					reason: "Missing area or project in frontmatter",
				});
			});

			test("skips notes when project is empty array", async () => {
				vaultPath = setupTest(["01 Projects/Alpha"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					`---
title: "Empty Array Project"
project: []
---

Content.
`,
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 1);
				expect(result.skipped[0]).toMatchObject({
					path: "00 Inbox/Note.md",
					reason: "Missing area or project in frontmatter",
				});
			});

			test("skips notes when area array has non-string first element", async () => {
				vaultPath = setupTest(["02 Areas/Health"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					`---
title: "Non-String Array Element"
area:
  - 123
  - "Health"
---

Content.
`,
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 1);
				expect(result.skipped[0]).toMatchObject({
					path: "00 Inbox/Note.md",
					reason: "Missing area or project in frontmatter",
				});
			});

			test("skips notes when area is a number", async () => {
				vaultPath = setupTest(["02 Areas/Health"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					`---
title: "Number Area"
area: 123
---

Content.
`,
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 1);
				expect(result.skipped[0]).toMatchObject({
					path: "00 Inbox/Note.md",
					reason: "Missing area or project in frontmatter",
				});
			});

			test("skips notes when project is a boolean", async () => {
				vaultPath = setupTest(["01 Projects/Alpha"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					`---
title: "Boolean Project"
project: true
---

Content.
`,
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 1);
				expect(result.skipped[0]).toMatchObject({
					path: "00 Inbox/Note.md",
					reason: "Missing area or project in frontmatter",
				});
			});

			test("skips notes when area is an object", async () => {
				vaultPath = setupTest(["02 Areas/Health"]);

				writeVaultFile(
					vaultPath,
					"00 Inbox/Note.md",
					`---
title: "Object Area"
area:
  name: "Health"
  priority: 1
---

Content.
`,
				);

				const result = await scanForRoutableNotes(vaultPath, "00 Inbox");

				expectScanResult(result, 0, 1);
				expect(result.skipped[0]).toMatchObject({
					path: "00 Inbox/Note.md",
					reason: "Missing area or project in frontmatter",
				});
			});
		});
	});
});
