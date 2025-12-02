/**
 * Tests for plugin.json validator
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validatePluginJson } from "./plugin-json.ts";

const TEST_ROOT = join(import.meta.dir, "test-fixtures", "plugin-json");

/**
 * Helper to create a test plugin directory with plugin.json
 */
function createTestPlugin(name: string, pluginJson: object | null): string {
	const pluginRoot = join(TEST_ROOT, name);

	// Clean up if exists
	if (existsSync(pluginRoot)) {
		rmSync(pluginRoot, { recursive: true });
	}

	// Create plugin directory structure
	mkdirSync(pluginRoot, { recursive: true });
	mkdirSync(join(pluginRoot, ".claude-plugin"), { recursive: true });

	// Write plugin.json if provided
	if (pluginJson !== null) {
		writeFileSync(
			join(pluginRoot, ".claude-plugin", "plugin.json"),
			JSON.stringify(pluginJson, null, "\t"),
		);
	}

	return pluginRoot;
}

/**
 * Helper to create referenced files
 */
function createReferencedFile(pluginRoot: string, path: string): void {
	const fullPath = join(pluginRoot, path);
	const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
	mkdirSync(dir, { recursive: true });
	writeFileSync(fullPath, "");
}

/**
 * Cleanup after all tests
 */
function cleanup(): void {
	if (existsSync(TEST_ROOT)) {
		rmSync(TEST_ROOT, { recursive: true });
	}
}

