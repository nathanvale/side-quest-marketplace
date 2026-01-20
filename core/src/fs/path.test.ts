import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { expandTilde, normalizePath } from "./path";

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
