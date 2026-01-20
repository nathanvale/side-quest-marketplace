import { describe, expect, it } from "bun:test";
import { unescapeGitPath } from "./paths";

describe("unescapeGitPath", () => {
	it("decodes emoji characters from octal escape sequences", () => {
		// 🧾 (receipt emoji U+1F9FE) = UTF-8 bytes [F0 9F A7 BE] = \360\237\247\276
		const escaped = "\\360\\237\\247\\276 Invoice.md";
		expect(unescapeGitPath(escaped)).toBe("🧾 Invoice.md");
	});

	it("decodes multiple emoji characters", () => {
		// 📝 (memo U+1F4DD) = \360\237\223\235
		// 🗂 (card box U+1F5C2) = \360\237\227\202 (without variation selector)
		const escaped =
			"\\360\\237\\223\\235 Note with \\360\\237\\227\\202 folder.md";
		expect(unescapeGitPath(escaped)).toBe("📝 Note with 🗂 folder.md");
	});

	it("handles standard C escape sequences", () => {
		expect(unescapeGitPath("file\\twith\\ttabs.md")).toBe(
			"file\twith\ttabs.md",
		);
		expect(unescapeGitPath("file\\nwith\\nnewlines.md")).toBe(
			"file\nwith\nnewlines.md",
		);
		expect(unescapeGitPath("file\\rwith\\rreturns.md")).toBe(
			"file\rwith\rreturns.md",
		);
	});

	it("handles escaped backslash", () => {
		expect(unescapeGitPath("path\\\\to\\\\file.md")).toBe("path\\to\\file.md");
	});

	it("handles escaped double quote", () => {
		expect(unescapeGitPath('file \\"quoted\\".md')).toBe('file "quoted".md');
	});

	it("preserves regular ASCII characters", () => {
		expect(unescapeGitPath("Normal File Name.md")).toBe("Normal File Name.md");
	});

	it("handles mixed content (ASCII + emoji + escapes)", () => {
		// 🧾 Invoice - 2025\\t(draft).md
		const escaped = "\\360\\237\\247\\276 Invoice - 2025\\t(draft).md";
		expect(unescapeGitPath(escaped)).toBe("🧾 Invoice - 2025\t(draft).md");
	});

	it("handles empty string", () => {
		expect(unescapeGitPath("")).toBe("");
	});

	it("handles Japanese characters", () => {
		// 日本語 = UTF-8 bytes for each character
		// 日 = E6 97 A5 = \346\227\245
		// 本 = E6 9C AC = \346\234\254
		// 語 = E8 AA 9E = \350\252\236
		const escaped = "\\346\\227\\245\\346\\234\\254\\350\\252\\236.md";
		expect(unescapeGitPath(escaped)).toBe("日本語.md");
	});
});
