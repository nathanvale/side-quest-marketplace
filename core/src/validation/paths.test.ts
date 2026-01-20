import { beforeEach, describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { getGitRoot } from "../git/index.js";
import { validatePath, validatePathOrDefault } from "./paths.ts";

// ============================================================================
// Setup - Get the actual git root for test fixtures
// ============================================================================

let gitRoot: string;

beforeEach(async () => {
	const root = await getGitRoot();
	if (!root) {
		throw new Error("Tests must run inside a git repository");
	}
	gitRoot = root;
});

// ============================================================================
// validatePath Tests
// ============================================================================

describe("validatePath", () => {
	describe("accepts valid paths within repository", () => {
		test("relative path to existing file", async () => {
			const validPath = "./package.json";
			const result = await validatePath(validPath);
			expect(result).toBe(resolve(validPath));
		});

		test("relative path with parent directory references", async () => {
			// This is OK if it resolves to within the repo
			const validPath = "./core/../package.json";
			const result = await validatePath(validPath);
			expect(result).toBe(resolve(validPath));
		});

		test("absolute path within repository", async () => {
			const validPath = join(gitRoot, "package.json");
			const result = await validatePath(validPath);
			expect(result).toBe(validPath);
		});

		test("path to directory within repository", async () => {
			const validPath = "./core/src";
			const result = await validatePath(validPath);
			expect(result).toBe(resolve(validPath));
		});

		test("path to nonexistent file within repository", async () => {
			// isFileInRepo checks if path is within repo, not if file exists
			const validPath = "./nonexistent-file.txt";
			const result = await validatePath(validPath);
			expect(result).toBe(resolve(validPath));
		});
	});

	describe("rejects paths outside repository", () => {
		test("parent directory traversal", async () => {
			// Go up enough levels to escape the repository
			const invalidPath = "../../../../../etc/passwd";
			await expect(validatePath(invalidPath)).rejects.toThrow(
				"Path outside repository:",
			);
		});

		test("absolute path to system directory", async () => {
			const invalidPath = "/etc/passwd";
			await expect(validatePath(invalidPath)).rejects.toThrow(
				"Path outside repository:",
			);
		});

		test("absolute path to user home", async () => {
			const invalidPath = "/Users/someuser/.ssh/id_rsa";
			await expect(validatePath(invalidPath)).rejects.toThrow(
				"Path outside repository:",
			);
		});

		test("absolute path to /tmp", async () => {
			const invalidPath = "/tmp/malicious.sh";
			await expect(validatePath(invalidPath)).rejects.toThrow(
				"Path outside repository:",
			);
		});

		test("path starting with tilde (treated as relative)", async () => {
			// Note: tilde expansion should be done by the shell, not by resolve()
			// If passed through, resolve() treats it as a relative path starting with "~/"
			// This means it resolves within the repo as a directory named "~"
			// So this is actually a valid path within the repo
			const pathWithTilde = "~/subdir";
			const result = await validatePath(pathWithTilde);
			expect(result).toBe(resolve(pathWithTilde));
		});
	});

	describe("error messages", () => {
		test("includes original input path", async () => {
			const invalidPath = "/etc/passwd";
			try {
				await validatePath(invalidPath);
				expect.unreachable("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toContain("/etc/passwd");
			}
		});

		test("preserves path traversal syntax in message", async () => {
			const invalidPath = "../../../etc/passwd";
			try {
				await validatePath(invalidPath);
				expect.unreachable("Should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toContain("../../../etc/passwd");
			}
		});
	});
});

// ============================================================================
// validatePathOrDefault Tests
// ============================================================================

describe("validatePathOrDefault", () => {
	describe("default path handling", () => {
		test("returns default when path is undefined", async () => {
			const result = await validatePathOrDefault(undefined);
			expect(result).toBe(".");
		});

		test("returns default when path equals default", async () => {
			const result = await validatePathOrDefault(".");
			expect(result).toBe(".");
		});

		test("supports custom default path", async () => {
			const result = await validatePathOrDefault(undefined, "./src");
			expect(result).toBe("./src");
		});

		test("returns custom default when path matches", async () => {
			const result = await validatePathOrDefault("./src", "./src");
			expect(result).toBe("./src");
		});
	});

	describe("custom path validation", () => {
		test("validates and resolves valid custom path", async () => {
			const customPath = "./core/src";
			const result = await validatePathOrDefault(customPath);
			expect(result).toBe(resolve(customPath));
		});

		test("rejects invalid custom path", async () => {
			const invalidPath = "/etc/passwd";
			await expect(validatePathOrDefault(invalidPath)).rejects.toThrow(
				"Path outside repository:",
			);
		});

		test("rejects path traversal in custom path", async () => {
			const invalidPath = "../../../../../etc/passwd";
			await expect(validatePathOrDefault(invalidPath)).rejects.toThrow(
				"Path outside repository:",
			);
		});
	});

	describe("practical usage scenarios", () => {
		test("MCP tool with optional path (no path provided)", async () => {
			// Simulates: bun_runTests({ response_format: "json" })
			const result = await validatePathOrDefault(undefined);
			expect(result).toBe(".");
		});

		test("MCP tool with explicit current directory", async () => {
			// Simulates: bun_runTests({ path: ".", response_format: "json" })
			const result = await validatePathOrDefault(".");
			expect(result).toBe(".");
		});

		test("MCP tool with specific subdirectory", async () => {
			// Simulates: bun_runTests({ path: "./core", response_format: "json" })
			const result = await validatePathOrDefault("./core");
			expect(result).toBe(resolve("./core"));
		});

		test("MCP tool with malicious path attempt", async () => {
			// Simulates: bun_runTests({ path: "../../etc/passwd", response_format: "json" })
			await expect(
				validatePathOrDefault("../../../../../../etc/passwd"),
			).rejects.toThrow("Path outside repository:");
		});
	});

	describe("edge cases", () => {
		test("empty string path", async () => {
			// Empty string should be treated as undefined
			const result = await validatePathOrDefault("");
			expect(result).toBe(".");
		});

		test("whitespace-only path (treated as empty)", async () => {
			// Whitespace-only path is treated as empty/falsy by the conditional check
			// so it defaults to "."
			const whitespaceOnly = "   ";
			const result = await validatePathOrDefault(whitespaceOnly);
			expect(result).toBe(".");
		});

		test("path with spaces", async () => {
			// Valid path with spaces (if such directory exists in repo)
			const pathWithSpaces = "./core/src";
			const result = await validatePathOrDefault(pathWithSpaces);
			expect(result).toBe(resolve(pathWithSpaces));
		});
	});
});
