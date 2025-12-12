import { describe, expect, it } from "bun:test";
import { createTempDir, writeTestFile } from "@sidequest/core/testing";

import { discoverAttachments } from "./attachments";

describe("discoverAttachments", () => {
	it("finds sibling assets folders and stem files", () => {
		const vault = createTempDir("para-attach-");
		writeTestFile(vault, "note.md", "body");
		writeTestFile(vault, "assets/image.png", "data");
		writeTestFile(vault, "note.png", "data");

		const found = discoverAttachments(vault, "note.md");
		expect(found).toContain("assets/image.png");
		expect(found).toContain("note.png");
	});
});
