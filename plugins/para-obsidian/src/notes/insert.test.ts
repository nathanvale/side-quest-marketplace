import { describe, expect, it } from "bun:test";
import { readVaultFile, withTempVault, writeVaultFile } from "../testing/utils";
import { insertIntoNote } from "./insert";

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
});
