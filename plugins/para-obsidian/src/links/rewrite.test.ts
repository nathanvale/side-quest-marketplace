import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import { createTestVault, readVaultFile, writeVaultFile } from "../test-utils";
import { rewriteLinks } from "./rewrite";

describe("rewriteLinks", () => {
	let vault: string;

	beforeEach(() => {
		vault = createTestVault();
	});

	afterEach(() => {
		fs.rmSync(vault, { recursive: true, force: true });
	});

	describe("body wikilinks", () => {
		it("replaces simple wikilinks", () => {
			writeVaultFile(vault, "note.md", "Link to [[old-file]] here.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(result.notesUpdated).toBe(1);
			expect(readVaultFile(vault, "note.md")).toBe(
				"Link to [[new-file]] here.",
			);
		});

		it("preserves aliases", () => {
			writeVaultFile(vault, "note.md", "Link to [[old-file|My Alias]] here.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readVaultFile(vault, "note.md")).toBe(
				"Link to [[new-file|My Alias]] here.",
			);
		});

		it("preserves headings", () => {
			writeVaultFile(vault, "note.md", "Link to [[old-file#Section]] here.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readVaultFile(vault, "note.md")).toBe(
				"Link to [[new-file#Section]] here.",
			);
		});

		it("preserves block references", () => {
			writeVaultFile(vault, "note.md", "Link to [[old-file^block123]] here.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readVaultFile(vault, "note.md")).toBe(
				"Link to [[new-file^block123]] here.",
			);
		});

		it("preserves heading + alias combinations", () => {
			writeVaultFile(
				vault,
				"note.md",
				"Link to [[old-file#Section|My Alias]] here.",
			);

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readVaultFile(vault, "note.md")).toBe(
				"Link to [[new-file#Section|My Alias]] here.",
			);
		});

		it("handles path-based links", () => {
			writeVaultFile(
				vault,
				"note.md",
				"See [[Attachments/old.pdf]] for details.",
			);

			const result = rewriteLinks(vault, [
				{ from: "Attachments/old.pdf", to: "Attachments/new.pdf" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readVaultFile(vault, "note.md")).toBe(
				"See [[Attachments/new.pdf]] for details.",
			);
		});

		it("replaces multiple occurrences in same file", () => {
			writeVaultFile(
				vault,
				"note.md",
				"First [[old]] and second [[old]] and third [[old]].",
			);

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }]);

			expect(result.linksRewritten).toBe(3);
			expect(result.notesUpdated).toBe(1);
			expect(readVaultFile(vault, "note.md")).toBe(
				"First [[new]] and second [[new]] and third [[new]].",
			);
		});

		it("is case insensitive", () => {
			writeVaultFile(vault, "note.md", "Link to [[Old-File]] here.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readVaultFile(vault, "note.md")).toBe(
				"Link to [[new-file]] here.",
			);
		});

		it("does not match partial links", () => {
			writeVaultFile(vault, "note.md", "Link to [[old-file-extended]] here.");

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(0);
			expect(readVaultFile(vault, "note.md")).toBe(
				"Link to [[old-file-extended]] here.",
			);
		});
	});

	describe("markdown links", () => {
		it("replaces markdown links", () => {
			writeVaultFile(
				vault,
				"note.md",
				"Link to [click here](old-file) for info.",
			);

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readVaultFile(vault, "note.md")).toBe(
				"Link to [click here](new-file) for info.",
			);
		});

		it("replaces markdown links with .md extension", () => {
			writeVaultFile(
				vault,
				"note.md",
				"Link to [click here](old-file.md) for info.",
			);

			const result = rewriteLinks(vault, [
				{ from: "old-file", to: "new-file" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readVaultFile(vault, "note.md")).toBe(
				"Link to [click here](new-file) for info.",
			);
		});
	});

	describe("frontmatter", () => {
		it("replaces links in frontmatter strings", () => {
			writeVaultFile(
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
			const content = readVaultFile(vault, "note.md");
			expect(content).toContain('project: "[[new-project]]"');
		});

		it("replaces links in frontmatter arrays", () => {
			writeVaultFile(
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
			const content = readVaultFile(vault, "note.md");
			expect(content).toContain("[[Attachments/new.pdf]]");
			expect(content).toContain("[[Attachments/other.pdf]]");
		});

		it("preserves other frontmatter fields", () => {
			writeVaultFile(
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

			const content = readVaultFile(vault, "note.md");
			expect(content).toContain("title: My Note");
			expect(content).toContain("- test");
		});
	});

	describe("options", () => {
		it("respects dryRun option", () => {
			writeVaultFile(vault, "note.md", "Link to [[old]] here.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }], {
				dryRun: true,
			});

			expect(result.linksRewritten).toBe(1);
			expect(result.notesUpdated).toBe(1);
			// File should be unchanged
			expect(readVaultFile(vault, "note.md")).toBe("Link to [[old]] here.");
		});

		it("respects dirs scoping", () => {
			writeVaultFile(vault, "Projects/note.md", "Link to [[old]] here.");
			writeVaultFile(vault, "Areas/note.md", "Link to [[old]] here.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }], {
				dirs: ["Projects"],
			});

			expect(result.linksRewritten).toBe(1);
			expect(result.notesUpdated).toBe(1);
			expect(readVaultFile(vault, "Projects/note.md")).toBe(
				"Link to [[new]] here.",
			);
			// Areas should be unchanged
			expect(readVaultFile(vault, "Areas/note.md")).toBe(
				"Link to [[old]] here.",
			);
		});

		it("handles multiple dirs", () => {
			writeVaultFile(vault, "Projects/note.md", "Link to [[old]] here.");
			writeVaultFile(vault, "Areas/note.md", "Link to [[old]] here.");
			writeVaultFile(vault, "Archive/note.md", "Link to [[old]] here.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }], {
				dirs: ["Projects", "Areas"],
			});

			expect(result.linksRewritten).toBe(2);
			expect(result.notesUpdated).toBe(2);
			expect(readVaultFile(vault, "Projects/note.md")).toBe(
				"Link to [[new]] here.",
			);
			expect(readVaultFile(vault, "Areas/note.md")).toBe(
				"Link to [[new]] here.",
			);
			// Archive should be unchanged
			expect(readVaultFile(vault, "Archive/note.md")).toBe(
				"Link to [[old]] here.",
			);
		});
	});

	describe("multiple mappings", () => {
		it("applies multiple mappings", () => {
			writeVaultFile(
				vault,
				"note.md",
				"Links: [[old-a]] and [[old-b]] and [[other]].",
			);

			const result = rewriteLinks(vault, [
				{ from: "old-a", to: "new-a" },
				{ from: "old-b", to: "new-b" },
			]);

			expect(result.linksRewritten).toBe(2);
			expect(readVaultFile(vault, "note.md")).toBe(
				"Links: [[new-a]] and [[new-b]] and [[other]].",
			);
		});

		it("applies mappings across multiple files", () => {
			writeVaultFile(vault, "note1.md", "Link to [[old]] here.");
			writeVaultFile(vault, "note2.md", "Another [[old]] link.");
			writeVaultFile(vault, "note3.md", "No matching links.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }]);

			expect(result.linksRewritten).toBe(2);
			expect(result.notesUpdated).toBe(2);
		});
	});

	describe("edge cases", () => {
		it("handles empty mappings array", () => {
			writeVaultFile(vault, "note.md", "Link to [[old]] here.");

			const result = rewriteLinks(vault, []);

			expect(result.linksRewritten).toBe(0);
			expect(result.notesUpdated).toBe(0);
		});

		it("handles no matching links", () => {
			writeVaultFile(vault, "note.md", "Link to [[something-else]] here.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }]);

			expect(result.linksRewritten).toBe(0);
			expect(result.notesUpdated).toBe(0);
		});

		it("handles files without frontmatter", () => {
			writeVaultFile(vault, "note.md", "Just body with [[old]] link.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }]);

			expect(result.linksRewritten).toBe(1);
			expect(readVaultFile(vault, "note.md")).toBe(
				"Just body with [[new]] link.",
			);
		});

		it("handles regex metacharacters in link names", () => {
			writeVaultFile(vault, "note.md", "Link to [[file (2023)]] here.");

			const result = rewriteLinks(vault, [
				{ from: "file (2023)", to: "file-2023" },
			]);

			expect(result.linksRewritten).toBe(1);
			expect(readVaultFile(vault, "note.md")).toBe(
				"Link to [[file-2023]] here.",
			);
		});

		it("skips hidden files and directories", () => {
			writeVaultFile(vault, ".hidden/note.md", "Link to [[old]] here.");
			writeVaultFile(vault, "visible/note.md", "Link to [[old]] here.");

			const result = rewriteLinks(vault, [{ from: "old", to: "new" }]);

			expect(result.linksRewritten).toBe(1);
			expect(result.notesUpdated).toBe(1);
		});

		it("reports correct locations in result", () => {
			writeVaultFile(
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
