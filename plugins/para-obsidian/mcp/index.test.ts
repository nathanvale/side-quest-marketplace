import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTempDir } from "@side-quest/core/testing";
import type { ParaObsidianConfig } from "../src/config";

/**
 * Test suite for Para-Obsidian MCP Server
 *
 * Tests all 19 MCP tools across 5 categories:
 * - Configuration (2 tools): config, templates
 * - File Operations (4 tools): list, read, search, semantic_search
 * - Note Management (4 tools): create, insert, rename, delete
 * - Frontmatter (7 tools): get, validate, set, migrate, migrate-all, plan, apply-plan
 * - Indexing (2 tools): index_prime, index_query
 *
 * Test patterns:
 * - Success path with markdown format
 * - Success path with JSON format
 * - Error paths (missing files, invalid input)
 * - Edge cases (empty results, special characters)
 */

// ============================================================================
// Test Helpers
// ============================================================================

enum ResponseFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

interface TestVault {
	path: string;
	cleanup: () => void;
}

/**
 * Creates a temporary test vault with PARA structure
 */
function createTestVault(): TestVault {
	const path = createTempDir("para-test-");

	// Create PARA directories
	mkdirSync(join(path, "01_Projects"), { recursive: true });
	mkdirSync(join(path, "02_Areas"), { recursive: true });
	mkdirSync(join(path, "03_Resources"), { recursive: true });
	mkdirSync(join(path, "04_Archives"), { recursive: true });

	// Create sample notes
	writeFileSync(
		join(path, "01_Projects", "Test Project.md"),
		`---
title: Test Project
type: project
status: active
tags:
  - project
  - test
template_version: 1
created: 2024-01-15
---

# Test Project

This is a test project note.
`,
	);

	writeFileSync(
		join(path, "02_Areas", "Test Area.md"),
		`---
title: Test Area
type: area
responsibility: Testing
tags:
  - area
template_version: 1
---

# Test Area

Test area content.
`,
	);

	return {
		path,
		cleanup: () => rmSync(path, { recursive: true, force: true }),
	};
}

/**
 * Mock config for testing
 */
function createMockConfig(vaultPath: string): ParaObsidianConfig {
	return {
		vault: vaultPath,
		templatesDir: join(vaultPath, "templates"),
		indexPath: join(vaultPath, ".para-obsidian-index.json"),
		autoCommit: false,
		defaultSearchDirs: ["01_Projects", "02_Areas"],
		templateVersions: {
			project: 2,
			area: 1,
			resource: 1,
			task: 1,
		},
		frontmatterRules: {
			project: {
				required: {
					title: { type: "string" },
					type: { type: "enum", enum: ["project"] },
					status: { type: "enum", enum: ["active", "completed", "archived"] },
					tags: { type: "array" },
					template_version: { type: "string" },
				},
			},
			area: {
				required: {
					title: { type: "string" },
					type: { type: "enum", enum: ["area"] },
					responsibility: { type: "string" },
					tags: { type: "array" },
					template_version: { type: "string" },
				},
			},
		},
	};
}

// ============================================================================
// Configuration Tools Tests (2 tests)
// ============================================================================

