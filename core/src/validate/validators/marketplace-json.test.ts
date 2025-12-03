/**
 * Tests for marketplace.json validator
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateMarketplaceJson } from "./marketplace-json.ts";

const TEST_ROOT = join(import.meta.dir, "test-fixtures", "marketplace-json");

/**
 * Helper to create a test plugin directory with marketplace.json
 */
function createTestMarketplace(
	name: string,
	marketplaceJson: object | null,
): string {
	const pluginRoot = join(TEST_ROOT, name);

	// Clean up if exists
	if (existsSync(pluginRoot)) {
		rmSync(pluginRoot, { recursive: true });
	}

	// Create plugin directory structure
	mkdirSync(pluginRoot, { recursive: true });
	mkdirSync(join(pluginRoot, ".claude-plugin"), { recursive: true });

	// Write marketplace.json if provided
	if (marketplaceJson !== null) {
		writeFileSync(
			join(pluginRoot, ".claude-plugin", "marketplace.json"),
			JSON.stringify(marketplaceJson, null, "\t"),
		);
	}

	return pluginRoot;
}

/**
 * Helper to create plugin source directory
 */
function createPluginSource(pluginRoot: string, sourcePath: string): void {
	const fullPath = join(pluginRoot, sourcePath);
	mkdirSync(fullPath, { recursive: true });
}

/**
 * Cleanup after all tests
 */
function cleanup(): void {
	if (existsSync(TEST_ROOT)) {
		rmSync(TEST_ROOT, { recursive: true });
	}
}

