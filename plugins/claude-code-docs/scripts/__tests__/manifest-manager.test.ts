import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ManifestManager } from "../lib/manifest-manager";
import type { Manifest, ManifestEntry } from "../lib/types";

describe("ManifestManager", () => {
	const testDir = "/tmp/claude-docs-test-manifest-manager";
	const manifestPath = join(testDir, "manifest.json");
	let manager: ManifestManager;

	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true });
		await mkdir(testDir, { recursive: true });
		manager = new ManifestManager(manifestPath);
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	describe("loadManifest", () => {
		test("loads existing manifest from file", async () => {
			const existingManifest: Manifest = {
				metadata: {
					base_url: "https://code.claude.com/docs/en",
					last_updated: "2025-01-15T10:00:00Z",
					version: "1.0.0",
				},
				files: [
					{
						url: "https://code.claude.com/docs/en/hooks",
						filename: "hooks.md",
						sha256: "abc123",
						fetched_at: "2025-01-15T10:00:00Z",
					},
				],
			};

			await writeFile(manifestPath, JSON.stringify(existingManifest), "utf-8");

			const manifest = await manager.loadManifest();

			expect(manifest.metadata.base_url).toBe(
				"https://code.claude.com/docs/en",
			);
			expect(manifest.files).toHaveLength(1);
			expect(manifest.files[0]?.filename).toBe("hooks.md");
		});

		test("creates new manifest if file does not exist", async () => {
			const manifest = await manager.loadManifest();

			expect(manifest.metadata.base_url).toBe(
				"https://code.claude.com/docs/en",
			);
			expect(manifest.metadata.version).toBe("1.0.0");
			expect(manifest.files).toEqual([]);
			expect(manifest.metadata.last_updated).toBeTruthy();
		});

		test("creates new manifest if file is corrupted", async () => {
			await writeFile(manifestPath, "not valid json", "utf-8");

			const manifest = await manager.loadManifest();

			expect(manifest.files).toEqual([]);
		});
	});

	describe("saveManifest", () => {
		test("saves manifest to file", async () => {
			const manifest: Manifest = {
				metadata: {
					base_url: "https://code.claude.com/docs/en",
					last_updated: "2025-01-15T10:00:00Z",
					version: "1.0.0",
				},
				files: [
					{
						url: "https://code.claude.com/docs/en/hooks",
						filename: "hooks.md",
						sha256: "abc123",
						fetched_at: "2025-01-15T10:00:00Z",
					},
				],
			};

			await manager.saveManifest(manifest);

			const content = await readFile(manifestPath, "utf-8");
			const saved = JSON.parse(content);

			expect(saved.files).toHaveLength(1);
			expect(saved.files[0].filename).toBe("hooks.md");
		});

		test("overwrites existing manifest", async () => {
			const first: Manifest = {
				metadata: {
					base_url: "https://code.claude.com/docs/en",
					last_updated: "2025-01-15T10:00:00Z",
					version: "1.0.0",
				},
				files: [
					{
						url: "https://code.claude.com/docs/en/old",
						filename: "old.md",
						sha256: "old123",
						fetched_at: "2025-01-15T10:00:00Z",
					},
				],
			};

			await manager.saveManifest(first);

			const second: Manifest = {
				metadata: {
					base_url: "https://code.claude.com/docs/en",
					last_updated: "2025-01-15T11:00:00Z",
					version: "1.0.0",
				},
				files: [
					{
						url: "https://code.claude.com/docs/en/new",
						filename: "new.md",
						sha256: "new123",
						fetched_at: "2025-01-15T11:00:00Z",
					},
				],
			};

			await manager.saveManifest(second);

			const content = await readFile(manifestPath, "utf-8");
			const saved = JSON.parse(content);

			expect(saved.files).toHaveLength(1);
			expect(saved.files[0].filename).toBe("new.md");
		});
	});

	describe("needsUpdate", () => {
		test("returns true for new URL not in manifest", () => {
			const manifest: Manifest = {
				metadata: {
					base_url: "https://code.claude.com/docs/en",
					last_updated: "2025-01-15T10:00:00Z",
					version: "1.0.0",
				},
				files: [],
			};

			const result = manager.needsUpdate(
				"https://code.claude.com/docs/en/new",
				"content",
				manifest,
			);

			expect(result).toBe(true);
		});

		test("returns true when content hash has changed", () => {
			const manifest: Manifest = {
				metadata: {
					base_url: "https://code.claude.com/docs/en",
					last_updated: "2025-01-15T10:00:00Z",
					version: "1.0.0",
				},
				files: [
					{
						url: "https://code.claude.com/docs/en/hooks",
						filename: "hooks.md",
						sha256: "oldhash",
						fetched_at: "2025-01-15T10:00:00Z",
					},
				],
			};

			const result = manager.needsUpdate(
				"https://code.claude.com/docs/en/hooks",
				"new content",
				manifest,
			);

			expect(result).toBe(true);
		});

		test("returns false when content hash is unchanged", () => {
			const content = "test content";
			const hash = manager.calculateSha256(content);

			const manifest: Manifest = {
				metadata: {
					base_url: "https://code.claude.com/docs/en",
					last_updated: "2025-01-15T10:00:00Z",
					version: "1.0.0",
				},
				files: [
					{
						url: "https://code.claude.com/docs/en/hooks",
						filename: "hooks.md",
						sha256: hash,
						fetched_at: "2025-01-15T10:00:00Z",
					},
				],
			};

			const result = manager.needsUpdate(
				"https://code.claude.com/docs/en/hooks",
				content,
				manifest,
			);

			expect(result).toBe(false);
		});
	});

	describe("updateEntry", () => {
		test("adds new entry to manifest", () => {
			const manifest: Manifest = {
				metadata: {
					base_url: "https://code.claude.com/docs/en",
					last_updated: "2025-01-15T10:00:00Z",
					version: "1.0.0",
				},
				files: [],
			};

			const entry: ManifestEntry = {
				url: "https://code.claude.com/docs/en/new",
				filename: "new.md",
				sha256: "newhash",
				fetched_at: "2025-01-15T11:00:00Z",
			};

			manager.updateEntry(manifest, entry);

			expect(manifest.files).toHaveLength(1);
			expect(manifest.files[0]).toEqual(entry);
		});

		test("updates existing entry in manifest", () => {
			const manifest: Manifest = {
				metadata: {
					base_url: "https://code.claude.com/docs/en",
					last_updated: "2025-01-15T10:00:00Z",
					version: "1.0.0",
				},
				files: [
					{
						url: "https://code.claude.com/docs/en/hooks",
						filename: "hooks.md",
						sha256: "oldhash",
						fetched_at: "2025-01-15T10:00:00Z",
					},
				],
			};

			const entry: ManifestEntry = {
				url: "https://code.claude.com/docs/en/hooks",
				filename: "hooks.md",
				sha256: "newhash",
				fetched_at: "2025-01-15T11:00:00Z",
			};

			manager.updateEntry(manifest, entry);

			expect(manifest.files).toHaveLength(1);
			expect(manifest.files[0]?.sha256).toBe("newhash");
			expect(manifest.files[0]?.fetched_at).toBe("2025-01-15T11:00:00Z");
		});

		test("does not duplicate entries", () => {
			const manifest: Manifest = {
				metadata: {
					base_url: "https://code.claude.com/docs/en",
					last_updated: "2025-01-15T10:00:00Z",
					version: "1.0.0",
				},
				files: [
					{
						url: "https://code.claude.com/docs/en/hooks",
						filename: "hooks.md",
						sha256: "hash1",
						fetched_at: "2025-01-15T10:00:00Z",
					},
					{
						url: "https://code.claude.com/docs/en/guide",
						filename: "guide.md",
						sha256: "hash2",
						fetched_at: "2025-01-15T10:01:00Z",
					},
				],
			};

			const entry: ManifestEntry = {
				url: "https://code.claude.com/docs/en/hooks",
				filename: "hooks.md",
				sha256: "newhash",
				fetched_at: "2025-01-15T11:00:00Z",
			};

			manager.updateEntry(manifest, entry);

			expect(manifest.files).toHaveLength(2);
			const hooksEntries = manifest.files.filter((f) => f.url === entry.url);
			expect(hooksEntries).toHaveLength(1);
			expect(manifest.files[0]?.sha256).toBe("newhash");
			expect(manifest.files[0]?.fetched_at).toBe("2025-01-15T11:00:00Z");
		});
	});
});