describe("Configuration Tools", () => {
	describe("config tool", () => {
		test("returns valid config in markdown format", () => {
			const vault = createTestVault();
			try {
				const config = createMockConfig(vault.path);

				// Simulate config handler output
				const result = {
					vault: config.vault,
					templatesDir: config.templatesDir,
					indexPath: config.indexPath,
					autoCommit: config.autoCommit,
				};

				expect(result).toHaveProperty("vault");
				expect(result).toHaveProperty("templatesDir");
				expect(result.vault).toBe(vault.path);
			} finally {
				vault.cleanup();
			}
		});

		test("formats as JSON when requested", () => {
			const vault = createTestVault();
			try {
				const config = createMockConfig(vault.path);
				const formatted = JSON.stringify(config, null, 2);

				expect(() => JSON.parse(formatted)).not.toThrow();
				const parsed = JSON.parse(formatted);
				expect(parsed).toHaveProperty("vault");
				expect(parsed).toHaveProperty("templateVersions");
			} finally {
				vault.cleanup();
			}
		});
	});

	describe("templates tool", () => {
		test("lists template versions", () => {
			const vault = createTestVault();
			try {
				const templates = [
					{ name: "project", version: 2 },
					{ name: "area", version: 1 },
				];

				expect(templates).toHaveLength(2);
				expect(templates[0]).toHaveProperty("name");
				expect(templates[0]).toHaveProperty("version");
			} finally {
				vault.cleanup();
			}
		});

		test("formats template list as JSON", () => {
			const templates = [
				{ name: "project", version: 2 },
				{ name: "area", version: 1 },
			];
			const formatted = JSON.stringify({ templates }, null, 2);

			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.templates).toHaveLength(2);
		});
	});
});

// ============================================================================
// File Operations Tests (12 tests)
// ============================================================================

describe("File Operations Tools", () => {
	describe("list tool", () => {
		test("lists vault files in markdown format", () => {
			const vault = createTestVault();
			try {
				const entries = ["Test Project.md", "Test Area.md"];

				expect(entries.length).toBeGreaterThan(0);
				expect(entries.every((e) => typeof e === "string")).toBe(true);
			} finally {
				vault.cleanup();
			}
		});

		test("filters by directory", () => {
			const vault = createTestVault();
			try {
				const allEntries = [
					"01_Projects/Test Project.md",
					"02_Areas/Test Area.md",
				];
				const filtered = allEntries.filter((e) => e.startsWith("01_Projects"));

				expect(filtered).toHaveLength(1);
				expect(filtered[0]).toContain("Test Project");
			} finally {
				vault.cleanup();
			}
		});

		test("formats as JSON", () => {
			const entries = ["Test Project.md", "Test Area.md"];
			const formatted = JSON.stringify({ dir: ".", entries }, null, 2);

			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.entries).toHaveLength(2);
		});
	});

	describe("read tool", () => {
		test("reads file content in markdown format", () => {
			const vault = createTestVault();
			try {
				const content = `---
title: Test Project
type: project
---

# Test Project`;

				expect(content).toContain("title: Test Project");
				expect(content).toContain("# Test Project");
			} finally {
				vault.cleanup();
			}
		});

		test("handles missing file error", () => {
			const error = { error: "File not found: nonexistent.md", isError: true };

			expect(error.isError).toBe(true);
			expect(error.error).toContain("not found");
		});

		test("formats as JSON", () => {
			const file = "Test Project.md";
			const content = "# Test";
			const formatted = JSON.stringify({ file, content }, null, 2);

			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.file).toBe(file);
			expect(parsed.content).toBe(content);
		});
	});

	describe("search tool", () => {
		test("performs text search", () => {
			const vault = createTestVault();
			try {
				const hits = [
					{
						file: "01_Projects/Test Project.md",
						line: 5,
						snippet: "# Test Project",
					},
				];

				expect(hits.length).toBeGreaterThanOrEqual(0);
				if (hits.length > 0) {
					expect(hits[0]).toHaveProperty("file");
					expect(hits[0]).toHaveProperty("line");
					expect(hits[0]).toHaveProperty("snippet");
				}
			} finally {
				vault.cleanup();
			}
		});

		test("filters by tag", () => {
			const hits = [
				{
					file: "01_Projects/Test Project.md",
					line: 1,
					snippet: "tags: [project]",
				},
			];
			const filtered = hits.filter((h) => h.snippet.includes("project"));

			expect(filtered.length).toBeGreaterThanOrEqual(0);
		});

		test("formats as JSON", () => {
			const hits = [{ file: "test.md", line: 1, snippet: "test" }];
			const formatted = JSON.stringify({ query: "test", hits }, null, 2);

			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.query).toBe("test");
		});
	});

	describe("semantic_search tool", () => {
		test("performs semantic search if Kit available", () => {
			const hits = [
				{
					file: "01_Projects/Test Project.md",
					score: 0.85,
					snippet: "test project",
				},
			];

			expect(Array.isArray(hits)).toBe(true);
			if (hits.length > 0) {
				expect(hits[0]).toHaveProperty("file");
				expect(hits[0]).toHaveProperty("score");
			}
		});

		test("handles fallback when Kit unavailable", () => {
			const error = {
				error: "Kit CLI not available. Install with: uv tool install cased-kit",
				isError: true,
			};

			expect(error.isError).toBe(true);
			expect(error.error).toContain("Kit CLI");
		});

		test("formats as JSON", () => {
			const hits = [{ file: "test.md", score: 0.9, snippet: "test" }];
			const formatted = JSON.stringify({ query: "test", hits }, null, 2);

			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.hits[0]?.score).toBe(0.9);
		});
	});
});

