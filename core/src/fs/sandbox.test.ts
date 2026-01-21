/**
 * Tests for sandbox path security utilities
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	resolveSandboxedPath,
	validateConfigPath,
	validateFilenameForSubprocess,
} from "./sandbox.js";

describe("resolveSandboxedPath", () => {
	let tempRoot: string;

	beforeEach(() => {
		tempRoot = `/tmp/sandbox-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		mkdirSync(tempRoot, { recursive: true });
	});

	afterEach(() => {
		try {
			rmSync(tempRoot, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	test("resolves relative paths within sandbox", () => {
		const result = resolveSandboxedPath(tempRoot, "Projects/Note.md");
		expect(result.absolute).toBe(join(tempRoot, "Projects/Note.md"));
		expect(result.relative).toBe("Projects/Note.md");
	});

	test("resolves nested paths", () => {
		const result = resolveSandboxedPath(tempRoot, "folder/subfolder/file.txt");
		expect(result.absolute).toBe(join(tempRoot, "folder/subfolder/file.txt"));
		expect(result.relative).toBe("folder/subfolder/file.txt");
	});

	test("allows exact root match", () => {
		const result = resolveSandboxedPath(tempRoot, ".");
		expect(result.absolute).toBe(tempRoot);
		expect(result.relative).toBe(".");
	});

	test("handles default input path (dot)", () => {
		const result = resolveSandboxedPath(tempRoot);
		expect(result.absolute).toBe(tempRoot);
		expect(result.relative).toBe(".");
	});

	test("rejects path traversal with ../", () => {
		expect(() => resolveSandboxedPath(tempRoot, "../etc/passwd")).toThrow(
			"Path escapes sandbox",
		);
		expect(() => resolveSandboxedPath(tempRoot, "../outside")).toThrow(
			"Path escapes sandbox",
		);
	});

	test("rejects path traversal from nested paths", () => {
		expect(() =>
			resolveSandboxedPath(tempRoot, "folder/../../etc/passwd"),
		).toThrow("Path escapes sandbox");
		expect(() => resolveSandboxedPath(tempRoot, "a/b/c/../../../..")).toThrow(
			"Path escapes sandbox",
		);
	});

	test("rejects absolute paths outside sandbox", () => {
		expect(() => resolveSandboxedPath(tempRoot, "/etc/passwd")).toThrow(
			"Path escapes sandbox",
		);
		expect(() => resolveSandboxedPath(tempRoot, "/tmp/other")).toThrow(
			"Path escapes sandbox",
		);
	});

	test("normalizes redundant separators", () => {
		const result = resolveSandboxedPath(tempRoot, "folder//file.md");
		expect(result.relative).toBe("folder/file.md");
	});

	test("normalizes dot segments", () => {
		const result = resolveSandboxedPath(tempRoot, "./folder/./file.md");
		expect(result.relative).toBe("folder/file.md");
	});

	test("handles Windows-style paths", () => {
		// Windows backslashes converted to forward slashes by path.resolve
		const result = resolveSandboxedPath(tempRoot, "folder\\file.md");
		expect(result.absolute).toContain("folder");
		expect(result.absolute).toContain("file.md");
	});

	test("rejects Windows-style path traversal", () => {
		expect(() => resolveSandboxedPath(tempRoot, "..\\etc\\passwd")).toThrow(
			"Path escapes sandbox",
		);
	});

	test("handles symlinks within sandbox", () => {
		// Create a symlink pointing to another location within sandbox
		const linkPath = join(tempRoot, "link");
		const targetPath = join(tempRoot, "target");
		mkdirSync(targetPath, { recursive: true });

		try {
			symlinkSync(targetPath, linkPath);

			// Should resolve through symlink and still be within sandbox
			const result = resolveSandboxedPath(tempRoot, "link");
			expect(result.absolute).toBeDefined();
		} catch (err) {
			// Skip test if we can't create symlinks (permissions)
			if ((err as NodeJS.ErrnoException).code === "EPERM") {
				console.warn("Skipping symlink test (insufficient permissions)");
			} else {
				throw err;
			}
		}
	});

	test("prevents symlink escape attempts", () => {
		// Create a symlink pointing outside the sandbox
		const linkPath = join(tempRoot, "escape-link");
		const outsidePath = "/tmp";

		try {
			symlinkSync(outsidePath, linkPath);

			// Symlink itself is allowed (as it's within sandbox boundary)
			// But following it and going deeper would escape
			// Test by trying to access a file through the symlink outside sandbox
			expect(() =>
				resolveSandboxedPath(tempRoot, "escape-link/../../../etc/passwd"),
			).toThrow("Path escapes sandbox");
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "EPERM") {
				console.warn("Skipping symlink escape test (insufficient permissions)");
			} else {
				throw err;
			}
		}
	});

	test("handles non-existent paths", () => {
		// Should validate even if path doesn't exist yet
		const result = resolveSandboxedPath(tempRoot, "nonexistent/folder/file.md");
		expect(result.relative).toBe("nonexistent/folder/file.md");
	});

	test("handles empty string as root", () => {
		const result = resolveSandboxedPath(tempRoot, "");
		expect(result.absolute).toBe(tempRoot);
		expect(result.relative).toBe(".");
	});

	test("rejects path that becomes outside after resolution", () => {
		// Even if path looks innocent, resolved path must stay inside
		const sneaky = `${tempRoot}/../etc/passwd`;
		expect(() => resolveSandboxedPath(tempRoot, sneaky)).toThrow(
			"Path escapes sandbox",
		);
	});
});

describe("validateConfigPath", () => {
	let tempRoot: string;
	const originalHome = process.env.HOME;
	const originalCwd = process.cwd;

	beforeEach(() => {
		tempRoot = `/tmp/config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		mkdirSync(tempRoot, { recursive: true });
	});

	afterEach(() => {
		try {
			rmSync(tempRoot, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		// Restore environment
		if (originalHome) {
			process.env.HOME = originalHome;
		}
		process.cwd = originalCwd;
	});

	test("accepts paths in home config directory", () => {
		const home = process.env.HOME ?? process.env.USERPROFILE;
		if (!home) {
			console.warn("Skipping home config test (no HOME env)");
			return;
		}

		const configPath = join(home, ".config/app/config.json");
		expect(validateConfigPath(configPath)).toBe(true);
	});

	test("accepts paths in current working directory", () => {
		const cwd = process.cwd();
		const configPath = join(cwd, ".apprc");
		expect(validateConfigPath(configPath)).toBe(true);
	});

	test("accepts paths in custom allowed roots", () => {
		const configPath = join(tempRoot, "config.json");
		expect(validateConfigPath(configPath, [tempRoot])).toBe(true);
	});

	test("accepts nested paths in allowed roots", () => {
		const configPath = join(tempRoot, "nested/config.json");
		expect(validateConfigPath(configPath, [tempRoot])).toBe(true);
	});

	test("rejects path traversal with ..", () => {
		expect(validateConfigPath("../../etc/passwd")).toBe(false);
		expect(validateConfigPath("../outside")).toBe(false);
	});

	test("rejects absolute paths outside allowed locations", () => {
		expect(validateConfigPath("/etc/secrets")).toBe(false);
		expect(validateConfigPath("/tmp/evil.json")).toBe(false);
	});

	test("rejects paths with traversal sequences", () => {
		const cwd = process.cwd();
		const dangerous = join(cwd, "../../../etc/passwd");
		expect(validateConfigPath(dangerous)).toBe(false);
	});

	test("handles tilde paths as relative (not expanded)", () => {
		// Tilde is not expanded by path.resolve, so "~/secrets" becomes cwd/~/secrets
		// This is actually safe as it stays within cwd
		const cwd = process.cwd();
		const tildeRelative = "~/secrets";
		const resolved = join(cwd, tildeRelative);

		// If tilde path resolves within cwd, it's allowed
		expect(validateConfigPath(tildeRelative)).toBe(resolved.startsWith(cwd));
	});

	test("handles double-slash tricks", () => {
		// Double slashes should not bypass validation
		expect(validateConfigPath("//etc/passwd")).toBe(false);
	});

	test("accepts relative paths within cwd", () => {
		expect(validateConfigPath("./.apprc")).toBe(true);
		expect(validateConfigPath("config/app.json")).toBe(true);
	});

	test("handles Windows-style paths", () => {
		const cwd = process.cwd();
		const winPath = join(cwd, "config\\app.json");
		expect(validateConfigPath(winPath)).toBe(true);
	});

	test("accepts empty string (resolves to cwd)", () => {
		// Empty string resolves to current working directory, which is allowed
		expect(validateConfigPath("")).toBe(true);
	});

	test("handles multiple allowed roots", () => {
		const root1 = join(tempRoot, "root1");
		const root2 = join(tempRoot, "root2");
		mkdirSync(root1, { recursive: true });
		mkdirSync(root2, { recursive: true });

		expect(validateConfigPath(join(root1, "config.json"), [root1, root2])).toBe(
			true,
		);
		expect(validateConfigPath(join(root2, "config.json"), [root1, root2])).toBe(
			true,
		);

		// Outside both roots
		expect(
			validateConfigPath(join(tempRoot, "root3/config.json"), [root1, root2]),
		).toBe(false);
	});

	test("canonicalizes paths before checking", () => {
		// Create actual path structure
		const configDir = join(tempRoot, ".config");
		mkdirSync(configDir, { recursive: true });
		const configPath = join(configDir, "config.json");
		writeFileSync(configPath, "{}");

		// Test with redundant separators
		const redundant = configPath.replace(/\//g, "//");
		expect(validateConfigPath(redundant, [tempRoot])).toBe(true);
	});

	test("handles symlink paths", () => {
		const configDir = join(tempRoot, "config");
		const linkPath = join(tempRoot, "config-link");
		mkdirSync(configDir, { recursive: true });

		try {
			symlinkSync(configDir, linkPath);

			const configPath = join(linkPath, "app.json");
			expect(validateConfigPath(configPath, [tempRoot])).toBe(true);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "EPERM") {
				console.warn("Skipping config symlink test (insufficient permissions)");
			} else {
				throw err;
			}
		}
	});
});

describe("validateFilenameForSubprocess", () => {
	test("accepts valid alphanumeric filenames", () => {
		expect(() => validateFilenameForSubprocess("file123.txt")).not.toThrow();
		expect(() => validateFilenameForSubprocess("MyDocument.pdf")).not.toThrow();
		expect(() =>
			validateFilenameForSubprocess("report2024.docx"),
		).not.toThrow();
	});

	test("accepts filenames with underscores", () => {
		expect(() =>
			validateFilenameForSubprocess("my_file_name.txt"),
		).not.toThrow();
		expect(() => validateFilenameForSubprocess("data_v2.csv")).not.toThrow();
	});

	test("accepts filenames with hyphens", () => {
		expect(() =>
			validateFilenameForSubprocess("my-file-name.txt"),
		).not.toThrow();
		expect(() =>
			validateFilenameForSubprocess("invoice-2024.pdf"),
		).not.toThrow();
	});

	test("accepts filenames with dots", () => {
		expect(() => validateFilenameForSubprocess("file.txt")).not.toThrow();
		expect(() => validateFilenameForSubprocess("archive.tar.gz")).not.toThrow();
	});

	test("accepts filenames with spaces", () => {
		expect(() =>
			validateFilenameForSubprocess("Meeting Notes.md"),
		).not.toThrow();
		expect(() =>
			validateFilenameForSubprocess("Project Report 2024.pdf"),
		).not.toThrow();
	});

	test("accepts mixed valid characters", () => {
		expect(() =>
			validateFilenameForSubprocess("My_Document-v2.0 Final.pdf"),
		).not.toThrow();
	});

	test("rejects filenames with semicolons (command separator)", () => {
		expect(() => validateFilenameForSubprocess("file; rm -rf /")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with backticks (command substitution)", () => {
		expect(() => validateFilenameForSubprocess("file`whoami`.txt")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with dollar signs (variable expansion)", () => {
		expect(() => validateFilenameForSubprocess("file$USER.txt")).toThrow(
			"Invalid characters in filename",
		);
		expect(() =>
			validateFilenameForSubprocess("file$(cat /etc/passwd)"),
		).toThrow("Invalid characters in filename");
	});

	test("rejects filenames with pipes (command chaining)", () => {
		expect(() => validateFilenameForSubprocess("file | cat")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with ampersands (background execution)", () => {
		expect(() => validateFilenameForSubprocess("file & malware")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with greater-than/less-than (redirection)", () => {
		expect(() => validateFilenameForSubprocess("file > output")).toThrow(
			"Invalid characters in filename",
		);
		expect(() => validateFilenameForSubprocess("file < input")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with single quotes", () => {
		expect(() => validateFilenameForSubprocess("file'injection.txt")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with double quotes", () => {
		expect(() => validateFilenameForSubprocess('file"injection.txt')).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with backslashes", () => {
		expect(() => validateFilenameForSubprocess("file\\path.txt")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with forward slashes (path separator)", () => {
		expect(() => validateFilenameForSubprocess("folder/file.txt")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with newlines", () => {
		expect(() => validateFilenameForSubprocess("file\ninjection.txt")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with tabs", () => {
		expect(() => validateFilenameForSubprocess("file\tinjection.txt")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with asterisks (glob patterns)", () => {
		expect(() => validateFilenameForSubprocess("*.txt")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with question marks (glob patterns)", () => {
		expect(() => validateFilenameForSubprocess("file?.txt")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with square brackets (glob patterns)", () => {
		expect(() => validateFilenameForSubprocess("file[0-9].txt")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with parentheses", () => {
		expect(() => validateFilenameForSubprocess("file(1).txt")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with curly braces", () => {
		expect(() => validateFilenameForSubprocess("file{a,b}.txt")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects empty filenames", () => {
		expect(() => validateFilenameForSubprocess("")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("rejects filenames with only special characters", () => {
		expect(() => validateFilenameForSubprocess("!@#$%^&*()")).toThrow(
			"Invalid characters in filename",
		);
	});

	test("includes filename in error message", () => {
		try {
			validateFilenameForSubprocess("malicious;script");
		} catch (error) {
			expect((error as Error).message).toContain("malicious;script");
		}
	});
});
