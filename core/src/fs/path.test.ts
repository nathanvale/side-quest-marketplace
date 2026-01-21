import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
	expandTilde,
	matchesDir,
	normalizePath,
	normalizePathFragment,
} from "./path";

// ============================================================================
// expandTilde Tests - Ported from plugins/kit/src/validators.test.ts
// ============================================================================

describe("expandTilde", () => {
	test("expands ~ to home directory", () => {
		expect(expandTilde("~")).toBe(homedir());
	});

	test("expands ~/ prefix", () => {
		expect(expandTilde("~/code")).toBe(join(homedir(), "code"));
	});

	test("expands ~/nested/path", () => {
		expect(expandTilde("~/code/my-second-brain")).toBe(
			join(homedir(), "code/my-second-brain"),
		);
	});

	test("preserves absolute paths", () => {
		expect(expandTilde("/absolute/path")).toBe("/absolute/path");
	});

	test("preserves relative paths without tilde", () => {
		expect(expandTilde("relative/path")).toBe("relative/path");
	});

	test("does not expand tilde in middle of path", () => {
		expect(expandTilde("/some/~path")).toBe("/some/~path");
	});
});

// ============================================================================
// normalizePath Tests - Ported from plugins/kit/src/validators.test.ts
// ============================================================================

describe("normalizePath", () => {
	test("expands tilde and normalizes", () => {
		const result = normalizePath("~/code");
		expect(result).toBe(join(homedir(), "code"));
	});

	test("resolves relative paths from cwd", () => {
		const result = normalizePath("src");
		expect(result).toBe(resolve(process.cwd(), "src"));
	});

	test("resolves relative paths from custom base", () => {
		const result = normalizePath("src", "/custom/base");
		expect(result).toBe("/custom/base/src");
	});

	test("normalizes .. sequences", () => {
		const result = normalizePath("/a/b/../c");
		expect(result).toBe("/a/c");
	});

	test("normalizes redundant separators", () => {
		const result = normalizePath("/a//b///c");
		expect(result).toBe("/a/b/c");
	});
});

// ============================================================================
// normalizePathFragment Tests - Ported from para-obsidian
// ============================================================================

describe("normalizePathFragment", () => {
	test("converts backslashes to forward slashes", () => {
		expect(normalizePathFragment("Projects\\Alpha")).toBe("Projects/Alpha");
	});

	test("removes trailing slash", () => {
		expect(normalizePathFragment("Projects/Alpha/")).toBe("Projects/Alpha");
	});

	test("removes multiple trailing slashes", () => {
		expect(normalizePathFragment("Projects/Alpha///")).toBe("Projects/Alpha");
	});

	test("handles mixed slashes", () => {
		expect(normalizePathFragment("Projects\\Alpha/")).toBe("Projects/Alpha");
	});

	test("preserves internal slashes", () => {
		expect(normalizePathFragment("Projects//Alpha")).toBe("Projects//Alpha");
	});

	test("handles path without trailing slash", () => {
		expect(normalizePathFragment("Projects/Alpha")).toBe("Projects/Alpha");
	});

	test("handles empty string", () => {
		expect(normalizePathFragment("")).toBe("");
	});
});

// ============================================================================
// matchesDir Tests - Ported from para-obsidian
// ============================================================================

describe("matchesDir", () => {
	test("matches exact directory", () => {
		expect(matchesDir("01_Projects", ["01_Projects"])).toBe(true);
	});

	test("matches subdirectory", () => {
		expect(matchesDir("01_Projects/myproject", ["01_Projects"])).toBe(true);
	});

	test("matches deeply nested subdirectory", () => {
		expect(matchesDir("01_Projects/a/b/c", ["01_Projects"])).toBe(true);
	});

	test("does not match different directory", () => {
		expect(matchesDir("02_Areas/work", ["01_Projects"])).toBe(false);
	});

	test("matches any directory in list", () => {
		expect(matchesDir("02_Areas/work", ["01_Projects", "02_Areas"])).toBe(true);
	});

	test("matches all when dirs is empty", () => {
		expect(matchesDir("anything", [])).toBe(true);
	});

	test("matches all when dirs is undefined", () => {
		expect(matchesDir("anything", undefined)).toBe(true);
	});

	test("handles Windows-style paths", () => {
		expect(matchesDir("Projects\\Alpha\\note.md", ["Projects"])).toBe(true);
	});

	test("handles trailing slashes in directory", () => {
		expect(matchesDir("Projects/Alpha", ["Projects/"])).toBe(true);
	});

	test("handles trailing slashes in file path", () => {
		expect(matchesDir("Projects/Alpha/", ["Projects"])).toBe(true);
	});

	test("does not match partial directory names", () => {
		expect(matchesDir("ProjectsExtra/file", ["Projects"])).toBe(false);
	});
});