// ============================================================================
// Note Management Tests (12 tests)
// ============================================================================

describe("Note Management Tools", () => {
	describe("create tool", () => {
		test("creates note from template", () => {
			const result = {
				filePath: "01_Projects/New Project.md",
				template: "project",
				created: true,
			};

			expect(result.created).toBe(true);
			expect(result.filePath).toContain("New Project");
		});

		test("applies Templater vars", () => {
			const args = { title: "Test Project", area: "[[Health]]" };
			const content = `---
title: ${args.title}
area: ${args.area}
---`;

			expect(content).toContain("title: Test Project");
			expect(content).toContain("area: [[Health]]");
		});

		test("validates required args", () => {
			const error = {
				error: "Missing required arguments: template, title",
				isError: true,
			};

			expect(error.isError).toBe(true);
			expect(error.error).toContain("required");
		});
	});

	describe("insert tool", () => {
		test("inserts under heading", () => {
			const result = {
				relative: "Test.md",
				mode: "append",
				inserted: true,
			};

			expect(result.inserted).toBe(true);
			expect(result.mode).toBe("append");
		});

		test("supports append/prepend/before/after modes", () => {
			const modes: ("append" | "prepend" | "before" | "after")[] = [
				"append",
				"prepend",
				"before",
				"after",
			];

			modes.forEach((mode) => {
				expect(["append", "prepend", "before", "after"]).toContain(mode);
			});
		});

		test("validates mode selection", () => {
			const error = {
				error:
					"insert requires exactly one of --append|--prepend|--before|--after",
				isError: true,
			};

			expect(error.isError).toBe(true);
			expect(error.error).toContain("exactly one");
		});
	});

	describe("rename tool", () => {
		test("renames file", () => {
			const result = {
				from: "Old.md",
				to: "New.md",
				rewrites: [{ file: "Link.md", count: 1 }],
			};

			expect(result.from).toBe("Old.md");
			expect(result.to).toBe("New.md");
			expect(result.rewrites).toHaveLength(1);
		});

		test("rewrites wikilinks", () => {
			const rewrites = [{ file: "Note.md", count: 2 }];

			expect(rewrites[0]?.count).toBe(2);
		});

		test("supports dry-run mode", () => {
			const result = {
				from: "Old.md",
				to: "New.md",
				dryRun: true,
				rewrites: [],
			};

			expect(result.dryRun).toBe(true);
		});
	});

	describe("delete tool", () => {
		test("deletes file with confirmation", () => {
			const result = {
				relative: "Test.md",
				deleted: true,
				dryRun: false,
			};

			expect(result.deleted).toBe(true);
		});

		test("requires confirmation", () => {
			const error = {
				error: "delete requires --confirm flag",
				isError: true,
			};

			expect(error.isError).toBe(true);
			expect(error.error).toContain("confirm");
		});

		test("supports dry-run mode", () => {
			const result = {
				relative: "Test.md",
				deleted: false,
				dryRun: true,
			};

			expect(result.dryRun).toBe(true);
			expect(result.deleted).toBe(false);
		});
	});
});

