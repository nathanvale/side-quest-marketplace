import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureCacheDir, getCacheStats, isCachePopulated } from "./cache.js";

describe("cache utilities", () => {
	let tempDir: string;
	let repoPath: string;

	beforeEach(() => {
		// Create unique temp directory for each test
		tempDir = join(
			process.env.TMPDIR || "/tmp",
			`cache-test-${crypto.randomUUID()}`,
		);
		repoPath = tempDir;
	});

	afterEach(() => {
		// Clean up after each test
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("ensureCacheDir", () => {
		test("creates cache directory if it doesn't exist", () => {
			const cacheDir = ensureCacheDir(repoPath, "vector_db");

			expect(cacheDir).toBe(join(repoPath, ".kit", "vector_db"));
			expect(existsSync(cacheDir)).toBe(true);
		});

		test("is idempotent - safe to call multiple times", () => {
			const cacheDir1 = ensureCacheDir(repoPath, "vector_db");
			const cacheDir2 = ensureCacheDir(repoPath, "vector_db");

			expect(cacheDir1).toBe(cacheDir2);
			expect(existsSync(cacheDir1)).toBe(true);
		});

		test("creates separate directories for different cache names", () => {
			const vectorCache = ensureCacheDir(repoPath, "vector_db");
			const astCache = ensureCacheDir(repoPath, "ast_cache");

			expect(vectorCache).toBe(join(repoPath, ".kit", "vector_db"));
			expect(astCache).toBe(join(repoPath, ".kit", "ast_cache"));
			expect(vectorCache).not.toBe(astCache);
		});

		test("creates parent .kit directory if needed", () => {
			const cacheDir = ensureCacheDir(repoPath, "vector_db");
			const kitDir = join(repoPath, ".kit");

			expect(existsSync(kitDir)).toBe(true);
			expect(existsSync(cacheDir)).toBe(true);
		});
	});

	describe("isCachePopulated", () => {
		test("returns false if cache directory doesn't exist", () => {
			const cacheDir = join(repoPath, ".kit", "vector_db");
			expect(isCachePopulated(cacheDir)).toBe(false);
		});

		test("returns false if cache directory is empty", () => {
			const cacheDir = ensureCacheDir(repoPath, "vector_db");
			expect(isCachePopulated(cacheDir)).toBe(false);
		});

		test("returns true if cache directory has files", () => {
			const cacheDir = ensureCacheDir(repoPath, "vector_db");
			writeFileSync(join(cacheDir, "index.db"), "test data");

			expect(isCachePopulated(cacheDir)).toBe(true);
		});

		test("returns true even with just one file", () => {
			const cacheDir = ensureCacheDir(repoPath, "vector_db");
			writeFileSync(join(cacheDir, "metadata.json"), "{}");

			expect(isCachePopulated(cacheDir)).toBe(true);
		});

		test("handles invalid cache directory path gracefully", () => {
			const invalidPath = join(repoPath, "nonexistent", "path");
			expect(isCachePopulated(invalidPath)).toBe(false);
		});
	});

	describe("getCacheStats", () => {
		test("returns null if cache directory doesn't exist", () => {
			const cacheDir = join(repoPath, ".kit", "vector_db");
			expect(getCacheStats(cacheDir)).toBeNull();
		});

		test("returns zero stats for empty cache directory", () => {
			const cacheDir = ensureCacheDir(repoPath, "vector_db");
			const stats = getCacheStats(cacheDir);

			expect(stats).toEqual({
				fileCount: 0,
				totalBytes: 0,
			});
		});

		test("counts files and calculates total bytes", () => {
			const cacheDir = ensureCacheDir(repoPath, "vector_db");

			// Write files with known sizes
			writeFileSync(join(cacheDir, "file1.txt"), "a".repeat(100));
			writeFileSync(join(cacheDir, "file2.txt"), "b".repeat(200));
			writeFileSync(join(cacheDir, "file3.txt"), "c".repeat(50));

			const stats = getCacheStats(cacheDir);

			expect(stats?.fileCount).toBe(3);
			expect(stats?.totalBytes).toBe(350);
		});

		test("handles single file cache", () => {
			const cacheDir = ensureCacheDir(repoPath, "vector_db");
			writeFileSync(join(cacheDir, "index.db"), "test");

			const stats = getCacheStats(cacheDir);

			expect(stats?.fileCount).toBe(1);
			expect(stats?.totalBytes).toBe(4);
		});

		test("handles large files", () => {
			const cacheDir = ensureCacheDir(repoPath, "vector_db");

			// Create a 1MB file
			const largeContent = "x".repeat(1024 * 1024);
			writeFileSync(join(cacheDir, "large.db"), largeContent);

			const stats = getCacheStats(cacheDir);

			expect(stats?.fileCount).toBe(1);
			expect(stats?.totalBytes).toBe(1024 * 1024);
		});

		test("handles invalid cache directory path gracefully", () => {
			const invalidPath = join(repoPath, "nonexistent", "path");
			expect(getCacheStats(invalidPath)).toBeNull();
		});
	});

	describe("integration scenarios", () => {
		test("typical cache workflow: ensure -> check -> populate -> verify", () => {
			const cacheName = "vector_db";

			// Step 1: Ensure cache dir exists
			const cacheDir = ensureCacheDir(repoPath, cacheName);
			expect(cacheDir).toBe(join(repoPath, ".kit", cacheName));

			// Step 2: Check if populated (should be empty)
			expect(isCachePopulated(cacheDir)).toBe(false);

			// Step 3: Write some cache files
			writeFileSync(join(cacheDir, "index.db"), "index data");
			writeFileSync(join(cacheDir, "metadata.json"), "{}");

			// Step 4: Verify populated and get stats
			expect(isCachePopulated(cacheDir)).toBe(true);

			const stats = getCacheStats(cacheDir);
			expect(stats?.fileCount).toBe(2);
			expect(stats?.totalBytes).toBeGreaterThan(0);
		});

		test("multiple cache types in same repo", () => {
			const vectorCache = ensureCacheDir(repoPath, "vector_db");
			const astCache = ensureCacheDir(repoPath, "ast_cache");

			// Populate vector cache
			writeFileSync(join(vectorCache, "vectors.db"), "vectors");
			expect(isCachePopulated(vectorCache)).toBe(true);

			// AST cache should still be empty
			expect(isCachePopulated(astCache)).toBe(false);

			// Stats should be independent
			const vectorStats = getCacheStats(vectorCache);
			const astStats = getCacheStats(astCache);

			expect(vectorStats?.fileCount).toBe(1);
			expect(astStats?.fileCount).toBe(0);
		});
	});
});
