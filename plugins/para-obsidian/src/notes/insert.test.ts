import { describe, expect, it } from "bun:test";
import { readVaultFile, withTempVault, writeVaultFile } from "../testing/utils";
import { insertIntoNote, replaceSectionContent } from "./insert";

describe("insertIntoNote", () => {
	it("appends content at end of section", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(
				vault,
				file,
				`# Title\n\n## Tasks\n- existing\n\n## Notes\ntext\n`,
			);

			insertIntoNote(config, {
				file,
				heading: "Tasks",
				content: "- added",
				mode: "append",
			});

			const result = readVaultFile(vault, file);
			expect(result).toBe(
				`# Title\n\n## Tasks\n- existing\n- added\n\n## Notes\ntext\n`,
			);
		});
	});

	it("prepends content directly under heading", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(
				vault,
				file,
				`# Title\n\n## Tasks\n- existing\n\n## Notes\ntext\n`,
			);

			insertIntoNote(config, {
				file,
				heading: "Tasks",
				content: "- first",
				mode: "prepend",
			});

			const result = readVaultFile(vault, file);
			expect(result).toBe(
				`# Title\n\n## Tasks\n- first\n- existing\n\n## Notes\ntext\n`,
			);
		});
	});

	it("inserts before heading", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(vault, file, `# Title\n\n## Tasks\n- existing\n`);

			insertIntoNote(config, {
				file,
				heading: "Tasks",
				content: "Intro",
				mode: "before",
			});

			const result = readVaultFile(vault, file);
			expect(result).toBe(`# Title\n\nIntro\n## Tasks\n- existing\n`);
		});
	});

	it("throws when heading missing", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(vault, file, `# Title\n\n## Tasks\n- existing\n`);

			expect(() =>
				insertIntoNote(config, {
					file,
					heading: "Missing",
					content: "nope",
					mode: "append",
				}),
			).toThrow("Heading not found");
		});
	});

	it("accepts heading with # prefix", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(
				vault,
				file,
				`# Title\n\n## Tasks\n- existing\n\n## Notes\ntext\n`,
			);

			insertIntoNote(config, {
				file,
				heading: "## Tasks",
				content: "- added via prefix",
				mode: "append",
			});

			const result = readVaultFile(vault, file);
			expect(result).toBe(
				`# Title\n\n## Tasks\n- existing\n- added via prefix\n\n## Notes\ntext\n`,
			);
		});
	});

	it("accepts heading with ### prefix", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(
				vault,
				file,
				`# Title\n\n## Section\n\n### Gratitude\n\n1.\n2.\n3.\n`,
			);

			insertIntoNote(config, {
				file,
				heading: "### Gratitude",
				content: "- grateful item",
				mode: "append",
			});

			const result = readVaultFile(vault, file);
			expect(result).toContain("- grateful item");
		});
	});

	it("treats horizontal rule as section boundary", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			// This is the WebClipper template pattern - AI Summary followed by ---
			writeVaultFile(
				vault,
				file,
				`# Title

## AI Summary



---

**Channel:** foo
**Duration:** bar

## Description

Some text
`,
			);

			insertIntoNote(config, {
				file,
				heading: "AI Summary",
				content: "> - Point 1\n> - Point 2",
				mode: "append",
			});

			const result = readVaultFile(vault, file);
			// Content should be inserted BEFORE the ---, not after it
			expect(result).toContain("> - Point 1\n> - Point 2");
			// Critical: content must be BEFORE ---, not after
			const summaryIndex = result.indexOf("## AI Summary");
			const contentIndex = result.indexOf("> - Point 1");
			const hrIndex = result.indexOf("---");
			expect(contentIndex).toBeGreaterThan(summaryIndex);
			expect(contentIndex).toBeLessThan(hrIndex);
		});
	});

	it("matches heading with substring/partial match (e.g., 'Executive Summary' matches 'Layer 4: Executive Summary')", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(
				vault,
				file,
				`# Resource Note

## Layer 1: Title

## Layer 2: Author

## Layer 3: Key Points

## Layer 4: Executive Summary

This is existing content.

## Layer 5: References
`,
			);

			insertIntoNote(config, {
				file,
				heading: "Executive Summary",
				content: "New summary content.",
				mode: "append",
			});

			const result = readVaultFile(vault, file);
			expect(result).toContain("## Layer 4: Executive Summary");
			expect(result).toContain(
				"This is existing content.\nNew summary content.",
			);
		});
	});

	it("prefers exact match over substring match", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(
				vault,
				file,
				`# Note

## Layer 1: Summary

Content 1

## Summary

Content 2

## Next Section
`,
			);

			insertIntoNote(config, {
				file,
				heading: "Summary",
				content: "Added to exact match.",
				mode: "append",
			});

			const result = readVaultFile(vault, file);
			// Should match "## Summary" (exact), not "## Layer 1: Summary" (substring)
			const lines = result.split("\n");
			const summaryIndex = lines.indexOf("## Summary");
			const content2Index = lines.indexOf("Content 2");
			const addedIndex = lines.indexOf("Added to exact match.");

			// Verify content was added to exact match section (after "Content 2")
			expect(addedIndex).toBeGreaterThan(content2Index);
			expect(addedIndex).toBeGreaterThan(summaryIndex);
		});
	});
});