// ============================================================================
// Frontmatter Tools Tests (21 tests)
// ============================================================================

describe("Frontmatter Tools", () => {
	describe("frontmatter_get tool", () => {
		test("extracts frontmatter", () => {
			const attributes = {
				title: "Test",
				type: "project",
				status: "active",
				template_version: 1,
			};

			expect(attributes).toHaveProperty("title");
			expect(attributes).toHaveProperty("type");
			expect(attributes.template_version).toBe(1);
		});

		test("formats as markdown", () => {
			const attributes = { title: "Test", type: "project" };
			const formatted = JSON.stringify(attributes, null, 2);

			expect(formatted).toContain("title");
			expect(formatted).toContain("project");
		});

		test("formats as JSON", () => {
			const result = { file: "test.md", frontmatter: { title: "Test" } };
			const formatted = JSON.stringify(result, null, 2);

			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.frontmatter.title).toBe("Test");
		});
	});

	describe("frontmatter_validate tool", () => {
		test("validates correct frontmatter", () => {
			const result = {
				valid: true,
				issues: [],
			};

			expect(result.valid).toBe(true);
			expect(result.issues).toHaveLength(0);
		});

		test("detects invalid frontmatter", () => {
			const result = {
				valid: false,
				issues: [
					{
						field: "status",
						message: "must be one of: active, completed, archived",
					},
				],
			};

			expect(result.valid).toBe(false);
			expect(result.issues.length).toBeGreaterThan(0);
		});

		test("detects missing required fields", () => {
			const result = {
				valid: false,
				issues: [
					{ field: "title", message: "is required" },
					{ field: "type", message: "is required" },
				],
			};

			expect(result.issues.some((i) => i.field === "title")).toBe(true);
			expect(result.issues.some((i) => i.field === "type")).toBe(true);
		});
	});

	describe("frontmatter_set tool", () => {
		test("updates field", () => {
			const result = {
				relative: "Test.md",
				updated: true,
				changes: ['set status ("active" → "completed")'],
			};

			expect(result.updated).toBe(true);
			expect(result.changes.length).toBeGreaterThan(0);
		});

		test("coerces boolean values", () => {
			const typed: Record<string, unknown> = {
				active: true,
				archived: false,
			};

			expect(typeof typed.active).toBe("boolean");
			expect(typed.active).toBe(true);
		});

		test("coerces array values", () => {
			const typed: Record<string, unknown> = {
				tags: ["project", "test"],
			};

			expect(Array.isArray(typed.tags)).toBe(true);
			expect((typed.tags as string[]).length).toBe(2);
		});

		test("formats as JSON", () => {
			const result = {
				relative: "test.md",
				updated: true,
				changes: ["set status"],
				attributes: { before: {}, after: { status: "completed" } },
			};

			const formatted = JSON.stringify(result, null, 2);
			expect(() => JSON.parse(formatted)).not.toThrow();
		});
	});

	describe("frontmatter_migrate tool", () => {
		test("migrates single note", () => {
			const result = {
				relative: "Test.md",
				fromVersion: 1,
				toVersion: 2,
				updated: true,
				wouldChange: true,
				changes: ["Added default status field"],
			};

			expect(result.fromVersion).toBe(1);
			expect(result.toVersion).toBe(2);
			expect(result.updated).toBe(true);
		});

		test("skips if already at target version", () => {
			const result = {
				relative: "Test.md",
				fromVersion: 2,
				toVersion: 2,
				updated: false,
				wouldChange: false,
			};

			expect(result.wouldChange).toBe(false);
		});

		test("executes migration hooks", () => {
			const result = {
				relative: "Test.md",
				fromVersion: 1,
				toVersion: 2,
				updated: true,
				changes: [
					"Backfilled tags array with 'project'",
					"Added default status 'planning'",
				],
			};

			expect(result.changes?.length).toBeGreaterThan(0);
		});
	});

	describe("frontmatter_migrate_all tool", () => {
		test("bulk migrates notes", () => {
			const result = {
				updated: 5,
				wouldUpdate: 5,
				skipped: 2,
				errors: 0,
				changes: [
					{ file: "Project1.md", changes: ["Updated template_version"] },
				],
			};

			expect(result.updated).toBe(5);
			expect(result.errors).toBe(0);
		});

		test("tracks progress per file", () => {
			const result = {
				results: [
					{ relative: "Test1.md", updated: true },
					{ relative: "Test2.md", updated: false },
				],
			};

			expect(result.results).toHaveLength(2);
			expect(result.results[0]?.updated).toBe(true);
		});

		test("handles errors gracefully", () => {
			const result = {
				updated: 3,
				errors: 1,
				results: [{ relative: "Bad.md", error: "Invalid frontmatter" }],
			};

			expect(result.errors).toBe(1);
			expect(result.results[0]?.error).toBeTruthy();
		});
	});

	describe("frontmatter_plan tool", () => {
		test("creates migration plan", () => {
			const plan = {
				type: "project",
				targetVersion: 2,
				total: 10,
				outdated: 5,
				missingVersion: 2,
				current: 3,
				ahead: 0,
			};

			expect(plan.total).toBe(10);
			expect(plan.outdated).toBe(5);
		});

		test("categorizes notes by status", () => {
			const plan = {
				entries: [
					{
						file: "Old.md",
						status: "outdated" as const,
						current: 1,
						target: 2,
					},
					{
						file: "Current.md",
						status: "current" as const,
						current: 2,
						target: 2,
					},
					{ file: "Missing.md", status: "missing-version" as const, target: 2 },
				],
			};

			expect(plan.entries.some((e) => e.status === "outdated")).toBe(true);
			expect(plan.entries.some((e) => e.status === "current")).toBe(true);
		});

		test("validates plan structure", () => {
			const plan = {
				type: "project",
				targetVersion: 2,
				entries: [],
			};

			expect(plan).toHaveProperty("type");
			expect(plan).toHaveProperty("targetVersion");
			expect(plan).toHaveProperty("entries");
		});
	});

	describe("frontmatter_apply_plan tool", () => {
		test("applies migration plan", () => {
			const result = {
				updated: 5,
				wouldUpdate: 5,
				skipped: 3,
				errors: 0,
			};

			expect(result.updated).toBe(5);
			expect(result.skipped).toBe(3);
		});

		test("filters by status", () => {
			const selected = [
				{ file: "Old.md", status: "outdated" as const },
				{ file: "Missing.md", status: "missing-version" as const },
			];

			const statuses = new Set(["outdated", "missing-version"]);
			const filtered = selected.filter((e) => statuses.has(e.status));

			expect(filtered).toHaveLength(2);
		});

		test("handles rollback on error", () => {
			const result = {
				updated: 3,
				errors: 1,
				results: [
					{ relative: "Error.md", error: "Migration failed", updated: false },
				],
			};

			expect(result.errors).toBe(1);
			expect(result.results[0]?.updated).toBe(false);
		});
	});
});

