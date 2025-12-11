import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
	createTempDir,
	createTempFilePath,
	ensureFileSync,
	findProjectRoot,
	findUpSync,
	readJsonFileOrDefault,
	readLinesSync,
	withTempDir,
	withTempDirSync,
	writeJsonFileAtomic,
	writeLinesSync,
	writeTextFileAtomic,
	writeTextFileSyncAtomic,
} from "./index";

function makeTmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "core-fs-test-"));
}

describe("temp file utilities", () => {
	it("createTempDir creates a directory", () => {
		const dir = createTempDir("test-prefix");
		expect(fs.existsSync(dir)).toBe(true);
		expect(dir).toContain("test-prefix");
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("createTempFilePath generates a path without creating file", () => {
		const file = createTempFilePath("test", ".txt");
		expect(file).toContain("test");
		expect(file).toContain(".txt");
		expect(fs.existsSync(file)).toBe(false);
	});

	it("withTempDir cleans up after async callback", async () => {
		let capturedDir = "";
		await withTempDir(async (dir) => {
			capturedDir = dir;
			expect(fs.existsSync(dir)).toBe(true);
			fs.writeFileSync(path.join(dir, "test.txt"), "data");
		});
		expect(fs.existsSync(capturedDir)).toBe(false);
	});

	it("withTempDirSync cleans up after sync callback", () => {
		let capturedDir = "";
		withTempDirSync((dir) => {
			capturedDir = dir;
			expect(fs.existsSync(dir)).toBe(true);
		});
		expect(fs.existsSync(capturedDir)).toBe(false);
	});
});

describe("atomic writes", () => {
	it("writeTextFileAtomic writes content", async () => {
		const tmpDir = makeTmpDir();
		const file = path.join(tmpDir, "atomic.txt");

		await writeTextFileAtomic(file, "atomic content");
		expect(fs.readFileSync(file, "utf8")).toBe("atomic content");

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("writeJsonFileAtomic writes JSON", async () => {
		const tmpDir = makeTmpDir();
		const file = path.join(tmpDir, "atomic.json");

		await writeJsonFileAtomic(file, { atomic: true });
		const content = JSON.parse(fs.readFileSync(file, "utf8"));
		expect(content).toEqual({ atomic: true });

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("writeTextFileSyncAtomic writes content sync", () => {
		const tmpDir = makeTmpDir();
		const file = path.join(tmpDir, "atomic-sync.txt");

		writeTextFileSyncAtomic(file, "atomic sync content");
		expect(fs.readFileSync(file, "utf8")).toBe("atomic sync content");

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});
});

describe("helper utilities", () => {
	it("readJsonFileOrDefault returns default on missing file", () => {
		const result = readJsonFileOrDefault("/nonexistent/file.json", {
			default: true,
		});
		expect(result).toEqual({ default: true });
	});

	it("readJsonFileOrDefault returns default on invalid JSON", () => {
		const tmpDir = makeTmpDir();
		const file = path.join(tmpDir, "invalid.json");
		fs.writeFileSync(file, "not valid json{{{");

		const result = readJsonFileOrDefault(file, { fallback: true });
		expect(result).toEqual({ fallback: true });

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("findUpSync finds file walking up directories", () => {
		const tmpDir = makeTmpDir();
		const nested = path.join(tmpDir, "a", "b", "c");
		fs.mkdirSync(nested, { recursive: true });
		fs.writeFileSync(path.join(tmpDir, "marker.txt"), "found");

		const result = findUpSync("marker.txt", nested);
		expect(result).toBe(path.join(tmpDir, "marker.txt"));

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("findUpSync returns null when file not found", () => {
		const tmpDir = makeTmpDir();
		const result = findUpSync("definitely-not-exists.xyz", tmpDir);
		expect(result).toBeNull();
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("findProjectRoot finds package.json directory", () => {
		// This test runs in the monorepo, so we should find a package.json
		const root = findProjectRoot();
		expect(root).not.toBeNull();
		expect(fs.existsSync(path.join(root as string, "package.json"))).toBe(true);
	});

	it("ensureFileSync creates file with default content", () => {
		const tmpDir = makeTmpDir();
		const file = path.join(tmpDir, "new-file.txt");

		expect(fs.existsSync(file)).toBe(false);
		ensureFileSync(file, "default content");
		expect(fs.existsSync(file)).toBe(true);
		expect(fs.readFileSync(file, "utf8")).toBe("default content");

		// Should not overwrite existing
		fs.writeFileSync(file, "modified");
		ensureFileSync(file, "default content");
		expect(fs.readFileSync(file, "utf8")).toBe("modified");

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("readLinesSync and writeLinesSync work together", () => {
		const tmpDir = makeTmpDir();
		const file = path.join(tmpDir, "lines.txt");

		writeLinesSync(file, ["line1", "line2", "line3"]);
		const lines = readLinesSync(file);
		expect(lines).toEqual(["line1", "line2", "line3"]);

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});
});

describe("path utilities", () => {
	it("fs.statSync.isDirectory returns true for directories", () => {
		const tmpDir = makeTmpDir();
		expect(fs.existsSync(tmpDir) && fs.statSync(tmpDir).isDirectory()).toBe(
			true,
		);
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("fs.statSync.isDirectory returns false for files", () => {
		const tmpDir = makeTmpDir();
		const file = path.join(tmpDir, "file.txt");
		fs.writeFileSync(file, "data");

		expect(fs.existsSync(file) && fs.statSync(file).isDirectory()).toBe(false);

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("fs.statSync.isFile returns true for files", () => {
		const tmpDir = makeTmpDir();
		const file = path.join(tmpDir, "file.txt");
		fs.writeFileSync(file, "data");

		expect(fs.existsSync(file) && fs.statSync(file).isFile()).toBe(true);

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("fs.statSync.isFile returns false for directories", () => {
		const tmpDir = makeTmpDir();
		expect(fs.existsSync(tmpDir) && fs.statSync(tmpDir).isFile()).toBe(false);
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("fs.existsSync returns true for existing paths", () => {
		const tmpDir = makeTmpDir();
		expect(fs.existsSync(tmpDir)).toBe(true);
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("fs.existsSync returns false for non-existing paths", () => {
		expect(fs.existsSync("/definitely/not/a/real/path")).toBe(false);
	});
});

describe("directory removal", () => {
	it("fs.promises.rm removes directory recursively", async () => {
		const tmpDir = makeTmpDir();
		const nested = path.join(tmpDir, "nested");
		fs.mkdirSync(nested);
		fs.writeFileSync(path.join(nested, "file.txt"), "data");

		await fs.promises.rm(tmpDir, { recursive: true });
		expect(fs.existsSync(tmpDir)).toBe(false);
	});

	it("fs.rmSync removes directory recursively", () => {
		const tmpDir = makeTmpDir();
		const nested = path.join(tmpDir, "nested");
		fs.mkdirSync(nested);
		fs.writeFileSync(path.join(nested, "file.txt"), "data");

		fs.rmSync(tmpDir, { recursive: true });
		expect(fs.existsSync(tmpDir)).toBe(false);
	});
});