describe("replaceSectionContent", () => {
	it("replaces content under a heading", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(
				vault,
				file,
				`# Title

## Tasks

- old task 1
- old task 2

## Notes

Some notes here
`,
			);

			const result = replaceSectionContent(config, {
				file,
				heading: "Tasks",
				content: "- new task",
			});

			expect(result.relative).toBe(file);
			expect(result.linesRemoved).toBeGreaterThan(0);

			const content = readVaultFile(vault, file);
			expect(content).toContain("## Tasks");
			expect(content).toContain("- new task");
			expect(content).not.toContain("- old task 1");
			expect(content).not.toContain("- old task 2");
			expect(content).toContain("## Notes");
			expect(content).toContain("Some notes here");
		});
	});

	it("replaces dataview query block", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(
				vault,
				file,
				`# Project

## Tasks

\`\`\`dataview
TASK FROM "wrong/path"
\`\`\`

## Notes

text
`,
			);

			replaceSectionContent(config, {
				file,
				heading: "Tasks",
				content: '```dataview\nTASK FROM "correct/path"\n```',
			});

			const content = readVaultFile(vault, file);
			expect(content).toContain('TASK FROM "correct/path"');
			expect(content).not.toContain('TASK FROM "wrong/path"');
		});
	});

	it("preserves HTML comments when option is set", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(
				vault,
				file,
				`# Title

## Section

<!-- keep this comment -->
Old content here

## Next
`,
			);

			replaceSectionContent(config, {
				file,
				heading: "Section",
				content: "New content",
				preserveComments: true,
			});

			const content = readVaultFile(vault, file);
			expect(content).toContain("<!-- keep this comment -->");
			expect(content).toContain("New content");
			expect(content).not.toContain("Old content");
		});
	});

	it("removes HTML comments when option is not set", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(
				vault,
				file,
				`# Title

## Section

<!-- this will be removed -->
Old content here

## Next
`,
			);

			replaceSectionContent(config, {
				file,
				heading: "Section",
				content: "New content",
			});

			const content = readVaultFile(vault, file);
			expect(content).not.toContain("<!-- this will be removed -->");
			expect(content).toContain("New content");
		});
	});

	it("throws when file not found", async () => {
		await withTempVault(async (_vault, config) => {
			expect(() =>
				replaceSectionContent(config, {
					file: "nonexistent.md",
					heading: "Tasks",
					content: "new",
				}),
			).toThrow("File not found");
		});
	});

	it("throws when heading not found", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(vault, file, `# Title\n\n## Tasks\n\nContent\n`);

			expect(() =>
				replaceSectionContent(config, {
					file,
					heading: "Missing",
					content: "new",
				}),
			).toThrow("Heading not found");
		});
	});

	it("accepts heading with # prefix", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(
				vault,
				file,
				`# Title\n\n## Tasks\n\nOld content\n\n## Next\n`,
			);

			replaceSectionContent(config, {
				file,
				heading: "## Tasks",
				content: "New content",
			});

			const content = readVaultFile(vault, file);
			expect(content).toContain("New content");
			expect(content).not.toContain("Old content");
		});
	});

	it("stops at horizontal rule boundary", async () => {
		await withTempVault(async (vault, config) => {
			const file = "note.md";
			writeVaultFile(
				vault,
				file,
				`# Title

## Summary

Old summary

---

Metadata below line

## Next
`,
			);

			replaceSectionContent(config, {
				file,
				heading: "Summary",
				content: "New summary",
			});

			const content = readVaultFile(vault, file);
			expect(content).toContain("New summary");
			expect(content).not.toContain("Old summary");
			// Metadata below --- should be preserved
			expect(content).toContain("Metadata below line");
		});
	});
});