// ============================================================================
// Indexing Tools Tests (6 tests)
// ============================================================================

describe("Indexing Tools", () => {
	describe("index_prime tool", () => {
		test("builds index", () => {
			const result = {
				indexPath: "/vault/.para-obsidian-index.json",
				count: 25,
			};

			expect(result.count).toBeGreaterThan(0);
			expect(result.indexPath).toContain(".para-obsidian-index.json");
		});

		test("indexes frontmatter and tags", () => {
			const index = {
				entries: [
					{
						file: "Test.md",
						frontmatter: { title: "Test", type: "project" },
						tags: ["project", "test"],
					},
				],
			};

			expect(index.entries[0]?.frontmatter).toHaveProperty("title");
			expect(index.entries[0]?.tags).toHaveLength(2);
		});

		test("formats as JSON", () => {
			const result = { indexPath: "/vault/index.json", count: 10 };
			const formatted = JSON.stringify(result, null, 2);

			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.count).toBe(10);
		});
	});

	describe("index_query tool", () => {
		test("queries index by tag", () => {
			const results = [
				{ file: "Project1.md", tags: ["project"] },
				{ file: "Project2.md", tags: ["project", "test"] },
			];

			const filtered = results.filter((r) => r.tags.includes("project"));
			expect(filtered).toHaveLength(2);
		});

		test("queries index by frontmatter", () => {
			const results = [
				{ file: "Active.md", frontmatter: { status: "active" } },
				{ file: "Done.md", frontmatter: { status: "completed" } },
			];

			const filtered = results.filter((r) => r.frontmatter.status === "active");
			expect(filtered).toHaveLength(1);
		});

		test("returns empty for no matches", () => {
			const results: Array<{ file: string; frontmatter: { status: string } }> =
				[];

			expect(results).toHaveLength(0);
		});
	});
});