describe("validateMarketplaceJson", () => {
	describe("missing marketplace.json", () => {
		test("should return no issues if marketplace.json doesn't exist", async () => {
			const pluginRoot = createTestMarketplace("no-marketplace-json", null);

			const issues = await validateMarketplaceJson({ pluginRoot });

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
				join(pluginRoot, ".claude-plugin", "marketplace.json"),
				"{ invalid json }",
			);

			const issues = await validateMarketplaceJson({ pluginRoot });

			expect(issues).toHaveLength(1);
			expect(issues[0]?.ruleId).toBe("marketplace/parse-error");
			expect(issues[0]?.severity).toBe("error");

			cleanup();
		});
	});

	describe("required fields", () => {
		test("should require 'name' field", async () => {
			const pluginRoot = createTestMarketplace("missing-name", {
				owner: { name: "Test", email: "test@example.com" },
				plugins: [],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "marketplace/missing-name",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");

			cleanup();
		});

		test("should require 'name' to be a string", async () => {
			const pluginRoot = createTestMarketplace("invalid-name-type", {
				name: 123,
				owner: { name: "Test", email: "test@example.com" },
				plugins: [],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-name-type",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");

			cleanup();
		});

		test("should require 'owner' field", async () => {
			const pluginRoot = createTestMarketplace("missing-owner", {
				name: "my-marketplace",
				plugins: [],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const ownerIssue = issues.find(
				(i) => i.ruleId === "marketplace/missing-owner",
			);
			expect(ownerIssue).toBeDefined();
			expect(ownerIssue?.severity).toBe("error");

			cleanup();
		});

		test("should require 'plugins' field", async () => {
			const pluginRoot = createTestMarketplace("missing-plugins", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const pluginsIssue = issues.find(
				(i) => i.ruleId === "marketplace/missing-plugins",
			);
			expect(pluginsIssue).toBeDefined();
			expect(pluginsIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("name format validation", () => {
		test("should accept valid kebab-case names", async () => {
			const validNames = [
				"my-marketplace",
				"side-quest-marketplace",
				"marketplace123",
				"a-b-c-d",
			];

			for (const name of validNames) {
				const pluginRoot = createTestMarketplace(`valid-${name}`, {
					name,
					owner: { name: "Test", email: "test@example.com" },
					plugins: [],
				});
				const issues = await validateMarketplaceJson({ pluginRoot });

				const nameIssues = issues.filter((i) =>
					i.ruleId.startsWith("marketplace/invalid-name"),
				);
				expect(nameIssues).toHaveLength(0);
			}

			cleanup();
		});

		test("should reject names with uppercase letters", async () => {
			const pluginRoot = createTestMarketplace("uppercase-name", {
				name: "MyMarketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-name-format",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");
			expect(nameIssue?.message).toContain("kebab-case");

			cleanup();
		});

		test("should reject names with spaces", async () => {
			const pluginRoot = createTestMarketplace("space-name", {
				name: "my marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-name-format",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");

			cleanup();
		});

		test("should reject names exceeding 64 characters", async () => {
			const longName = "a".repeat(65);
			const pluginRoot = createTestMarketplace("long-name", {
				name: longName,
				owner: { name: "Test", email: "test@example.com" },
				plugins: [],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-name-format",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");
			expect(nameIssue?.message).toContain("64 characters");

			cleanup();
		});
	});

	describe("owner validation", () => {
		test("should require owner to be an object", async () => {
			const pluginRoot = createTestMarketplace("owner-not-object", {
				name: "my-marketplace",
				owner: "John Doe",
				plugins: [],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const ownerIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-owner-type",
			);
			expect(ownerIssue).toBeDefined();
			expect(ownerIssue?.severity).toBe("error");

			cleanup();
		});

		test("should require owner.name", async () => {
			const pluginRoot = createTestMarketplace("owner-no-name", {
				name: "my-marketplace",
				owner: { email: "test@example.com" },
				plugins: [],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const ownerIssue = issues.find(
				(i) => i.ruleId === "marketplace/missing-owner-name",
			);
			expect(ownerIssue).toBeDefined();
			expect(ownerIssue?.severity).toBe("error");

			cleanup();
		});

		test("should require owner.email", async () => {
			const pluginRoot = createTestMarketplace("owner-no-email", {
				name: "my-marketplace",
				owner: { name: "John Doe" },
				plugins: [],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const ownerIssue = issues.find(
				(i) => i.ruleId === "marketplace/missing-owner-email",
			);
			expect(ownerIssue).toBeDefined();
			expect(ownerIssue?.severity).toBe("error");

			cleanup();
		});

		test("should warn for invalid email format", async () => {
			const pluginRoot = createTestMarketplace("owner-invalid-email", {
				name: "my-marketplace",
				owner: { name: "John Doe", email: "not-an-email" },
				plugins: [],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const emailIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-owner-email",
			);
			expect(emailIssue).toBeDefined();
			expect(emailIssue?.severity).toBe("warning");

			cleanup();
		});

		test("should accept valid owner object", async () => {
			const pluginRoot = createTestMarketplace("valid-owner", {
				name: "my-marketplace",
				owner: { name: "John Doe", email: "john@example.com" },
				plugins: [],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const ownerIssues = issues.filter((i) =>
				i.ruleId.startsWith("marketplace/"),
			);
			// Only warning for empty plugins array
			expect(ownerIssues.length).toBeLessThanOrEqual(1);

			cleanup();
		});
	});

	describe("plugins validation", () => {
		test("should require plugins to be an array", async () => {
			const pluginRoot = createTestMarketplace("plugins-not-array", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: "not-an-array",
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const pluginsIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-plugins-type",
			);
			expect(pluginsIssue).toBeDefined();
			expect(pluginsIssue?.severity).toBe("error");

			cleanup();
		});

		test("should warn for empty plugins array", async () => {
			const pluginRoot = createTestMarketplace("empty-plugins", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const pluginsIssue = issues.find(
				(i) => i.ruleId === "marketplace/empty-plugins",
			);
			expect(pluginsIssue).toBeDefined();
			expect(pluginsIssue?.severity).toBe("warning");

			cleanup();
		});

		test("should error if plugin entry is not an object", async () => {
			const pluginRoot = createTestMarketplace("plugin-not-object", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: ["not-an-object"],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const pluginIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-plugin-entry",
			);
			expect(pluginIssue).toBeDefined();
			expect(pluginIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("plugin entry validation", () => {
		test("should require plugin name", async () => {
			const pluginRoot = createTestMarketplace("plugin-no-name", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ source: "./plugins/test" }],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "marketplace/missing-plugin-name",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");

			cleanup();
		});

		test("should require plugin name to be a string", async () => {
			const pluginRoot = createTestMarketplace("plugin-name-not-string", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ name: 123, source: "./plugins/test" }],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-plugin-name-type",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");

			cleanup();
		});

		test("should require plugin name to be kebab-case", async () => {
			const pluginRoot = createTestMarketplace("plugin-name-invalid", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ name: "MyPlugin", source: "./plugins/test" }],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const nameIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-plugin-name-format",
			);
			expect(nameIssue).toBeDefined();
			expect(nameIssue?.severity).toBe("error");

			cleanup();
		});

		test("should require plugin source", async () => {
			const pluginRoot = createTestMarketplace("plugin-no-source", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ name: "my-plugin" }],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const sourceIssue = issues.find(
				(i) => i.ruleId === "marketplace/missing-plugin-source",
			);
			expect(sourceIssue).toBeDefined();
			expect(sourceIssue?.severity).toBe("error");

			cleanup();
		});

		test("should error for duplicate plugin names", async () => {
			const pluginRoot = createTestMarketplace("duplicate-plugins", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [
					{ name: "my-plugin", source: "./plugins/plugin1" },
					{ name: "my-plugin", source: "./plugins/plugin2" },
				],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const duplicateIssue = issues.find(
				(i) => i.ruleId === "marketplace/duplicate-plugin-name",
			);
			expect(duplicateIssue).toBeDefined();
			expect(duplicateIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("plugin source validation - relative paths", () => {
		test("should accept valid relative path with existing directory", async () => {
			const pluginRoot = createTestMarketplace("valid-source-path", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ name: "my-plugin", source: "./plugins/my-plugin" }],
			});
			createPluginSource(pluginRoot, "plugins/my-plugin");

			const issues = await validateMarketplaceJson({ pluginRoot });

			const sourceIssues = issues.filter(
				(i) =>
					i.ruleId === "marketplace/source-not-found" ||
					i.ruleId === "marketplace/invalid-source-path",
			);
			expect(sourceIssues).toHaveLength(0);

			cleanup();
		});

		test("should error if relative path doesn't start with ./", async () => {
			const pluginRoot = createTestMarketplace("invalid-path-format", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ name: "my-plugin", source: "plugins/my-plugin" }],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const pathIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-source-path",
			);
			expect(pathIssue).toBeDefined();
			expect(pathIssue?.severity).toBe("error");
			expect(pathIssue?.message).toContain("./");

			cleanup();
		});

		test("should error if source directory doesn't exist", async () => {
			const pluginRoot = createTestMarketplace("source-not-found", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ name: "my-plugin", source: "./plugins/missing" }],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const sourceIssue = issues.find(
				(i) => i.ruleId === "marketplace/source-not-found",
			);
			expect(sourceIssue).toBeDefined();
			expect(sourceIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("plugin source validation - GitHub", () => {
		test("should accept valid GitHub source", async () => {
			const pluginRoot = createTestMarketplace("valid-github-source", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [
					{
						name: "my-plugin",
						source: { source: "github", repo: "owner/repository" },
					},
				],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const sourceIssues = issues.filter((i) =>
				i.ruleId.startsWith("marketplace/"),
			);
			expect(
				sourceIssues.filter(
					(i) =>
						i.ruleId === "marketplace/missing-github-repo" ||
						i.ruleId === "marketplace/invalid-github-repo",
				),
			).toHaveLength(0);

			cleanup();
		});

		test("should error if GitHub source is missing repo field", async () => {
			const pluginRoot = createTestMarketplace("github-no-repo", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ name: "my-plugin", source: { source: "github" } }],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const repoIssue = issues.find(
				(i) => i.ruleId === "marketplace/missing-github-repo",
			);
			expect(repoIssue).toBeDefined();
			expect(repoIssue?.severity).toBe("error");

			cleanup();
		});

		test("should error if GitHub repo is not in owner/repo format", async () => {
			const pluginRoot = createTestMarketplace("github-invalid-repo", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [
					{ name: "my-plugin", source: { source: "github", repo: "invalid" } },
				],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const repoIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-github-repo",
			);
			expect(repoIssue).toBeDefined();
			expect(repoIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("plugin source validation - Git URL", () => {
		test("should accept valid Git URL source", async () => {
			const pluginRoot = createTestMarketplace("valid-git-url", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [
					{
						name: "my-plugin",
						source: {
							source: "url",
							url: "https://github.com/owner/repo.git",
						},
					},
				],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const sourceIssues = issues.filter((i) =>
				i.ruleId.startsWith("marketplace/missing-git-url"),
			);
			expect(sourceIssues).toHaveLength(0);

			cleanup();
		});

		test("should error if Git URL source is missing url field", async () => {
			const pluginRoot = createTestMarketplace("git-url-no-url", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ name: "my-plugin", source: { source: "url" } }],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const urlIssue = issues.find(
				(i) => i.ruleId === "marketplace/missing-git-url",
			);
			expect(urlIssue).toBeDefined();
			expect(urlIssue?.severity).toBe("error");

			cleanup();
		});

		test("should warn for potentially invalid Git URL", async () => {
			const pluginRoot = createTestMarketplace("git-url-invalid", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [
					{
						name: "my-plugin",
						source: { source: "url", url: "https://example.com/not-a-repo" },
					},
				],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const urlIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-git-url",
			);
			expect(urlIssue).toBeDefined();
			expect(urlIssue?.severity).toBe("warning");

			cleanup();
		});
	});

	describe("plugin source validation - object", () => {
		test("should error if source object is missing 'source' field", async () => {
			const pluginRoot = createTestMarketplace("source-no-type", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ name: "my-plugin", source: { repo: "owner/repo" } }],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const sourceIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-source-object",
			);
			expect(sourceIssue).toBeDefined();
			expect(sourceIssue?.severity).toBe("error");

			cleanup();
		});

		test("should error for invalid source type", async () => {
			const pluginRoot = createTestMarketplace("invalid-source-type", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [
					{
						name: "my-plugin",
						source: { source: "invalid", url: "https://example.com" },
					},
				],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const sourceIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-source-type",
			);
			expect(sourceIssue).toBeDefined();
			expect(sourceIssue?.severity).toBe("error");

			cleanup();
		});

		test("should error if source is invalid format", async () => {
			const pluginRoot = createTestMarketplace("source-invalid-format", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ name: "my-plugin", source: 123 }],
			});

			const issues = await validateMarketplaceJson({ pluginRoot });

			const sourceIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-source-format",
			);
			expect(sourceIssue).toBeDefined();
			expect(sourceIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("plugin keywords validation", () => {
		test("should error if keywords is not an array", async () => {
			const pluginRoot = createTestMarketplace("keywords-not-array", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [
					{
						name: "my-plugin",
						source: "./plugins/my-plugin",
						keywords: "git,mcp",
					},
				],
			});
			createPluginSource(pluginRoot, "plugins/my-plugin");

			const issues = await validateMarketplaceJson({ pluginRoot });

			const keywordsIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-keywords-type",
			);
			expect(keywordsIssue).toBeDefined();
			expect(keywordsIssue?.severity).toBe("error");

			cleanup();
		});

		test("should error if keyword is not a string", async () => {
			const pluginRoot = createTestMarketplace("keyword-not-string", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [
					{
						name: "my-plugin",
						source: "./plugins/my-plugin",
						keywords: ["git", 123, "mcp"],
					},
				],
			});
			createPluginSource(pluginRoot, "plugins/my-plugin");

			const issues = await validateMarketplaceJson({ pluginRoot });

			const keywordIssue = issues.find(
				(i) => i.ruleId === "marketplace/invalid-keyword-type",
			);
			expect(keywordIssue).toBeDefined();
			expect(keywordIssue?.severity).toBe("error");

			cleanup();
		});
	});

	describe("complete valid marketplace", () => {
		test("should pass validation for complete marketplace.json", async () => {
			const pluginRoot = createTestMarketplace("complete-marketplace", {
				name: "my-marketplace",
				owner: {
					name: "John Doe",
					email: "john@example.com",
				},
				metadata: {
					description: "A test marketplace",
					version: "1.0.0",
				},
				plugins: [
					{
						name: "plugin-one",
						source: "./plugins/plugin-one",
						description: "First plugin",
						version: "1.0.0",
						keywords: ["test", "plugin"],
					},
					{
						name: "plugin-two",
						source: { source: "github", repo: "owner/plugin-two" },
						description: "Second plugin",
					},
					{
						name: "plugin-three",
						source: {
							source: "url",
							url: "https://github.com/owner/plugin-three.git",
						},
					},
				],
			});

			// Create plugin source directory for relative path
			createPluginSource(pluginRoot, "plugins/plugin-one");

			const issues = await validateMarketplaceJson({ pluginRoot });

			// Should have no errors (warnings for Git URL are acceptable)
			const errors = issues.filter((i) => i.severity === "error");
			expect(errors).toHaveLength(0);

			cleanup();
		});
	});

	describe("unregistered plugin validation", () => {
		test("should error if plugin directory exists but is not registered", async () => {
			const pluginRoot = createTestMarketplace("unregistered-plugin", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ name: "plugin-one", source: "./plugins/plugin-one" }],
			});

			// Create plugin directories - one registered, one not
			createPluginSource(pluginRoot, "plugins/plugin-one");
			createPluginSource(pluginRoot, "plugins/plugin-two");

			const issues = await validateMarketplaceJson({ pluginRoot });

			const unregisteredIssue = issues.find(
				(i) => i.ruleId === "marketplace/unregistered-plugin",
			);
			expect(unregisteredIssue).toBeDefined();
			expect(unregisteredIssue?.severity).toBe("error");
			expect(unregisteredIssue?.message).toContain("plugin-two");
			expect(unregisteredIssue?.suggestion).toContain("./plugins/plugin-two");

			cleanup();
		});

		test("should error for multiple unregistered plugins", async () => {
			const pluginRoot = createTestMarketplace("multiple-unregistered", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [{ name: "plugin-one", source: "./plugins/plugin-one" }],
			});

			// Create multiple unregistered plugins
			createPluginSource(pluginRoot, "plugins/plugin-one");
			createPluginSource(pluginRoot, "plugins/plugin-two");
			createPluginSource(pluginRoot, "plugins/plugin-three");

			const issues = await validateMarketplaceJson({ pluginRoot });

			const unregisteredIssues = issues.filter(
				(i) => i.ruleId === "marketplace/unregistered-plugin",
			);
			expect(unregisteredIssues).toHaveLength(2);
			expect(
				unregisteredIssues.some((i) => i.message.includes("plugin-two")),
			).toBe(true);
			expect(
				unregisteredIssues.some((i) => i.message.includes("plugin-three")),
			).toBe(true);

			cleanup();
		});

		test("should pass if all plugin directories are registered", async () => {
			const pluginRoot = createTestMarketplace("all-registered", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [
					{ name: "plugin-one", source: "./plugins/plugin-one" },
					{ name: "plugin-two", source: "./plugins/plugin-two" },
				],
			});

			// Create all registered plugin directories
			createPluginSource(pluginRoot, "plugins/plugin-one");
			createPluginSource(pluginRoot, "plugins/plugin-two");

			const issues = await validateMarketplaceJson({ pluginRoot });

			const unregisteredIssues = issues.filter(
				(i) => i.ruleId === "marketplace/unregistered-plugin",
			);
			expect(unregisteredIssues).toHaveLength(0);

			cleanup();
		});

		test("should pass if no plugins directory exists", async () => {
			const pluginRoot = createTestMarketplace("no-plugins-dir", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [],
			});

			// Don't create plugins directory at all
			const issues = await validateMarketplaceJson({ pluginRoot });

			const unregisteredIssues = issues.filter(
				(i) => i.ruleId === "marketplace/unregistered-plugin",
			);
			expect(unregisteredIssues).toHaveLength(0);

			cleanup();
		});

		test("should ignore non-local plugin sources", async () => {
			const pluginRoot = createTestMarketplace("non-local-sources", {
				name: "my-marketplace",
				owner: { name: "Test", email: "test@example.com" },
				plugins: [
					{ name: "plugin-one", source: "./plugins/plugin-one" },
					{
						name: "plugin-github",
						source: { source: "github", repo: "owner/repo" },
					},
					{
						name: "plugin-url",
						source: { source: "url", url: "https://github.com/owner/repo.git" },
					},
				],
			});

			// Create local plugin directory
			createPluginSource(pluginRoot, "plugins/plugin-one");

			const issues = await validateMarketplaceJson({ pluginRoot });

			const unregisteredIssues = issues.filter(
				(i) => i.ruleId === "marketplace/unregistered-plugin",
			);
			expect(unregisteredIssues).toHaveLength(0);

			cleanup();
		});
	});
});