describe("validatePluginJson", () => {
	describe("missing plugin.json", () => {
		test("should return no issues if plugin.json doesn't exist", async () => {
			const pluginRoot = createTestPlugin("no-plugin-json", null);

			const issues = await validatePluginJson({ pluginRoot });

			expect(issues).toHaveLength(0);

			cleanup();
		});
	});

	describe("parse errors", () => {
		test("should report parse error for invalid JSON", async () => {
			const pluginRoot = join(TEST_ROOT, "invalid-json");
			mkdirSync(pluginRoot, { recursive: true });
			mkdirSync(join(pluginRoot, ".claude-plugin"), { recursive: true });

			// Write invalid JSON
			writeFileSync(
				join(pluginRoot, ".claude-plugin", "plugin.json"),
				"{ invalid json }",
			);

			const issues = await validatePluginJson({ pluginRoot });

			expect(issues).toHaveLength(1);
			expect(issues[0]?.ruleId).toBe("plugin/parse-error");
			expect(issues[0]?.severity).toBe("error");

			cleanup();
		});
	});

	describe("required fields", () => {
		test("should require 'name' field", async () => {
			const pluginRoot = createTestPlugin("missing-name", {
				version: "1.0.0",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const nameIssue = issues.find((i) => i.ruleId === "plugin/missing-name");
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");

			cleanup();
		});

		test("should require 'name' to be a string", async () => {
			const pluginRoot = createTestPlugin("invalid-name-type", {
				name: 123,
			});

			const issues = await validatePluginJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-name-type",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("name format validation", () => {
		test("should accept valid kebab-case names", async () => {
			const validNames = [
				"my-plugin",
				"git-tools",
				"code-review",
				"tool123",
				"a-b-c-d",
			];

			for (const name of validNames) {
				const pluginRoot = createTestPlugin(`valid-${name}`, { name });
				const issues = await validatePluginJson({ pluginRoot });

				const nameIssues = issues.filter((i) =>
					i.ruleId.startsWith("plugin/invalid-name"),
				);
				expect(nameIssues).toHaveLength(0);
			}

			cleanup();
		});

		test("should reject names with uppercase letters", async () => {
			const pluginRoot = createTestPlugin("uppercase-name", {
				name: "MyPlugin",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-name-format",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");
			expect(nameIssue?.message).toContain("kebab-case");

			cleanup();
		});

		test("should reject names with spaces", async () => {
			const pluginRoot = createTestPlugin("space-name", {
				name: "my plugin",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-name-format",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");

			cleanup();
		});

		test("should reject names with underscores", async () => {
			const pluginRoot = createTestPlugin("underscore-name", {
				name: "my_plugin",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-name-format",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");

			cleanup();
		});

		test("should reject names exceeding 64 characters", async () => {
			const longName = "a".repeat(65);
			const pluginRoot = createTestPlugin("long-name", {
				name: longName,
			});

			const issues = await validatePluginJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-name-format",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");
			expect(nameIssue?.message).toContain("64 characters");

			cleanup();
		});
	});

	describe("version validation", () => {
		test("should warn if version is missing", async () => {
			const pluginRoot = createTestPlugin("no-version", {
				name: "my-plugin",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const versionIssue = issues.find(
				(i) => i.ruleId === "plugin/missing-version",
			);
			expect(versionIssue).toBeDefined();
			expect(versionIssue?.severity).toBe("warning");

			cleanup();
		});

		test("should accept valid semver versions", async () => {
			const validVersions = [
				"1.0.0",
				"2.1.3",
				"0.0.1",
				"1.2.3-beta.1",
				"2.0.0-rc.1",
				"1.0.0+build.123",
			];

			for (const version of validVersions) {
				const pluginRoot = createTestPlugin(`version-${version}`, {
					name: "my-plugin",
					version,
				});
				const issues = await validatePluginJson({ pluginRoot });

				const versionIssues = issues.filter((i) =>
					i.ruleId.startsWith("plugin/invalid-version"),
				);
				expect(versionIssues).toHaveLength(0);
			}

			cleanup();
		});

		test("should warn for invalid semver format", async () => {
			const pluginRoot = createTestPlugin("invalid-version", {
				name: "my-plugin",
				version: "v1.0",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const versionIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-version",
			);
			expect(versionIssue).toBeDefined();
			expect(versionIssue?.severity).toBe("warning");

			cleanup();
		});

		test("should error if version is not a string", async () => {
			const pluginRoot = createTestPlugin("version-not-string", {
				name: "my-plugin",
				version: 1.0,
			});

			const issues = await validatePluginJson({ pluginRoot });

			const versionIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-version-type",
			);
			expect(versionIssue).toBeDefined();
			expect(versionIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("description validation", () => {
		test("should warn if description is missing", async () => {
			const pluginRoot = createTestPlugin("no-description", {
				name: "my-plugin",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const descIssue = issues.find(
				(i) => i.ruleId === "plugin/missing-description",
			);
			expect(descIssue).toBeDefined();
			expect(descIssue?.severity).toBe("warning");

			cleanup();
		});

		test("should warn if description exceeds 256 characters", async () => {
			const longDesc = "a".repeat(257);
			const pluginRoot = createTestPlugin("long-description", {
				name: "my-plugin",
				description: longDesc,
			});

			const issues = await validatePluginJson({ pluginRoot });

			const descIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-description",
			);
			expect(descIssue).toBeDefined();
			expect(descIssue?.severity).toBe("warning");

			cleanup();
		});

		test("should error if description is not a string", async () => {
			const pluginRoot = createTestPlugin("description-not-string", {
				name: "my-plugin",
				description: 123,
			});

			const issues = await validatePluginJson({ pluginRoot });

			const descIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-description-type",
			);
			expect(descIssue).toBeDefined();
			expect(descIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("author validation", () => {
		test("should warn if author is missing", async () => {
			const pluginRoot = createTestPlugin("no-author", {
				name: "my-plugin",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const authorIssue = issues.find(
				(i) => i.ruleId === "plugin/missing-author",
			);
			expect(authorIssue).toBeDefined();
			expect(authorIssue?.severity).toBe("warning");

			cleanup();
		});

		test("should accept author as string", async () => {
			const pluginRoot = createTestPlugin("author-string", {
				name: "my-plugin",
				author: "John Doe",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const authorIssues = issues.filter((i) =>
				i.ruleId.startsWith("plugin/invalid-author"),
			);
			expect(authorIssues).toHaveLength(0);

			cleanup();
		});

		test("should accept author as object with name", async () => {
			const pluginRoot = createTestPlugin("author-object", {
				name: "my-plugin",
				author: {
					name: "John Doe",
					email: "john@example.com",
				},
			});

			const issues = await validatePluginJson({ pluginRoot });

			const authorIssues = issues.filter((i) =>
				i.ruleId.startsWith("plugin/invalid-author"),
			);
			expect(authorIssues).toHaveLength(0);

			cleanup();
		});

		test("should error if author object is missing name", async () => {
			const pluginRoot = createTestPlugin("author-no-name", {
				name: "my-plugin",
				author: {
					email: "john@example.com",
				},
			});

			const issues = await validatePluginJson({ pluginRoot });

			const authorIssue = issues.find(
				(i) => i.ruleId === "plugin/missing-author-name",
			);
			expect(authorIssue).toBeDefined();
			expect(authorIssue?.severity).toBe("error");

			cleanup();
		});

		test("should error if author is invalid type", async () => {
			const pluginRoot = createTestPlugin("author-invalid", {
				name: "my-plugin",
				author: 123,
			});

			const issues = await validatePluginJson({ pluginRoot });

			const authorIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-author-type",
			);
			expect(authorIssue).toBeDefined();
			expect(authorIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("homepage URL validation", () => {
		test("should accept valid homepage URL", async () => {
			const pluginRoot = createTestPlugin("valid-homepage", {
				name: "my-plugin",
				homepage: "https://example.com",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const homepageIssues = issues.filter((i) =>
				i.ruleId.startsWith("plugin/invalid-homepage"),
			);
			expect(homepageIssues).toHaveLength(0);

			cleanup();
		});

		test("should error for invalid homepage URL", async () => {
			const pluginRoot = createTestPlugin("invalid-homepage", {
				name: "my-plugin",
				homepage: "not a url",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const homepageIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-homepage-url",
			);
			expect(homepageIssue).toBeDefined();
			expect(homepageIssue?.severity).toBe("error");
			expect(homepageIssue?.message).toContain("not a url");
			expect(homepageIssue?.suggestion).toContain("https://");

			cleanup();
		});

		test("should error if homepage is not a string", async () => {
			const pluginRoot = createTestPlugin("homepage-not-string", {
				name: "my-plugin",
				homepage: 123,
			});

			const issues = await validatePluginJson({ pluginRoot });

			const homepageIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-homepage-type",
			);
			expect(homepageIssue).toBeDefined();
			expect(homepageIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("repository URL validation", () => {
		test("should accept valid repository URL (string format)", async () => {
			const pluginRoot = createTestPlugin("valid-repo-string", {
				name: "my-plugin",
				repository: "https://github.com/user/repo",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const repoIssues = issues.filter((i) =>
				i.ruleId.startsWith("plugin/invalid-repository"),
			);
			expect(repoIssues).toHaveLength(0);

			cleanup();
		});

		test("should error for invalid repository URL (string format)", async () => {
			const pluginRoot = createTestPlugin("invalid-repo-string", {
				name: "my-plugin",
				repository: "not-a-url",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const repoIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-repository-url",
			);
			expect(repoIssue).toBeDefined();
			expect(repoIssue?.severity).toBe("error");
			expect(repoIssue?.message).toContain("not-a-url");
			expect(repoIssue?.suggestion).toContain("https://");

			cleanup();
		});

		test("should accept valid repository URL (object format)", async () => {
			const pluginRoot = createTestPlugin("valid-repo-object", {
				name: "my-plugin",
				repository: {
					type: "git",
					url: "https://github.com/user/repo",
				},
			});

			const issues = await validatePluginJson({ pluginRoot });

			const repoIssues = issues.filter((i) =>
				i.ruleId.startsWith("plugin/invalid-repository"),
			);
			expect(repoIssues).toHaveLength(0);

			cleanup();
		});

		test("should error for invalid repository.url (object format)", async () => {
			const pluginRoot = createTestPlugin("invalid-repo-object", {
				name: "my-plugin",
				repository: {
					type: "git",
					url: "invalid-url",
				},
			});

			const issues = await validatePluginJson({ pluginRoot });

			const repoIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-repository-url",
			);
			expect(repoIssue).toBeDefined();
			expect(repoIssue?.severity).toBe("error");
			expect(repoIssue?.message).toContain("invalid-url");

			cleanup();
		});

		test("should error if repository object missing url", async () => {
			const pluginRoot = createTestPlugin("repo-missing-url", {
				name: "my-plugin",
				repository: {
					type: "git",
				},
			});

			const issues = await validatePluginJson({ pluginRoot });

			const repoIssue = issues.find(
				(i) => i.ruleId === "plugin/missing-repository-url",
			);
			expect(repoIssue).toBeDefined();
			expect(repoIssue?.severity).toBe("error");

			cleanup();
		});

		test("should error if repository.url is not a string", async () => {
			const pluginRoot = createTestPlugin("repo-url-not-string", {
				name: "my-plugin",
				repository: {
					type: "git",
					url: 123,
				},
			});

			const issues = await validatePluginJson({ pluginRoot });

			const repoIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-repository-url-type",
			);
			expect(repoIssue).toBeDefined();
			expect(repoIssue?.severity).toBe("error");

			cleanup();
		});

		test("should error if repository is invalid type", async () => {
			const pluginRoot = createTestPlugin("repo-invalid-type", {
				name: "my-plugin",
				repository: 123,
			});

			const issues = await validatePluginJson({ pluginRoot });

			const repoIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-repository-type",
			);
			expect(repoIssue).toBeDefined();
			expect(repoIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("recommended fields", () => {
		test("should warn if repository is missing", async () => {
			const pluginRoot = createTestPlugin("no-repo", {
				name: "my-plugin",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const repoIssue = issues.find(
				(i) => i.ruleId === "plugin/missing-repository",
			);
			expect(repoIssue).toBeDefined();
			expect(repoIssue?.severity).toBe("warning");

			cleanup();
		});

		test("should warn if license is missing", async () => {
			const pluginRoot = createTestPlugin("no-license", {
				name: "my-plugin",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const licenseIssue = issues.find(
				(i) => i.ruleId === "plugin/missing-license",
			);
			expect(licenseIssue).toBeDefined();
			expect(licenseIssue?.severity).toBe("warning");

			cleanup();
		});

		test("should warn if keywords is missing", async () => {
			const pluginRoot = createTestPlugin("no-keywords", {
				name: "my-plugin",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const keywordsIssue = issues.find(
				(i) => i.ruleId === "plugin/missing-keywords",
			);
			expect(keywordsIssue).toBeDefined();
			expect(keywordsIssue?.severity).toBe("warning");

			cleanup();
		});

		test("should warn if keywords is empty array", async () => {
			const pluginRoot = createTestPlugin("empty-keywords", {
				name: "my-plugin",
				keywords: [],
			});

			const issues = await validatePluginJson({ pluginRoot });

			const keywordsIssue = issues.find(
				(i) => i.ruleId === "plugin/missing-keywords",
			);
			expect(keywordsIssue).toBeDefined();
			expect(keywordsIssue?.severity).toBe("warning");

			cleanup();
		});

		test("should error if keywords is not an array", async () => {
			const pluginRoot = createTestPlugin("keywords-not-array", {
				name: "my-plugin",
				keywords: "git,mcp",
			});

			const issues = await validatePluginJson({ pluginRoot });

			const keywordsIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-keywords-type",
			);
			expect(keywordsIssue).toBeDefined();
			expect(keywordsIssue?.severity).toBe("error");

			cleanup();
		});

		test("should error if keyword is not a string", async () => {
			const pluginRoot = createTestPlugin("keyword-not-string", {
				name: "my-plugin",
				keywords: ["git", 123, "mcp"],
			});

			const issues = await validatePluginJson({ pluginRoot });

			const keywordIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-keyword-type",
			);
			expect(keywordIssue).toBeDefined();
			expect(keywordIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("component path validation", () => {
		test("should validate commands path exists", async () => {
			const pluginRoot = createTestPlugin("commands-missing", {
				name: "my-plugin",
				commands: ["./commands/test.md"],
			});

			const issues = await validatePluginJson({ pluginRoot });

			const pathIssue = issues.find(
				(i) => i.ruleId === "plugin/referenced-file-not-found",
			);
			expect(pathIssue).toBeDefined();
			expect(pathIssue?.severity).toBe("error");
			expect(pathIssue?.message).toContain("commands");

			cleanup();
		});

		test("should accept existing commands files", async () => {
			const pluginRoot = createTestPlugin("commands-exist", {
				name: "my-plugin",
				commands: ["./commands/test.md"],
			});
			createReferencedFile(pluginRoot, "commands/test.md");

			const issues = await validatePluginJson({ pluginRoot });

			const pathIssues = issues.filter(
				(i) => i.ruleId === "plugin/referenced-file-not-found",
			);
			expect(pathIssues).toHaveLength(0);

			cleanup();
		});

		test("should validate skills path exists", async () => {
			const pluginRoot = createTestPlugin("skills-missing", {
				name: "my-plugin",
				skills: ["./skills/my-skill"],
			});

			const issues = await validatePluginJson({ pluginRoot });

			const pathIssue = issues.find(
				(i) => i.ruleId === "plugin/referenced-file-not-found",
			);
			expect(pathIssue).toBeDefined();
			expect(pathIssue?.message).toContain("skills");

			cleanup();
		});

		test("should validate hooks path exists (non-standard hooks file)", async () => {
			const pluginRoot = createTestPlugin("hooks-missing", {
				name: "my-plugin",
				hooks: ["./hooks/custom-hooks.json"],
			});

			const issues = await validatePluginJson({ pluginRoot });

			const pathIssue = issues.find(
				(i) => i.ruleId === "plugin/referenced-file-not-found",
			);
			expect(pathIssue).toBeDefined();
			expect(pathIssue?.message).toContain("hooks");

			cleanup();
		});

		test("should validate mcpServers path exists", async () => {
			const pluginRoot = createTestPlugin("mcp-missing", {
				name: "my-plugin",
				mcpServers: ["./.mcp.json"],
			});

			const issues = await validatePluginJson({ pluginRoot });

			const pathIssue = issues.find(
				(i) => i.ruleId === "plugin/referenced-file-not-found",
			);
			expect(pathIssue).toBeDefined();
			expect(pathIssue?.message).toContain("mcpServers");

			cleanup();
		});

		test("should validate agents path exists", async () => {
			const pluginRoot = createTestPlugin("agents-missing", {
				name: "my-plugin",
				agents: ["./agents/my-agent"],
			});

			const issues = await validatePluginJson({ pluginRoot });

			const pathIssue = issues.find(
				(i) => i.ruleId === "plugin/referenced-file-not-found",
			);
			expect(pathIssue).toBeDefined();
			expect(pathIssue?.message).toContain("agents");

			cleanup();
		});

		test("should handle string format for component paths", async () => {
			const pluginRoot = createTestPlugin("commands-string", {
				name: "my-plugin",
				commands: "./commands/test.md",
			});
			createReferencedFile(pluginRoot, "commands/test.md");

			const issues = await validatePluginJson({ pluginRoot });

			const pathIssues = issues.filter(
				(i) => i.ruleId === "plugin/referenced-file-not-found",
			);
			expect(pathIssues).toHaveLength(0);

			cleanup();
		});

		test("should error if path doesn't start with ./", async () => {
			const pluginRoot = createTestPlugin("invalid-path-format", {
				name: "my-plugin",
				commands: ["commands/test.md"],
			});

			const issues = await validatePluginJson({ pluginRoot });

			const pathIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-path-format",
			);
			expect(pathIssue).toBeDefined();
			expect(pathIssue?.severity).toBe("error");
			expect(pathIssue?.message).toContain("./");

			cleanup();
		});

		test("should error if path is not a string", async () => {
			const pluginRoot = createTestPlugin("path-not-string", {
				name: "my-plugin",
				commands: [123],
			});

			const issues = await validatePluginJson({ pluginRoot });

			const pathIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-path-type",
			);
			expect(pathIssue).toBeDefined();
			expect(pathIssue?.severity).toBe("error");

			cleanup();
		});

		test("should validate multiple paths in array", async () => {
			const pluginRoot = createTestPlugin("multiple-commands", {
				name: "my-plugin",
				commands: ["./commands/test1.md", "./commands/test2.md"],
			});
			createReferencedFile(pluginRoot, "commands/test1.md");
			createReferencedFile(pluginRoot, "commands/test2.md");

			const issues = await validatePluginJson({ pluginRoot });

			const pathIssues = issues.filter(
				(i) => i.ruleId === "plugin/referenced-file-not-found",
			);
			expect(pathIssues).toHaveLength(0);

			cleanup();
		});
	});

	describe("file extension validation", () => {
		test("should error if command file doesn't have .md extension", async () => {
			const pluginRoot = createTestPlugin("invalid-command-extension", {
				name: "my-plugin",
				commands: ["./commands/test.txt"],
			});
			createReferencedFile(pluginRoot, "commands/test.txt");

			const issues = await validatePluginJson({ pluginRoot });

			const extIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-command-extension",
			);
			expect(extIssue).toBeDefined();
			expect(extIssue?.severity).toBe("error");
			expect(extIssue?.message).toContain(".md");

			cleanup();
		});

		test("should error if mcpServer file doesn't have .json extension", async () => {
			const pluginRoot = createTestPlugin("invalid-mcp-extension", {
				name: "my-plugin",
				mcpServers: ["./mcp-config.txt"],
			});
			createReferencedFile(pluginRoot, "mcp-config.txt");

			const issues = await validatePluginJson({ pluginRoot });

			const extIssue = issues.find(
				(i) => i.ruleId === "plugin/invalid-mcp-server-extension",
			);
			expect(extIssue).toBeDefined();
			expect(extIssue?.severity).toBe("error");
			expect(extIssue?.message).toContain(".json");

			cleanup();
		});
	});

	describe("hooks validation", () => {
		test("should error if referencing standard hooks/hooks.json file", async () => {
			const pluginRoot = createTestPlugin("duplicate-hooks", {
				name: "my-plugin",
				hooks: ["./hooks/hooks.json"],
			});
			createReferencedFile(pluginRoot, "hooks/hooks.json");

			const issues = await validatePluginJson({ pluginRoot });

			const hooksIssue = issues.find(
				(i) => i.ruleId === "plugin/duplicate-hooks-file",
			);
			expect(hooksIssue).toBeDefined();
			expect(hooksIssue?.severity).toBe("error");
			expect(hooksIssue?.message).toContain("loaded automatically");
			expect(hooksIssue?.suggestion).toContain(
				"Remove './hooks/hooks.json' from the hooks array",
			);

			cleanup();
		});

		test("should allow referencing additional hooks files", async () => {
			const pluginRoot = createTestPlugin("additional-hooks", {
				name: "my-plugin",
				hooks: ["./hooks/custom-hooks.json"],
			});
			createReferencedFile(pluginRoot, "hooks/custom-hooks.json");

			const issues = await validatePluginJson({ pluginRoot });

			const hooksIssues = issues.filter(
				(i) => i.ruleId === "plugin/duplicate-hooks-file",
			);
			expect(hooksIssues).toHaveLength(0);

			cleanup();
		});
	});

	describe("complete valid plugin", () => {
		test("should pass validation for complete plugin.json", async () => {
			const pluginRoot = createTestPlugin("complete-plugin", {
				name: "my-plugin",
				version: "1.0.0",
				description: "A test plugin",
				author: {
					name: "John Doe",
					email: "john@example.com",
				},
				repository: "https://github.com/user/repo",
				license: "MIT",
				keywords: ["test", "plugin"],
				commands: ["./commands/test.md"],
				skills: ["./skills/my-skill"],
				mcpServers: ["./.mcp.json"],
			});

			// Create referenced files
			createReferencedFile(pluginRoot, "commands/test.md");
			createReferencedFile(pluginRoot, "skills/my-skill");
			createReferencedFile(pluginRoot, ".mcp.json");

			const issues = await validatePluginJson({ pluginRoot });

			// Should have no errors or warnings (only recommended field warnings)
			const errors = issues.filter((i) => i.severity === "error");
			expect(errors).toHaveLength(0);

			cleanup();
		});
	});
});
