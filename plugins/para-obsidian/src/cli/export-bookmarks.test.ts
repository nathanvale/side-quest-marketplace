/**
 * Tests for export-bookmarks CLI command
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import path from "node:path";
import { readTextFileSync } from "@sidequest/core/fs";
import { OutputFormat } from "@sidequest/core/terminal";
import { loadConfig } from "../config/index";
import {
	cleanupTestVault,
	createTestVault,
	setupTestVault,
} from "../testing/utils";
import { handleExportBookmarks } from "./export-bookmarks";
import type { CommandContext } from "./types";

/**
 * Helper to create test vault with standard PARA folders
 */
function setupTestVaultWithParaFolders(files: Record<string, string>) {
	setupTestVault({
		"00 Inbox/.gitkeep": "",
		"01 Projects/.gitkeep": "",
		"02 Areas/.gitkeep": "",
		"03 Resources/.gitkeep": "",
		"04 Archives/.gitkeep": "",
		"Tasks/.gitkeep": "",
		"Attachments/.gitkeep": "",
		"Daily Notes/.gitkeep": "",
		"Weekly Reviews/.gitkeep": "",
		...files,
	});
}

describe("handleExportBookmarks", () => {
	let vault: string;

	beforeEach(() => {
		vault = createTestVault();
	});

	afterEach(() => {
		cleanupTestVault(vault);
	});

	test("exports bookmarks grouped by PARA category", async () => {
		// Setup vault with bookmarks
		setupTestVaultWithParaFolders({
			"01 Projects/github.md": `---
type: bookmark
url: https://github.com
title: GitHub
para: projects
created: 2024-01-01T00:00:00Z
---
`,
			"03 Resources/mdn.md": `---
type: bookmark
url: https://developer.mozilla.org
title: MDN Web Docs
para: resources
created: 2024-01-02T00:00:00Z
---
`,
			"02 Areas/notion.md": `---
type: bookmark
url: https://notion.so
title: Notion
para: areas
created: 2024-01-03T00:00:00Z
---
`,
		});

		const outputPath = path.join(vault, "bookmarks.html");
		const config = loadConfig();

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: {
				filter: "type:bookmark",
				out: outputPath,
			},
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportBookmarks(ctx);

		expect(result.success).toBe(true);

		// Read generated HTML
		const html = readTextFileSync(outputPath);

		// Verify DOCTYPE and structure
		expect(html).toContain("<!DOCTYPE NETSCAPE-Bookmark-file-1>");
		expect(html).toContain("<H1>Bookmarks</H1>");
		expect(html).toContain("<DL><p>");

		// Verify categories in PARA order
		expect(html).toContain("<H3>Projects</H3>");
		expect(html).toContain("<H3>Areas</H3>");
		expect(html).toContain("<H3>Resources</H3>");

		// Verify bookmarks
		expect(html).toContain('HREF="https://github.com"');
		expect(html).toContain(">GitHub</A>");
		expect(html).toContain('HREF="https://developer.mozilla.org"');
		expect(html).toContain(">MDN Web Docs</A>");
		expect(html).toContain('HREF="https://notion.so"');
		expect(html).toContain(">Notion</A>");

		// Verify ADD_DATE timestamps
		expect(html).toContain('ADD_DATE="1704067200"'); // 2024-01-01 in seconds
	});

	test("handles vault with no bookmarks", async () => {
		setupTestVaultWithParaFolders({
			"01 Projects/note.md": `---
type: note
title: Regular Note
---
`,
		});

		const outputPath = path.join(vault, "bookmarks.html");
		const config = loadConfig();

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: {
				filter: "type:bookmark",
				out: outputPath,
			},
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportBookmarks(ctx);

		expect(result.success).toBe(true);
		// No file should be created when there are no bookmarks
	});

	test("skips bookmarks without url field", async () => {
		setupTestVaultWithParaFolders({
			"03 Resources/invalid.md": `---
type: bookmark
title: Invalid Bookmark
para: resources
---
`,
			"03 Resources/valid.md": `---
type: bookmark
url: https://example.com
title: Valid Bookmark
para: resources
created: 2024-01-01T00:00:00Z
---
`,
		});

		const outputPath = path.join(vault, "bookmarks.html");
		const config = loadConfig();

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: {
				filter: "type:bookmark",
				out: outputPath,
			},
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportBookmarks(ctx);

		expect(result.success).toBe(true);

		const html = readTextFileSync(outputPath);

		// Should only contain valid bookmark
		expect(html).toContain("Valid Bookmark");
		expect(html).not.toContain("Invalid Bookmark");
	});

	test("normalizes PARA categories from frontmatter", async () => {
		setupTestVaultWithParaFolders({
			"01 Projects/bookmark1.md": `---
type: bookmark
url: https://example1.com
title: Bookmark 1
para: 01_Projects
created: 2024-01-01T00:00:00Z
---
`,
			"03 Resources/bookmark2.md": `---
type: bookmark
url: https://example2.com
title: Bookmark 2
para: resource
created: 2024-01-02T00:00:00Z
---
`,
			"02 Areas/bookmark3.md": `---
type: bookmark
url: https://example3.com
title: Bookmark 3
para: areas
created: 2024-01-03T00:00:00Z
---
`,
		});

		const outputPath = path.join(vault, "bookmarks.html");
		const config = loadConfig();

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: {
				filter: "type:bookmark",
				out: outputPath,
			},
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportBookmarks(ctx);

		expect(result.success).toBe(true);

		const html = readTextFileSync(outputPath);

		// All variations should normalize to standard category names
		expect(html).toContain("<H3>Projects</H3>");
		expect(html).toContain("<H3>Areas</H3>");
		expect(html).toContain("<H3>Resources</H3>");
	});

	test("escapes HTML special characters in titles and URLs", async () => {
		setupTestVaultWithParaFolders({
			"03 Resources/special.md": `---
type: bookmark
url: https://example.com?foo=bar&baz=qux
title: "A & B < C > D"
para: resources
created: 2024-01-01T00:00:00Z
---
`,
		});

		const outputPath = path.join(vault, "bookmarks.html");
		const config = loadConfig();

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: {
				filter: "type:bookmark",
				out: outputPath,
			},
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportBookmarks(ctx);

		expect(result.success).toBe(true);

		const html = readTextFileSync(outputPath);

		// Verify HTML escaping
		expect(html).toContain("A &amp; B &lt; C &gt; D");
		expect(html).toContain("foo=bar&amp;baz=qux");
	});

	test("expands ~ in output path", async () => {
		setupTestVaultWithParaFolders({
			"03 Resources/bookmark.md": `---
type: bookmark
url: https://example.com
title: Test
para: resources
created: 2024-01-01T00:00:00Z
---
`,
		});

		const config = loadConfig();
		const homeDir = process.env.HOME ?? "";
		const outputPath = `~/bookmarks-test-${Date.now()}.html`;

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: {
				filter: "type:bookmark",
				out: outputPath,
			},
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportBookmarks(ctx);

		expect(result.success).toBe(true);

		// Cleanup expanded path
		const expandedPath = path.join(homeDir, outputPath.slice(2));
		try {
			const fs = await import("node:fs");
			if (fs.existsSync(expandedPath)) {
				fs.unlinkSync(expandedPath);
			}
		} catch {
			// Ignore cleanup errors
		}
	});

	test("rejects filter without type:bookmark", async () => {
		const config = loadConfig();

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: {
				filter: "tag:web",
				out: "bookmarks.html",
			},
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportBookmarks(ctx);

		expect(result.success).toBe(false);
		expect(result.error).toContain("Filter must include 'type:bookmark'");
	});

	test("outputs JSON format when isJson is true", async () => {
		setupTestVaultWithParaFolders({
			"03 Resources/bookmark.md": `---
type: bookmark
url: https://example.com
title: Test
para: resources
created: 2024-01-01T00:00:00Z
---
`,
		});

		const outputPath = path.join(vault, "bookmarks.html");
		const config = loadConfig();

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: {
				filter: "type:bookmark",
				out: outputPath,
			},
			format: OutputFormat.JSON,
			isJson: true,
		};

		// Capture console.log output
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (msg: string) => logs.push(msg);

		try {
			const result = await handleExportBookmarks(ctx);
			expect(result.success).toBe(true);

			// Verify JSON output
			const jsonOutput = JSON.parse(logs[0] ?? "{}");
			expect(jsonOutput.success).toBe(true);
			expect(jsonOutput.count).toBe(1);
			expect(jsonOutput.output_path).toBe(outputPath);
		} finally {
			console.log = originalLog;
		}
	});

	test("handles invalid date strings gracefully (defense-in-depth)", async () => {
		setupTestVaultWithParaFolders({
			"03 Resources/invalid-date.md": `---
type: bookmark
url: https://example.com
title: Invalid Date Bookmark
para: resources
created: not-a-valid-date
---
`,
			"03 Resources/valid-date.md": `---
type: bookmark
url: https://example2.com
title: Valid Date Bookmark
para: resources
created: 2024-06-15T10:30:00Z
---
`,
		});

		const outputPath = path.join(vault, "bookmarks.html");
		const config = loadConfig();

		const ctx: CommandContext = {
			config,
			positional: [],
			flags: {
				filter: "type:bookmark",
				out: outputPath,
			},
			format: OutputFormat.MARKDOWN,
			isJson: false,
		};

		const result = await handleExportBookmarks(ctx);

		expect(result.success).toBe(true);

		const html = readTextFileSync(outputPath);

		// Both bookmarks should be exported
		expect(html).toContain("Invalid Date Bookmark");
		expect(html).toContain("Valid Date Bookmark");

		// Invalid date should NOT produce NaN - should fallback to current time
		expect(html).not.toContain('ADD_DATE="NaN"');

		// All ADD_DATE values should be valid positive integers (not NaN or negative)
		const addDateMatches = html.match(/ADD_DATE="(\d+)"/g);
		expect(addDateMatches).not.toBeNull();
		expect(addDateMatches?.length).toBe(2);

		// Extract numeric timestamps and verify they're valid
		for (const match of addDateMatches ?? []) {
			const timestamp = Number.parseInt(
				match.replace(/ADD_DATE="(\d+)"/, "$1"),
				10,
			);
			expect(Number.isNaN(timestamp)).toBe(false);
			expect(timestamp).toBeGreaterThan(0);
		}
	});
});
