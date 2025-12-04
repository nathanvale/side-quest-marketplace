import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { ParaObsidianConfig } from "./config";
import { insertIntoNote } from "./insert";

function makeVault(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "para-insert-"));
}

function writeNote(vault: string, relative: string, content: string): string {
	const abs = path.join(vault, relative);
	fs.mkdirSync(path.dirname(abs), { recursive: true });
	fs.writeFileSync(abs, content, "utf8");
	return abs;
}

describe("insertIntoNote", () => {
	it("appends content at end of section", () => {
		const vault = makeVault();
		const file = "note.md";
		writeNote(
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

		const result = fs.readFileSync(path.join(vault, file), "utf8");
		expect(result).toBe(
			`# Title\n\n## Tasks\n- existing\n- added\n\n## Notes\ntext\n`,
		);
	});

	it("prepends content directly under heading", () => {
		const vault = makeVault();
		const file = "note.md";
		writeNote(
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

		const result = fs.readFileSync(path.join(vault, file), "utf8");
		expect(result).toBe(
			`# Title\n\n## Tasks\n- first\n- existing\n\n## Notes\ntext\n`,
		);
	});

	it("inserts before heading", () => {
		const vault = makeVault();
		const file = "note.md";
		writeNote(vault, file, `# Title\n\n## Tasks\n- existing\n`);

		const config: ParaObsidianConfig = { vault };
		insertIntoNote(config, {
			file,
			heading: "Tasks",
			content: "Intro",
			mode: "before",
		});

		const result = fs.readFileSync(path.join(vault, file), "utf8");
		expect(result).toBe(`# Title\n\nIntro\n## Tasks\n- existing\n`);
	});

	it("throws when heading missing", () => {
		const vault = makeVault();
		const file = "note.md";
		writeNote(vault, file, `# Title\n\n## Tasks\n- existing\n`);

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
