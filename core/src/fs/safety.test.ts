/**
 * Tests for path safety and validation utilities
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	sanitizePattern,
	validateFilePath,
	validatePathSafety,
} from "./safety.js";

describe("validateFilePath", () => {
	test("accepts valid relative paths", () => {
		expect(validateFilePath("Templates/invoice.md")).toBe(
			"Templates/invoice.md",
		);
		expect(validateFilePath("folder/subfolder/file.txt")).toBe(
			"folder/subfolder/file.txt",
		);
		expect(validateFilePath("simple.md")).toBe("simple.md");
	});

	test("normalizes paths with redundant separators", () => {
		expect(validateFilePath("folder//file.md")).toBe("folder/file.md");
		expect(validateFilePath("./folder/file.md")).toBe("folder/file.md");
	});

	test("rejects absolute paths", () => {
		expect(() => validateFilePath("/absolute/path.md")).toThrow(
			"Path must be relative",
		);
		expect(() => validateFilePath("/etc/passwd")).toThrow(
			"Path must be relative",
		);
	});

	test("rejects path traversal attempts", () => {
		expect(() => validateFilePath("../etc/passwd")).toThrow(
			"Path traversal not allowed",
		);
		expect(() => validateFilePath("folder/../../etc/passwd")).toThrow(
			"Path traversal not allowed",
		);
		expect(() => validateFilePath("../")).toThrow("Path traversal not allowed");
	});

	test("rejects hidden files", () => {
		expect(() => validateFilePath(".hidden")).toThrow(
			"Hidden files not allowed",
		);
		expect(() => validateFilePath("folder/.hidden")).toThrow(
			"Hidden files not allowed",
		);
		expect(() => validateFilePath(".config/file.txt")).toThrow(
			"Hidden files not allowed",
		);
	});

	test("rejects hidden directories in path", () => {
		expect(() => validateFilePath("folder/.secret/file.md")).toThrow(
			"Hidden files not allowed",
		);
	});
});

describe("validatePathSafety", () => {
	let tempRoot: string;

	beforeEach(() => {
		tempRoot = `/tmp/safety-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		mkdirSync(tempRoot, { recursive: true });
	});

	afterEach(() => {
		try {
			rmSync(tempRoot, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	test("accepts valid relative paths within root", () => {
		expect(() =>
			validatePathSafety("00 Inbox/note.md", tempRoot),
		).not.toThrow();
		expect(() =>
			validatePathSafety("Templates/invoice.md", tempRoot),
		).not.toThrow();
	});

	test("accepts absolute paths within root", () => {
		const innerPath = join(tempRoot, "folder/file.md");
		expect(() => validatePathSafety(innerPath, tempRoot)).not.toThrow();
	});

	test("rejects path traversal with ..", () => {
		expect(() => validatePathSafety("../../etc/passwd", tempRoot)).toThrow(
			"Unsafe path pattern",
		);
		expect(() => validatePathSafety("../outside", tempRoot)).toThrow(
			"Unsafe path pattern",
		);
	});

	test("rejects tilde paths", () => {
		expect(() => validatePathSafety("~/secrets", tempRoot)).toThrow(
			"Unsafe path pattern",
		);
		expect(() => validatePathSafety("~root/file", tempRoot)).toThrow(
			"Unsafe path pattern",
		);
	});

	test("rejects absolute paths outside root", () => {
		expect(() => validatePathSafety("/etc/passwd", tempRoot)).toThrow(
			"Unsafe path pattern",
		);
		expect(() => validatePathSafety("/tmp/other", tempRoot)).toThrow(
			"Unsafe path pattern",
		);
	});

	test("rejects paths that resolve outside root", () => {
		// Create a structure where normalized path escapes
		const innerDir = join(tempRoot, "inner");
		mkdirSync(innerDir, { recursive: true });

		// Try to escape via many ../ (caught by pattern check first)
		expect(() =>
			validatePathSafety("inner/../../../../../etc/passwd", tempRoot),
		).toThrow("Unsafe path pattern");
	});

	test("detects symlink escape attempts", () => {
		// Create a symlink pointing outside the root
		const linkPath = join(tempRoot, "escape-link");
		const outsidePath = "/tmp";

		try {
			symlinkSync(outsidePath, linkPath);

			// Try to follow symlink
			expect(() => validatePathSafety("escape-link/file", tempRoot)).toThrow(
				"Path traversal detected",
			);
		} catch (err) {
			// Skip test if we can't create symlinks (permissions)
			if ((err as NodeJS.ErrnoException).code === "EPERM") {
				console.warn("Skipping symlink test (insufficient permissions)");
			} else {
				throw err;
			}
		}
	});

	test("allows paths with non-existent intermediate directories", () => {
		// Should not throw even if path doesn't exist yet
		expect(() =>
			validatePathSafety("nonexistent/folder/file.md", tempRoot),
		).not.toThrow();
	});

	test("allows paths where parent exists", () => {
		const innerDir = join(tempRoot, "existing");
		mkdirSync(innerDir, { recursive: true });

		expect(() =>
			validatePathSafety("existing/new-file.md", tempRoot),
		).not.toThrow();
	});

	test("canonicalizes existing paths correctly", () => {
		// Create a real file
		const innerDir = join(tempRoot, "real");
		mkdirSync(innerDir, { recursive: true });
		const filePath = join(innerDir, "file.md");
		writeFileSync(filePath, "content");

		// Should accept the real path
		expect(() => validatePathSafety("real/file.md", tempRoot)).not.toThrow();
	});

	test("handles root path that doesn't exist", () => {
		const nonexistentRoot = "/tmp/nonexistent-root-12345";

		// Should still validate patterns even if root doesn't exist
		expect(() =>
			validatePathSafety("../../etc/passwd", nonexistentRoot),
		).toThrow("Unsafe path pattern");
	});

	test("accepts path equal to root", () => {
		// Edge case: path resolves to exactly the root
		expect(() => validatePathSafety(".", tempRoot)).not.toThrow();
		expect(() => validatePathSafety("", tempRoot)).not.toThrow();
	});
});

describe("sanitizePattern", () => {
	test("allows safe patterns unchanged", () => {
		expect(sanitizePattern("medical.*bill")).toBe("medical.*bill");
		expect(sanitizePattern("invoice-\\d+")).toBe("invoice-\\d+");
		expect(sanitizePattern("[a-z]+")).toBe("[a-z]+");
	});

	test("removes nested quantifiers (ReDoS risk)", () => {
		// These patterns can cause exponential backtracking
		expect(sanitizePattern("(a+)+")).toBe("");
		expect(sanitizePattern("(a*)*")).toBe("");
		// Note: Pattern may leave trailing quantifier if not inside parens
		const result = sanitizePattern("(ab+)*+");
		expect(result.length).toBeLessThan("(ab+)*+".length);
	});

	test("preserves non-nested quantifiers", () => {
		expect(sanitizePattern("a+b*c?")).toBe("a+b*c?");
		expect(sanitizePattern("\\d{2,4}")).toBe("\\d{2,4}");
	});

	test("removes complex nested patterns", () => {
		expect(sanitizePattern("prefix(a+)+suffix")).toBe("prefixsuffix");
		expect(sanitizePattern("(x+)+y+")).toBe("y+");
	});

	test("truncates patterns longer than 500 chars", () => {
		const longPattern = "a".repeat(600);
		const sanitized = sanitizePattern(longPattern);
		expect(sanitized.length).toBe(500);
		expect(sanitized).toBe("a".repeat(500));
	});

	test("handles empty patterns", () => {
		expect(sanitizePattern("")).toBe("");
	});

	test("handles patterns with mixed safe/unsafe content", () => {
		const pattern = "start.*middle(nested+)+end";
		const sanitized = sanitizePattern(pattern);
		expect(sanitized).not.toContain("(nested+)+");
		expect(sanitized).toContain("start.*middle");
	});

	test("prevents multiple types of attacks", () => {
		// Combination: nested quantifiers + excessive length
		const dangerous = "((a+)+)".repeat(100);
		const sanitized = sanitizePattern(dangerous);
		expect(sanitized.length).toBeLessThanOrEqual(500);
		expect(sanitized).not.toContain("((a+)+)");
	});
});
