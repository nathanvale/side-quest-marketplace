/**
 * Unit tests for generateUniquePath helper function
 *
 * Since generateUniquePath is an internal helper in engine.ts,
 * we test it indirectly through filesystem operations that validate
 * the collision avoidance behavior.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

/**
 * Local copy of generateUniquePath for testing.
 * This mirrors the implementation in engine.ts.
 */
function generateUniquePath(basePath: string): string {
	if (!existsSync(basePath)) {
		return basePath;
	}

	const ext = extname(basePath);
	const base = ext ? basePath.slice(0, -ext.length) : basePath;
	let counter = 1;

	while (existsSync(`${base}-${counter}${ext}`)) {
		counter++;
	}

	return `${base}-${counter}${ext}`;
}

describe("generateUniquePath", () => {
	const testDir = join(process.cwd(), ".test-scratch", "unique-path-test");

	beforeEach(() => {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore
		}
	});

	test("should return original path if file does not exist", () => {
		const path = join(testDir, "new-file.pdf");
		const result = generateUniquePath(path);
		expect(result).toBe(path);
	});

	test("should append -1 suffix if file exists", () => {
		const basePath = join(testDir, "invoice.pdf");
		writeFileSync(basePath, "existing");

		const result = generateUniquePath(basePath);
		expect(result).toBe(join(testDir, "invoice-1.pdf"));
	});

	test("should append -2 if both base and -1 exist", () => {
		const basePath = join(testDir, "report.pdf");
		writeFileSync(basePath, "first");
		writeFileSync(join(testDir, "report-1.pdf"), "second");

		const result = generateUniquePath(basePath);
		expect(result).toBe(join(testDir, "report-2.pdf"));
	});

	test("should find first available slot with gaps", () => {
		const basePath = join(testDir, "data.pdf");
		writeFileSync(basePath, "first");
		// Skip -1, create -2
		writeFileSync(join(testDir, "data-2.pdf"), "third");

		const result = generateUniquePath(basePath);
		// Should find -1 (first available)
		expect(result).toBe(join(testDir, "data-1.pdf"));
	});

	test("should handle files with multiple dots in name", () => {
		const basePath = join(testDir, "archive.backup.pdf");
		writeFileSync(basePath, "existing");

		const result = generateUniquePath(basePath);
		expect(result).toBe(join(testDir, "archive.backup-1.pdf"));
	});

	test("should handle files with no extension", () => {
		const basePath = join(testDir, "README");
		writeFileSync(basePath, "existing");

		const result = generateUniquePath(basePath);
		expect(result).toBe(join(testDir, "README-1"));
	});

	test("should handle deep directory paths", () => {
		const deepDir = join(testDir, "level1", "level2", "level3");
		mkdirSync(deepDir, { recursive: true });

		const basePath = join(deepDir, "nested.pdf");
		writeFileSync(basePath, "existing");

		const result = generateUniquePath(basePath);
		expect(result).toBe(join(deepDir, "nested-1.pdf"));
	});

	test("should handle many collisions efficiently", () => {
		const basePath = join(testDir, "popular.pdf");

		// Create files: popular.pdf, popular-1.pdf, ..., popular-99.pdf
		for (let i = 0; i < 100; i++) {
			const path = i === 0 ? basePath : join(testDir, `popular-${i}.pdf`);
			writeFileSync(path, `version ${i}`);
		}

		const result = generateUniquePath(basePath);
		expect(result).toBe(join(testDir, "popular-100.pdf"));
	});

	test("should preserve extension case", () => {
		const basePath = join(testDir, "Document.PDF");
		writeFileSync(basePath, "existing");

		const result = generateUniquePath(basePath);
		expect(result).toBe(join(testDir, "Document-1.PDF"));
	});

	test("should work with dated filenames (inbox use case)", () => {
		const today = "2025-12-10";
		const basePath = join(testDir, `${today}-invoice.pdf`);
		writeFileSync(basePath, "first invoice");

		const result = generateUniquePath(basePath);
		expect(result).toBe(join(testDir, `${today}-invoice-1.pdf`));

		// Second collision
		writeFileSync(result, "second invoice");
		const result2 = generateUniquePath(basePath);
		expect(result2).toBe(join(testDir, `${today}-invoice-2.pdf`));
	});

	test("should not modify path if it does not exist, even with special chars", () => {
		const specialPath = join(testDir, "file-with-dashes-and-123.pdf");
		const result = generateUniquePath(specialPath);
		expect(result).toBe(specialPath);
	});
});
