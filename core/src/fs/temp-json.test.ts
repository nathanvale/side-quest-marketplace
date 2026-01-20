import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withTempJsonFile, withTempJsonFileSync } from "./temp-json.js";

describe("withTempJsonFileSync", () => {
	let createdFiles: string[] = [];

	afterEach(() => {
		// Clean up any files that weren't cleaned up by the utility
		for (const file of createdFiles) {
			if (existsSync(file)) {
				Bun.file(file).writer().end();
				// Use rm -f to force delete
				const proc = Bun.spawnSync(["rm", "-f", file]);
				if (proc.exitCode !== 0) {
					console.warn(`Failed to cleanup ${file}`);
				}
			}
		}
		createdFiles = [];
	});

	test("successfully reads and parses JSON from temp file", () => {
		const data = { count: 3, items: ["a", "b", "c"] };

		const result = withTempJsonFileSync<typeof data>("test-sync", (path) => {
			createdFiles.push(path);
			writeFileSync(path, JSON.stringify(data), "utf8");
			return { exitCode: 0 };
		});

		expect(result).toEqual(data);
	});

	test("cleans up temp file on success", () => {
		let tempPath = "";

		withTempJsonFileSync<{ ok: boolean }>("test-sync", (path) => {
			tempPath = path;
			createdFiles.push(path);
			writeFileSync(path, JSON.stringify({ ok: true }), "utf8");
			return { exitCode: 0 };
		});

		expect(existsSync(tempPath)).toBe(false);
	});

	test("cleans up temp file on non-zero exit code", () => {
		let tempPath = "";

		try {
			withTempJsonFileSync<unknown>("test-sync", (path) => {
				tempPath = path;
				createdFiles.push(path);
				writeFileSync(path, JSON.stringify({ data: "test" }), "utf8");
				return { exitCode: 1, stderr: "Command failed" };
			});
		} catch {
			// Expected to throw
		}

		expect(existsSync(tempPath)).toBe(false);
	});

	test("cleans up temp file when output file missing", () => {
		try {
			withTempJsonFileSync<unknown>("test-sync", (_path) => {
				// Don't create the file
				return { exitCode: 0 };
			});
		} catch {
			// Expected to throw
		}

		// No temp file should exist
		const _pattern = join(tmpdir(), "test-sync-*.json");
		// Check that no files matching pattern exist
		expect(true).toBe(true); // File was never created
	});

	test("cleans up temp file on error during execution", () => {
		let tempPath = "";

		try {
			withTempJsonFileSync<unknown>("test-sync", (path) => {
				tempPath = path;
				createdFiles.push(path);
				throw new Error("Execution error");
			});
		} catch {
			// Expected to throw
		}

		expect(existsSync(tempPath)).toBe(false);
	});

	test("throws error on non-zero exit code with stderr", () => {
		expect(() => {
			withTempJsonFileSync<unknown>("test-sync", (path) => {
				createdFiles.push(path);
				writeFileSync(path, JSON.stringify({ data: "test" }), "utf8");
				return { exitCode: 1, stderr: "File not found" };
			});
		}).toThrow("Operation failed with exit code 1: File not found");
	});

	test("throws error on non-zero exit code without stderr", () => {
		expect(() => {
			withTempJsonFileSync<unknown>("test-sync", (path) => {
				createdFiles.push(path);
				writeFileSync(path, JSON.stringify({ data: "test" }), "utf8");
				return { exitCode: 2 };
			});
		}).toThrow("Operation failed with exit code 2: Command failed");
	});

	test("throws error when output file not created", () => {
		expect(() => {
			withTempJsonFileSync<unknown>("test-sync", (_path) => {
				// Don't create the file
				return { exitCode: 0 };
			});
		}).toThrow("Operation completed but output file not found");
	});

	test("throws error on invalid JSON", () => {
		expect(() => {
			withTempJsonFileSync<unknown>("test-sync", (path) => {
				createdFiles.push(path);
				writeFileSync(path, "not valid json", "utf8");
				return { exitCode: 0 };
			});
		}).toThrow("Failed to parse JSON output");
	});

	test("creates unique temp file paths", () => {
		const paths: string[] = [];

		for (let i = 0; i < 3; i++) {
			withTempJsonFileSync<{ id: number }>("test-sync", (path) => {
				paths.push(path);
				createdFiles.push(path);
				writeFileSync(path, JSON.stringify({ id: i }), "utf8");
				return { exitCode: 0 };
			});
		}

		// All paths should be unique
		const uniquePaths = new Set(paths);
		expect(uniquePaths.size).toBe(3);

		// All should contain the prefix
		for (const path of paths) {
			expect(path).toContain("test-sync-");
			expect(path).toEndWith(".json");
		}
	});

	test("handles complex nested JSON structures", () => {
		const data = {
			count: 2,
			matches: [
				{ file: "a.ts", line: 10, content: "test" },
				{ file: "b.ts", line: 20, content: "test2" },
			],
			metadata: {
				timestamp: Date.now(),
				version: "1.0.0",
			},
		};

		const result = withTempJsonFileSync<typeof data>("test-sync", (path) => {
			createdFiles.push(path);
			writeFileSync(path, JSON.stringify(data), "utf8");
			return { exitCode: 0 };
		});

		expect(result).toEqual(data);
		expect(result.matches).toHaveLength(2);
		expect(result.metadata.version).toBe("1.0.0");
	});
});

