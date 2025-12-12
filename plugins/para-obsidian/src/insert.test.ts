import { describe, expect, it } from "bun:test";
import {
	createTempDir,
	readTestFile,
	writeTestFile,
} from "@sidequest/core/testing";

import type { ParaObsidianConfig } from "./config";
import { insertIntoNote } from "./insert";

describe("insertIntoNote", () => {
	it("appends content at end of section", () => {
		const vault = createTempDir("para-insert-");
		const file = "note.md";
		writeTestFile(
			vault,
			file,
			`# Title\n\n## Tasks\n- existing\n\n## Notes\ntext\n`,
		);

		const config: ParaObsidianConfig = { vault };
		insertIntoNote(config, {
			file,
			heading: "Tasks",
			content: "- added",
			mode: "append",
		});

		const result = readTestFile(vault, file);
		expect(result).toBe(
			`# Title\n\n## Tasks\n- existing\n- added\n\n## Notes\ntext\n`,
		);
	});

	it("prepends content directly under heading", () => {
		const vault = createTempDir("para-insert-");
		const file = "note.md";
		writeTestFile(
			vault,
			file,
			`# Title\n\n## Tasks\n- existing\n\n## Notes\ntext\n`,
		);

		const config: ParaObsidianConfig = { vault };
		insertIntoNote(config, {
			file,
			heading: "Tasks",
			content: "- first",
			mode: "prepend",
		});

		const result = readTestFile(vault, file);
		expect(result).toBe(
			`# Title\n\n## Tasks\n- first\n- existing\n\n## Notes\ntext\n`,
		);
	});

	it("inserts before heading", () => {
		const vault = createTempDir("para-insert-");
		const file = "note.md";
		writeTestFile(vault, file, `# Title\n\n## Tasks\n- existing\n`);

		const config: ParaObsidianConfig = { vault };
		insertIntoNote(config, {
			file,
			heading: "Tasks",
			content: "Intro",
			mode: "before",
		});

		const result = readTestFile(vault, file);
		expect(result).toBe(`# Title\n\nIntro\n## Tasks\n- existing\n`);
	});

	it("throws when heading missing", () => {
		const vault = createTempDir("para-insert-");
		const file = "note.md";
		writeTestFile(vault, file, `# Title\n\n## Tasks\n- existing\n`);

		const config: ParaObsidianConfig = { vault };
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
