import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getFileAgeHours, getFileSizeMB, isFileStale } from "./stats";

describe("File stats utilities", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = `/tmp/stats-test-${Date.now()}`;
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("getFileAgeHours", () => {
		test("returns null for non-existent file", () => {
			const result = getFileAgeHours(join(tempDir, "missing.txt"));
			expect(result).toBeNull();
		});

		test("returns age in hours for existing file", () => {
			const filePath = join(tempDir, "test.txt");
			writeFileSync(filePath, "content");

			const age = getFileAgeHours(filePath);
			expect(age).not.toBeNull();
			expect(age).toBeGreaterThanOrEqual(0);
			expect(age).toBeLessThan(1); // Should be less than 1 hour old
		});

		test("returns approximately correct age", () => {
			const filePath = join(tempDir, "test.txt");
			writeFileSync(filePath, "content");

			// Wait a small amount of time
			const startTime = Date.now();
			while (Date.now() - startTime < 100) {
				// Busy wait for 100ms
			}

			const age = getFileAgeHours(filePath);
			expect(age).not.toBeNull();
			expect(age).toBeGreaterThan(0);
			expect(age).toBeLessThan(0.01); // Should be less than 0.01 hours (36 seconds)
		});

		test("returns null for invalid path", () => {
			const result = getFileAgeHours("/invalid/\0/path");
			expect(result).toBeNull();
		});
	});

	describe("getFileSizeMB", () => {
		test("returns null for non-existent file", () => {
			const result = getFileSizeMB(join(tempDir, "missing.txt"));
			expect(result).toBeNull();
		});

		test("returns size in MB with 2 decimal places", () => {
			const filePath = join(tempDir, "test.txt");
			// Write ~1MB of data (1024 * 1024 bytes)
			const content = "a".repeat(1024 * 1024);
			writeFileSync(filePath, content);

			const size = getFileSizeMB(filePath);
			expect(size).not.toBeNull();
			expect(size).toMatch(/^\d+\.\d{2}$/); // Format: "X.XX"
			expect(Number.parseFloat(size!)).toBeCloseTo(1.0, 1);
		});

		test("returns correct size for small file", () => {
			const filePath = join(tempDir, "small.txt");
			writeFileSync(filePath, "hello");

			const size = getFileSizeMB(filePath);
			expect(size).not.toBeNull();
			expect(size).toMatch(/^0\.00$/); // 5 bytes should be 0.00 MB
		});

		test("returns correct size for larger file", () => {
			const filePath = join(tempDir, "large.txt");
			// Write ~2.5MB of data
			const content = "a".repeat(Math.floor(2.5 * 1024 * 1024));
			writeFileSync(filePath, content);

			const size = getFileSizeMB(filePath);
			expect(size).not.toBeNull();
			expect(Number.parseFloat(size!)).toBeCloseTo(2.5, 1);
		});

		test("returns null for invalid path", () => {
			const result = getFileSizeMB("/invalid/\0/path");
			expect(result).toBeNull();
		});
	});

	describe("isFileStale", () => {
		test("returns true for non-existent file", () => {
			const result = isFileStale(join(tempDir, "missing.txt"), 24);
			expect(result).toBe(true);
		});

		test("returns false for fresh file", () => {
			const filePath = join(tempDir, "test.txt");
			writeFileSync(filePath, "content");

			const result = isFileStale(filePath, 24);
			expect(result).toBe(false);
		});

		test("returns false when age exactly equals threshold", () => {
			const filePath = join(tempDir, "test.txt");
			writeFileSync(filePath, "content");

			// File is 0 hours old, threshold is 0 hours
			const result = isFileStale(filePath, 0);
			expect(result).toBe(false);
		});

		test("returns true when age exceeds threshold", () => {
			const filePath = join(tempDir, "test.txt");
			writeFileSync(filePath, "content");

			// Threshold is negative, so any age should be stale
			const result = isFileStale(filePath, -1);
			expect(result).toBe(true);
		});

		test("works with different threshold values", () => {
			const filePath = join(tempDir, "test.txt");
			writeFileSync(filePath, "content");

			// Fresh file should not be stale for reasonable thresholds
			expect(isFileStale(filePath, 1)).toBe(false);
			expect(isFileStale(filePath, 24)).toBe(false);
			expect(isFileStale(filePath, 168)).toBe(false); // 1 week
		});

		test("returns true for invalid path", () => {
			const result = isFileStale("/invalid/\0/path", 24);
			expect(result).toBe(true);
		});
	});

	describe("integration scenarios", () => {
		test("common cache validation pattern", () => {
			const cachePath = join(tempDir, "cache.json");
			const MAX_AGE = 24;

			// Initial state - cache doesn't exist
			expect(isFileStale(cachePath, MAX_AGE)).toBe(true);

			// Create cache
			writeFileSync(cachePath, JSON.stringify({ data: "test" }));

			// Cache is fresh
			expect(isFileStale(cachePath, MAX_AGE)).toBe(false);

			// Can read cache metadata
			const age = getFileAgeHours(cachePath);
			const size = getFileSizeMB(cachePath);
			expect(age).not.toBeNull();
			expect(size).not.toBeNull();
			expect(Number.parseFloat(size!)).toBeGreaterThanOrEqual(0);
		});

		test("index file reporting pattern", () => {
			const indexPath = join(tempDir, "PROJECT_INDEX.json");
			writeFileSync(indexPath, JSON.stringify({ files: [], symbols: {} }));

			// Get stats for reporting
			const age = getFileAgeHours(indexPath);
			const size = getFileSizeMB(indexPath);

			expect(age).not.toBeNull();
			expect(size).not.toBeNull();

			// Format for display (as kit plugin does)
			if (age !== null && size !== null) {
				const display = `Age: ${age.toFixed(1)} hours, Size: ${size} MB`;
				expect(display).toMatch(/Age: 0\.\d hours, Size: 0\.00 MB/);
			}
		});
	});
});