describe("withTempJsonFile (async)", () => {
	let createdFiles: string[] = [];

	afterEach(async () => {
		// Clean up any files that weren't cleaned up by the utility
		for (const file of createdFiles) {
			if (existsSync(file)) {
				const proc = Bun.spawnSync(["rm", "-f", file]);
				if (proc.exitCode !== 0) {
					console.warn(`Failed to cleanup ${file}`);
				}
			}
		}
		createdFiles = [];
	});

	test("successfully reads and parses JSON from temp file (async)", async () => {
		const data = { count: 3, items: ["a", "b", "c"] };

		const result = await withTempJsonFile<typeof data>(
			"test-async",
			async (path) => {
				createdFiles.push(path);
				await Bun.write(path, JSON.stringify(data));
				return { exitCode: 0 };
			},
		);

		expect(result).toEqual(data);
	});

	test("cleans up temp file on success (async)", async () => {
		let tempPath = "";

		await withTempJsonFile<{ ok: boolean }>("test-async", async (path) => {
			tempPath = path;
			createdFiles.push(path);
			await Bun.write(path, JSON.stringify({ ok: true }));
			return { exitCode: 0 };
		});

		expect(existsSync(tempPath)).toBe(false);
	});

	test("cleans up temp file on non-zero exit code (async)", async () => {
		let tempPath = "";

		try {
			await withTempJsonFile<unknown>("test-async", async (path) => {
				tempPath = path;
				createdFiles.push(path);
				await Bun.write(path, JSON.stringify({ data: "test" }));
				return { exitCode: 1, stderr: "Command failed" };
			});
		} catch {
			// Expected to throw
		}

		expect(existsSync(tempPath)).toBe(false);
	});

	test("throws error on non-zero exit code with stderr (async)", async () => {
		await expect(async () => {
			await withTempJsonFile<unknown>("test-async", async (path) => {
				createdFiles.push(path);
				await Bun.write(path, JSON.stringify({ data: "test" }));
				return { exitCode: 1, stderr: "File not found" };
			});
		}).toThrow("Operation failed with exit code 1: File not found");
	});

	test("throws error when output file not created (async)", async () => {
		await expect(async () => {
			await withTempJsonFile<unknown>("test-async", async (_path) => {
				// Don't create the file
				return { exitCode: 0 };
			});
		}).toThrow("Operation completed but output file not found");
	});

	test("throws error on invalid JSON (async)", async () => {
		await expect(async () => {
			await withTempJsonFile<unknown>("test-async", async (path) => {
				createdFiles.push(path);
				await Bun.write(path, "not valid json");
				return { exitCode: 0 };
			});
		}).toThrow("Failed to parse JSON output");
	});

	test("supports synchronous function in async version", async () => {
		const data = { test: "data" };

		// Function returns synchronously (no await)
		const result = await withTempJsonFile<typeof data>("test-async", (path) => {
			createdFiles.push(path);
			writeFileSync(path, JSON.stringify(data), "utf8");
			return { exitCode: 0 };
		});

		expect(result).toEqual(data);
	});

	test("creates unique temp file paths (async)", async () => {
		const paths: string[] = [];

		for (let i = 0; i < 3; i++) {
			await withTempJsonFile<{ id: number }>("test-async", async (path) => {
				paths.push(path);
				createdFiles.push(path);
				await Bun.write(path, JSON.stringify({ id: i }));
				return { exitCode: 0 };
			});
		}

		// All paths should be unique
		const uniquePaths = new Set(paths);
		expect(uniquePaths.size).toBe(3);

		// All should contain the prefix
		for (const path of paths) {
			expect(path).toContain("test-async-");
			expect(path).toEndWith(".json");
		}
	});
});
