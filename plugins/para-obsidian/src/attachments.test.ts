import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { discoverAttachments } from "./attachments";

function makeVault(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "para-attach-"));
}

describe("discoverAttachments", () => {
	it("finds sibling assets folders and stem files", () => {
		const vault = makeVault();
		const note = path.join(vault, "note.md");
		fs.writeFileSync(note, "body", "utf8");

		const assetsDir = path.join(vault, "assets");
		fs.mkdirSync(assetsDir, { recursive: true });
		fs.writeFileSync(path.join(assetsDir, "image.png"), "data");

		const stemFile = path.join(vault, "note.png");
		fs.writeFileSync(stemFile, "data");

		const found = discoverAttachments(vault, "note.md");
		expect(found).toContain("assets/image.png");
		expect(found).toContain("note.png");
	});
});
