import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { rewriteLinks } from "./rewrite-links";

function makeTmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "rewrite-links-"));
}

function writeFile(vault: string, rel: string, content: string) {
	const full = path.join(vault, rel);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, content, "utf8");
}

function readFile(vault: string, rel: string): string {
	return fs.readFileSync(path.join(vault, rel), "utf8");
}

describe("rewriteLinks", () => {
	let vault: string;

	beforeEach(() => {
		vault = makeTmpDir();
	});

	afterEach(() => {
		fs.rmSync(vault, { recursive: true, force: true });
	});

	describe("body wikilinks", () => {
		it("replaces simple wikilinks", () => {
			writeFile(vault, "note.md", "Link to [[old-file]] here.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(result.notesUpdated).toBe(1);
			expect(readFile(vault, "note.md")).toBe("Link to [[new-file]] here.");
		});

		it("preserves aliases", () => {
			writeFile(vault, "note.md", "Link to [[old-file|My Alias]] here.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readFile(vault, "note.md")).toBe(
				"Link to [[new-file|My Alias]] here.",
			);
		});

		it("preserves headings", () => {
			writeFile(vault, "note.md", "Link to [[old-file#Section]] here.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readFile(vault, "note.md")).toBe(
				"Link to [[new-file#Section]] here.",
			);
		});

		it("preserves block references", () => {
			writeFile(vault, "note.md", "Link to [[old-file^block123]] here.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readFile(vault, "note.md")).toBe(
				"Link to [[new-file^block123]] here.",
			);
		});

		it("preserves heading + alias combinations", () => {
			writeFile(
				vault,
				"note.md",
				"Link to [[old-file#Section|My Alias]] here.",
			);

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readFile(vault, "note.md")).toBe(
				"Link to [[new-file#Section|My Alias]] here.",
			);
		});

		it("handles path-based links", () => {
			writeFile(vault, "note.md", "See [[Attachments/old.pdf]] for details.");

			const result = rewriteLinks(vault, [
				{ from: "Attachments/old.pdf", to: "Attachments/new.pdf" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readFile(vault, "note.md")).toBe(
				"See [[Attachments/new.pdf]] for details.",
			);
		});

		it("replaces multiple occurrences in same file", () => {
			writeFile(
				vault,
				"note.md",
				"First [[old]] and second [[old]] and third [[old]].",
			);

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }]);

			expect(result.linksRewritten).toBe(3);
			expect(result.notesUpdated).toBe(1);
			expect(readFile(vault, "note.md")).toBe(
				"First [[new]] and second [[new]] and third [[new]].",
			);
		});

		it("is case insensitive", () => {
			writeFile(vault, "note.md", "Link to [[Old-File]] here.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readFile(vault, "note.md")).toBe("Link to [[new-file]] here.");
		});

		it("does not match partial links", () => {
			writeFile(vault, "note.md", "Link to [[old-file-extended]] here.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(0);
			expect(readFile(vault, "note.md")).toBe(
				"Link to [[old-file-extended]] here.",
			);
		});
	});

	describe("markdown links", () => {
		it("replaces markdown links", () => {
			writeFile(vault, "note.md", "Link to [click here](old-file) for info.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readFile(vault, "note.md")).toBe(
				"Link to [click here](new-file) for info.",
			);
		});

		it("replaces markdown links with .md extension", () => {
			writeFile(
				vault,
				"note.md",
				"Link to [click here](old-file.md) for info.",
			);

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readFile(vault, "note.md")).toBe(
				"Link to [click here](new-file) for info.",
			);
		});
	});

	describe("frontmatter", () => {
		it("replaces links in frontmatter strings", () => {
			writeFile(
				vault,
				"note.md",
				`---
project: "[[old-project]]"
---
Body content.`,
			);

			const result = rewriteLinks(vault, [
				{ from: "old-project", to: "new-project" },
			]);

			expect(result.linksRewritten).toBe(1);
			const content = readFile(vault, "note.md");
			expect(content).toContain('project: "[[new-project]]"');
		});

		it("replaces links in frontmatter arrays", () => {
			writeFile(
				vault,
				"note.md",
				`---
attachments:
  - "[[Attachments/old.pdf]]"
  - "[[Attachments/other.pdf]]"
---
Body content.`,
			);

			const result = rewriteLinks(vault, [
				{ from: "Attachments/old.pdf", to: "Attachments/new.pdf" },
			]);

			expect(result.linksRewritten).toBe(1);
			const content = readFile(vault, "note.md");
			expect(content).toContain("[[Attachments/new.pdf]]");
			expect(content).toContain("[[Attachments/other.pdf]]");
		});

		it("preserves other frontmatter fields", () => {
			writeFile(
				vault,
				"note.md",
				`---
title: My Note
project: "[[old-project]]"
tags:
  - test
---
Body content.`,
			);

			rewriteLinks(vault, [{ from: "old-project", to: "new-project" }]);

			const content = readFile(vault, "note.md");
			expect(content).toContain("title: My Note");
			expect(content).toContain("- test");
		});
	});

	describe("options", () => {
		it("respects dryRun option", () => {
			writeFile(vault, "note.md", "Link to [[old]] here.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }], {
				dryRun: true,
			});

			expect(result.linksRewritten).toBe(1);
			expect(result.notesUpdated).toBe(1);
			// File should be unchanged
			expect(readFile(vault, "note.md")).toBe("Link to [[old]] here.");
		});

		it("respects dirs scoping", () => {
			writeFile(vault, "Projects/note.md", "Link to [[old]] here.");
			writeFile(vault, "Areas/note.md", "Link to [[old]] here.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }], {
				dirs: ["Projects"],
			});

			expect(result.linksRewritten).toBe(1);
			expect(result.notesUpdated).toBe(1);
			expect(readFile(vault, "Projects/note.md")).toBe("Link to [[new]] here.");
			// Areas should be unchanged
			expect(readFile(vault, "Areas/note.md")).toBe("Link to [[old]] here.");
		});

		it("handles multiple dirs", () => {
			writeFile(vault, "Projects/note.md", "Link to [[old]] here.");
			writeFile(vault, "Areas/note.md", "Link to [[old]] here.");
			writeFile(vault, "Archive/note.md", "Link to [[old]] here.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }], {
				dirs: ["Projects", "Areas"],
			});

			expect(result.linksRewritten).toBe(2);
			expect(result.notesUpdated).toBe(2);
			expect(readFile(vault, "Projects/note.md")).toBe("Link to [[new]] here.");
			expect(readFile(vault, "Areas/note.md")).toBe("Link to [[new]] here.");
			// Archive should be unchanged
			expect(readFile(vault, "Archive/note.md")).toBe("Link to [[old]] here.");
		});
	});

	describe("multiple mappings", () => {
		it("applies multiple mappings", () => {
			writeFile(
				vault,
				"note.md",
				"Links: [[old-a]] and [[old-b]] and [[other]].",
			);

			const result = rewriteLinks(vault, [
				{ from: "old-a", to: "new-a" },
				{ from: "old-b", to: "new-b" },
			]);

			expect(result.linksRewritten).toBe(2);
			expect(readFile(vault, "note.md")).toBe(
				"Links: [[new-a]] and [[new-b]] and [[other]].",
			);
		});

		it("applies mappings across multiple files", () => {
			writeFile(vault, "note1.md", "Link to [[old]] here.");
			writeFile(vault, "note2.md", "Another [[old]] link.");
			writeFile(vault, "note3.md", "No matching links.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }]);

			expect(result.linksRewritten).toBe(2);
			expect(result.notesUpdated).toBe(2);
		});
	});

	describe("edge cases", () => {
		it("handles empty mappings array", () => {
			writeFile(vault, "note.md", "Link to [[old]] here.");

			const result = rewriteLinks(vault, []);

			expect(result.linksRewritten).toBe(0);
			expect(result.notesUpdated).toBe(0);
		});

		it("handles no matching links", () => {
			writeFile(vault, "note.md", "Link to [[something-else]] here.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }]);

			expect(result.linksRewritten).toBe(0);
			expect(result.notesUpdated).toBe(0);
		});

		it("handles files without frontmatter", () => {
			writeFile(vault, "note.md", "Just body with [[old]] link.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }]);

			expect(result.linksRewritten).toBe(1);
			expect(readFile(vault, "note.md")).toBe("Just body with [[new]] link.");
		});

		it("handles regex metacharacters in link names", () => {
			writeFile(vault, "note.md", "Link to [[file (2023)]] here.");

			const result = rewriteLinks(vault, [
				{ from: "file (2023)", to: "file-2023" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readFile(vault, "note.md")).toBe("Link to [[file-2023]] here.");
		});

		it("skips hidden files and directories", () => {
			writeFile(vault, ".hidden/note.md", "Link to [[old]] here.");
			writeFile(vault, "visible/note.md", "Link to [[old]] here.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }]);

			expect(result.linksRewritten).toBe(1);
			expect(result.notesUpdated).toBe(1);
		});

		it("reports correct locations in result", () => {
			writeFile(
				vault,
				"note.md",
				`---
project: "[[old]]"
---
Body with [[old]] link.`,
			);

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }]);

			expect(result.updates.length).toBe(1);
			const rewrites = result.updates[0]?.rewrites ?? [];
			expect(rewrites.length).toBe(2);
			expect(rewrites.some((r) => r.location === "frontmatter")).toBe(true);
			expect(rewrites.some((r) => r.location === "body")).toBe(true);
		});
	});
});