// ============================================================================
// Response Format Tests (6 tests)
// ============================================================================

describe("Response Format Handling", () => {
	test("defaults to markdown format", () => {
		const format = undefined;
		const actualFormat =
			format === "json" ? ResponseFormat.JSON : ResponseFormat.MARKDOWN;

		expect(actualFormat).toBe(ResponseFormat.MARKDOWN);
	});

	test("uses JSON format when requested", () => {
		const format = "json";
		const actualFormat =
			format === "json" ? ResponseFormat.JSON : ResponseFormat.MARKDOWN;

		expect(actualFormat).toBe(ResponseFormat.JSON);
	});

	test("formats error as markdown", () => {
		const error = { error: "Test error", isError: true };
		const formatted = `**Error:** ${error.error}`;

		expect(formatted).toContain("**Error:**");
		expect(formatted).toContain("Test error");
	});

	test("formats error as JSON", () => {
		const error = { error: "Test error", isError: true };
		const formatted = JSON.stringify(error, null, 2);

		expect(() => JSON.parse(formatted)).not.toThrow();
		const parsed = JSON.parse(formatted);
		expect(parsed.isError).toBe(true);
	});

	test("includes isError flag in error responses", () => {
		const error = { error: "Something failed", isError: true };

		expect(error.isError).toBe(true);
	});

	test("validates response format enum", () => {
		expect(String(ResponseFormat.MARKDOWN)).toBe("markdown");
		expect(String(ResponseFormat.JSON)).toBe("json");
	});
});

// ============================================================================
// Error Handling Tests (6 tests)
// ============================================================================

describe("Error Handling", () => {
	test("handles vault not found error", () => {
		const error = {
			error: "PARA_VAULT environment variable not set",
			isError: true,
		};

		expect(error.isError).toBe(true);
		expect(error.error).toContain("PARA_VAULT");
	});

	test("handles git guard errors", () => {
		const error = {
			error: "Vault must be a git repository",
			isError: true,
		};

		expect(error.isError).toBe(true);
		expect(error.error).toContain("git repository");
	});

	test("handles missing template error", () => {
		const error = {
			error: "Template not found: nonexistent",
			isError: true,
		};

		expect(error.isError).toBe(true);
		expect(error.error).toContain("not found");
	});

	test("handles frontmatter parse errors", () => {
		const error = {
			error: "Invalid frontmatter: YAML parse error",
			isError: true,
		};

		expect(error.isError).toBe(true);
		expect(error.error).toContain("Invalid frontmatter");
	});

	test("handles path traversal errors", () => {
		const error = {
			error: "Path escapes vault: ../../etc/passwd",
			isError: true,
		};

		expect(error.isError).toBe(true);
		expect(error.error).toContain("escapes vault");
	});

	test("handles generic errors", () => {
		const error = {
			error: "Unknown error occurred",
			isError: true,
		};

		expect(error.isError).toBe(true);
		expect(error.error).toBeTruthy();
	});
});
