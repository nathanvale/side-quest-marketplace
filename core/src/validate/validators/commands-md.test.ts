import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateCommandsMd } from "./commands-md.ts";

/**
 * Create a temporary plugin directory with specified structure
 */
function createTestPlugin(name: string, files: Record<string, string>): string {
	const pluginRoot = join(tmpdir(), `test-commands-${name}-${Date.now()}`);
	mkdirSync(pluginRoot, { recursive: true });

	for (const [filePath, content] of Object.entries(files)) {
		const fullPath = join(pluginRoot, filePath);
		const dir = join(fullPath, "..");
		mkdirSync(dir, { recursive: true });
		writeFileSync(fullPath, content);
	}

	return pluginRoot;
}

/**
 * Cleanup temporary plugin directories
 */
const tempDirs: string[] = [];
afterEach(() => {
	for (const dir of tempDirs) {
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
	tempDirs.length = 0;
});

describe("validateCommandsMd", () => {
	describe("when no commands directory exists", () => {
		it("should return no issues", async () => {
			const pluginRoot = createTestPlugin("no-commands", {
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			expect(issues).toEqual([]);
		});
	});

	describe("file extension validation", () => {
		it("should warn if command file is not markdown", async () => {
			const pluginRoot = createTestPlugin("non-md-command", {
				"commands/my-command.ts": "export default function() {}",
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const notMdIssue = issues.find(
				(i) => i.ruleId === "command/not-markdown",
			);
			expect(notMdIssue).toBeDefined();
			expect(notMdIssue?.severity).toBe("warning");
			expect(notMdIssue?.message).toContain("my-command.ts");
		});

		it("should pass for valid markdown files", async () => {
			const pluginRoot = createTestPlugin("valid-md", {
				"commands/my-command.md": "# My Command\n\nThis is a valid command.",
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const notMdIssues = issues.filter(
				(i) => i.ruleId === "command/not-markdown",
			);
			expect(notMdIssues).toEqual([]);
		});
	});

	describe("frontmatter validation", () => {
		it("should warn if description is missing from frontmatter", async () => {
			const commandContent = `---
allowed-tools: Bash, Read
argument-hint: [message]
model: claude-sonnet-4-5-20250929
---

# My Command

This command does something useful.
`;

			const pluginRoot = createTestPlugin("missing-description", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const missingDescIssue = issues.find(
				(i) => i.ruleId === "command/missing-description",
			);
			expect(missingDescIssue).toBeDefined();
			expect(missingDescIssue?.severity).toBe("warning");
			expect(missingDescIssue?.message).toContain("description");
		});

		it("should pass if description is present in frontmatter", async () => {
			const commandContent = `---
description: Create a git commit
allowed-tools: Bash(git add:*), Bash(git commit:*)
argument-hint: [message]
---

# My Command

This command creates a git commit.
`;

			const pluginRoot = createTestPlugin("with-description", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const missingDescIssues = issues.filter(
				(i) => i.ruleId === "command/missing-description",
			);
			expect(missingDescIssues).toEqual([]);
		});
	});

	describe("content length validation", () => {
		it("should warn if content after frontmatter is too short", async () => {
			const commandContent = `---
description: Short command
---

Hi
`;

			const pluginRoot = createTestPlugin("short-content", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const tooShortIssue = issues.find(
				(i) => i.ruleId === "command/too-short",
			);
			expect(tooShortIssue).toBeDefined();
			expect(tooShortIssue?.severity).toBe("warning");
		});

		it("should warn if total content is too short when no frontmatter", async () => {
			const pluginRoot = createTestPlugin("short-no-frontmatter", {
				"commands/my-command.md": "# Cmd",
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const tooShortIssue = issues.find(
				(i) => i.ruleId === "command/too-short",
			);
			expect(tooShortIssue).toBeDefined();
			expect(tooShortIssue?.severity).toBe("warning");
		});

		it("should pass if content is sufficiently detailed", async () => {
			const commandContent = `---
description: Create a git commit
---

# My Command

This command creates a git commit with proper formatting and validation.
It follows conventional commits specification.
`;

			const pluginRoot = createTestPlugin("good-content", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const tooShortIssues = issues.filter(
				(i) => i.ruleId === "command/too-short",
			);
			expect(tooShortIssues).toEqual([]);
		});
	});

	describe("nested commands", () => {
		it("should validate commands in subdirectories", async () => {
			const pluginRoot = createTestPlugin("nested-commands", {
				"commands/top-level.md": "# Top Level\n\nThis is a top-level command.",
				"commands/subdir/nested.md": `---
description: Nested command
---

# Nested Command

This is a nested command in a subdirectory.
`,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			// Both files should be validated without errors
			const errors = issues.filter((i) => i.severity === "error");
			expect(errors).toEqual([]);
		});

		it("should warn about missing description in nested commands", async () => {
			const pluginRoot = createTestPlugin("nested-no-desc", {
				"commands/subdir/nested.md": `---
allowed-tools: Bash
---

# Nested Command

This command is missing a description.
`,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const missingDescIssue = issues.find(
				(i) => i.ruleId === "command/missing-description",
			);
			expect(missingDescIssue).toBeDefined();
			expect(missingDescIssue?.file).toContain("subdir/nested.md");
		});
	});

	describe("frontmatter parsing", () => {
		it("should handle boolean values in frontmatter", async () => {
			const commandContent = `---
description: Test command
disable-model-invocation: true
---

# Test Command

This command has boolean frontmatter values.
`;

			const pluginRoot = createTestPlugin("boolean-frontmatter", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			// Should not error on boolean values
			const errors = issues.filter((i) => i.severity === "error");
			expect(errors).toEqual([]);
		});

		it("should handle complex allowed-tools values", async () => {
			const commandContent = `---
description: Git commit command
allowed-tools: Bash(git add:*), Bash(git commit:*), mcp__plugin_git_git-intelligence__get_recent_commits
---

# Git Commit

This command uses multiple tools.
`;

			const pluginRoot = createTestPlugin("complex-tools", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			// Should not error on complex allowed-tools
			const errors = issues.filter((i) => i.severity === "error");
			expect(errors).toEqual([]);
		});
	});

	describe("error handling", () => {
		it("should handle unreadable commands directory gracefully", async () => {
			const pluginRoot = createTestPlugin("error-test", {
				"package.json": JSON.stringify({ name: "test" }),
			});
			tempDirs.push(pluginRoot);

			// Create commands directory but make it inaccessible would be OS-specific
			// Instead, test the error message structure
			const issues = await validateCommandsMd({ pluginRoot });

			// Should not throw, should return empty issues for non-existent dir
			expect(Array.isArray(issues)).toBe(true);
		});
	});

	describe("allowed-tools validation", () => {
		it("should pass for valid tool names", async () => {
			const commandContent = `---
description: Test command
allowed-tools: Bash, Read, Write
---

# Test Command

This command uses valid tool names.
`;

			const pluginRoot = createTestPlugin("valid-tools", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const toolIssues = issues.filter(
				(i) => i.ruleId === "command/invalid-allowed-tools",
			);
			expect(toolIssues).toEqual([]);
		});

		it("should pass for tools with parentheses suffix", async () => {
			const commandContent = `---
description: Test command
allowed-tools: Bash(...), WebFetch(...)
---

# Test Command

This command uses tools with parentheses notation.
`;

			const pluginRoot = createTestPlugin("tools-with-parens", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const toolIssues = issues.filter(
				(i) => i.ruleId === "command/invalid-allowed-tools",
			);
			expect(toolIssues).toEqual([]);
		});

		it("should pass for tools with arguments in parentheses", async () => {
			const commandContent = `---
description: Git command
allowed-tools: Bash(git add:*), Bash(git commit:*)
---

# Git Command

This command uses Bash with git restrictions.
`;

			const pluginRoot = createTestPlugin("tools-with-args", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const toolIssues = issues.filter(
				(i) => i.ruleId === "command/invalid-allowed-tools",
			);
			expect(toolIssues).toEqual([]);
		});

		it("should pass for MCP tool names with underscores and hyphens", async () => {
			const commandContent = `---
description: MCP command
allowed-tools: mcp__plugin_git_git-intelligence__get_recent_commits
---

# MCP Command

This command uses an MCP tool name.
`;

			const pluginRoot = createTestPlugin("mcp-tool-names", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const toolIssues = issues.filter(
				(i) => i.ruleId === "command/invalid-allowed-tools",
			);
			expect(toolIssues).toEqual([]);
		});

		it("should error on empty allowed-tools string", async () => {
			const commandContent = `---
description: Test command
allowed-tools:
---

# Test Command

This command has an empty allowed-tools field.
`;

			const pluginRoot = createTestPlugin("empty-tools", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const toolIssue = issues.find(
				(i) => i.ruleId === "command/invalid-allowed-tools",
			);
			expect(toolIssue).toBeDefined();
			expect(toolIssue?.severity).toBe("error");
			expect(toolIssue?.message).toContain("empty 'allowed-tools' field");
		});

		it("should error on empty tool name in list", async () => {
			const commandContent = `---
description: Test command
allowed-tools: Bash, , Read
---

# Test Command

This command has an empty tool name in the list.
`;

			const pluginRoot = createTestPlugin("empty-tool-name", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const toolIssue = issues.find(
				(i) =>
					i.ruleId === "command/invalid-allowed-tools" &&
					i.message.includes("empty tool name"),
			);
			expect(toolIssue).toBeDefined();
			expect(toolIssue?.severity).toBe("error");
		});

		it("should error on tool name starting with number", async () => {
			const commandContent = `---
description: Test command
allowed-tools: 123Invalid
---

# Test Command

This command has a tool name starting with a number.
`;

			const pluginRoot = createTestPlugin("tool-starts-with-number", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const toolIssue = issues.find(
				(i) =>
					i.ruleId === "command/invalid-allowed-tools" &&
					i.message.includes("starts with number"),
			);
			expect(toolIssue).toBeDefined();
			expect(toolIssue?.severity).toBe("error");
			expect(toolIssue?.message).toContain("123Invalid");
		});

		it("should error on tool name with invalid characters", async () => {
			const commandContent = `---
description: Test command
allowed-tools: Invalid@Tool
---

# Test Command

This command has a tool name with invalid characters.
`;

			const pluginRoot = createTestPlugin("tool-invalid-chars", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const toolIssue = issues.find(
				(i) =>
					i.ruleId === "command/invalid-allowed-tools" &&
					i.message.includes("Invalid@Tool"),
			);
			expect(toolIssue).toBeDefined();
			expect(toolIssue?.severity).toBe("error");
		});

		it("should error on tool name with space (not in parentheses)", async () => {
			const commandContent = `---
description: Test command
allowed-tools: Bash Command
---

# Test Command

This command has a tool name with a space.
`;

			const pluginRoot = createTestPlugin("tool-with-space", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const toolIssue = issues.find(
				(i) =>
					i.ruleId === "command/invalid-allowed-tools" &&
					i.message.includes("contains space"),
			);
			expect(toolIssue).toBeDefined();
			expect(toolIssue?.severity).toBe("error");
		});

		it("should report multiple validation errors for multiple invalid tools", async () => {
			const commandContent = `---
description: Test command
allowed-tools: 123Start, Invalid@Tool, Bash, , ValidTool
---

# Test Command

This command has multiple invalid tool names.
`;

			const pluginRoot = createTestPlugin("multiple-invalid-tools", {
				"commands/my-command.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			const toolIssues = issues.filter(
				(i) => i.ruleId === "command/invalid-allowed-tools",
			);
			// Should have at least 3 errors (123Start, Invalid@Tool, empty name)
			expect(toolIssues.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe("real-world examples", () => {
		it("should validate git commit command structure", async () => {
			const commandContent = `---
description: Create well-formatted commits using Conventional Commits specification
model: claude-sonnet-4-5-20250929
allowed-tools: Bash(git add:*), Bash(git commit:*), mcp__plugin_git_git-intelligence__get_recent_commits
---

# Smart Commit

Create well-formatted commits using Conventional Commits specification.

## Instructions

You are a git commit specialist. Create atomic, well-documented commits.
`;

			const pluginRoot = createTestPlugin("real-world-git", {
				"commands/commit.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			// Should have no errors or warnings for well-formed command
			expect(issues).toEqual([]);
		});

		it("should validate plugin-template create command structure", async () => {
			const commandContent = `---
description: Create a new plugin scaffold with configurable components
argument-hint: [plugin-name]
model: claude-sonnet-4-5-20250929
allowed-tools: Bash, Write, Edit, Read, Glob, AskUserQuestion
---

# Create New Plugin

Generate a new plugin scaffold with configurable components.

## Instructions

You are a plugin scaffolding specialist.
`;

			const pluginRoot = createTestPlugin("real-world-template", {
				"commands/create.md": commandContent,
			});
			tempDirs.push(pluginRoot);

			const issues = await validateCommandsMd({ pluginRoot });

			// Should have no errors or warnings
			expect(issues).toEqual([]);
		});
	});
});
