import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateAgentsMd } from "./agents-md.ts";

describe("validateAgentsMd", () => {
	const testRoot = join(import.meta.dir, "test-fixtures", "agents-md-test");

	beforeEach(() => {
		// Clean up test directory if it exists
		if (existsSync(testRoot)) {
			rmSync(testRoot, { recursive: true, force: true });
		}
		mkdirSync(testRoot, { recursive: true });
	});

	afterEach(() => {
		// Clean up test directory after each test
		if (existsSync(testRoot)) {
			rmSync(testRoot, { recursive: true, force: true });
		}
	});

	test("returns empty array when agents directory does not exist", async () => {
		const issues = await validateAgentsMd({ pluginRoot: testRoot });
		expect(issues).toEqual([]);
	});

	test("warns when agents directory exists but has no .md files", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/missing-file",
			severity: "warning",
			message: "No agent .md files found in agents/ directory",
		});
	});

	test("errors when agent file is missing frontmatter", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`# Security Reviewer

This agent reviews code for security issues.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/missing-frontmatter",
			severity: "error",
			message: expect.stringContaining("missing YAML frontmatter"),
			file: agentFile,
		});
	});

	test("errors when agent file has frontmatter without name", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
description: Reviews code for security issues
---

# Security Reviewer

This agent reviews code for security issues.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/missing-name",
			severity: "error",
			message: expect.stringContaining("missing required 'name' field"),
			file: agentFile,
		});
	});

	test("errors when agent file has frontmatter without description", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
---

# Security Reviewer

This agent reviews code for security issues.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/missing-description",
			severity: "error",
			message: expect.stringContaining("missing required 'description' field"),
			file: agentFile,
		});
	});

	test("errors when description field is empty", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
description:
---

# Security Reviewer

This agent reviews code for security issues.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/missing-description",
			severity: "error",
			message: expect.stringContaining("missing required 'description' field"),
			file: agentFile,
		});
	});

	test("errors when name has invalid format (uppercase)", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: Security-Reviewer
description: Reviews code for security issues
---

# Security Reviewer

This agent reviews code for security issues.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/invalid-name-format",
			severity: "error",
			message: expect.stringContaining("invalid name format"),
			file: agentFile,
		});
	});

	test("errors when name has invalid format (spaces)", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security reviewer
description: Reviews code for security issues
---

# Security Reviewer

This agent reviews code for security issues.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/invalid-name-format",
			severity: "error",
			message: expect.stringContaining("invalid name format"),
			file: agentFile,
		});
	});

	test("errors when name exceeds 64 characters", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		const longName = "a".repeat(65);
		writeFileSync(
			agentFile,
			`---
name: ${longName}
description: Reviews code for security issues
---

# Security Reviewer

This agent reviews code for security issues.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/invalid-name-format",
			severity: "error",
			message: expect.stringContaining("exceeding 64 characters"),
			file: agentFile,
		});
	});

	test("errors when model has invalid value", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
description: Reviews code for security issues
model: gpt-4
---

# Security Reviewer

This agent reviews code for security issues.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/invalid-model",
			severity: "error",
			message: expect.stringContaining("invalid 'model' value"),
			file: agentFile,
		});
	});

	test("errors when permissionMode has invalid value", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
description: Reviews code for security issues
permissionMode: unsafe
---

# Security Reviewer

This agent reviews code for security issues.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/invalid-permission-mode",
			severity: "error",
			message: expect.stringContaining("invalid 'permissionMode' value"),
			file: agentFile,
		});
	});

	test("warns when tools has invalid format", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
description: Reviews code for security issues
tools: ,,
---

# Security Reviewer

This agent reviews code for security issues.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/invalid-tools-format",
			severity: "warning",
			message: expect.stringContaining("invalid 'tools' format"),
			file: agentFile,
		});
	});

	test("warns when skills has invalid format", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
description: Reviews code for security issues
skills: ,,
---

# Security Reviewer

This agent reviews code for security issues.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/invalid-skills-format",
			severity: "warning",
			message: expect.stringContaining("invalid 'skills' format"),
			file: agentFile,
		});
	});

	test("warns when content after frontmatter is too short", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
description: Reviews code for security issues
---

# Title`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/too-short",
			severity: "warning",
			message: expect.stringContaining("very little content"),
			file: agentFile,
		});
	});

	test("warns when missing markdown heading", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
description: Reviews code for security issues
---

This agent is responsible for reviewing code for security vulnerabilities and best practices.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/missing-heading",
			severity: "warning",
			message: expect.stringContaining("should have a markdown heading"),
			file: agentFile,
		});
	});

	test("passes validation with valid agent file", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
description: Reviews code for security vulnerabilities
---

# Security Reviewer

This agent specializes in reviewing code for security vulnerabilities and best practices.
It checks for common security issues, analyzes dependencies, and provides recommendations.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(0);
	});

	test("passes validation with valid optional fields", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
description: Reviews code for security vulnerabilities
model: sonnet
permissionMode: default
tools: Read, Grep, Write
skills: security-check, code-analysis
---

# Security Reviewer

This agent specializes in reviewing code for security vulnerabilities and best practices.
It checks for common security issues, analyzes dependencies, and provides recommendations.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(0);
	});

	test("validates multiple agent files", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		// Valid file
		const validFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			validFile,
			`---
name: security-reviewer
description: Reviews code for security vulnerabilities
---

# Security Reviewer

This agent specializes in reviewing code for security vulnerabilities and best practices.`,
		);

		// Invalid file - missing frontmatter
		const invalidFile = join(agentsDir, "performance-tester.md");
		writeFileSync(
			invalidFile,
			`# Performance Tester

This agent tests performance.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			ruleId: "agents/missing-frontmatter",
			severity: "error",
			file: invalidFile,
		});
	});

	test("ignores non-markdown files in agents directory", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		// Create a non-markdown file
		writeFileSync(join(agentsDir, "README.txt"), "This is a readme");

		// Create a valid agent file
		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
description: Reviews code for security vulnerabilities
---

# Security Reviewer

This agent specializes in reviewing code for security vulnerabilities and best practices.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(0);
	});

	test("handles validation errors gracefully", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		// Create a file with invalid permissions (simulate read error)
		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(agentFile, "---\ndescription: Test\n---\n\n# Test");

		// Override Bun.file to throw an error
		const originalFile = Bun.file;
		Bun.file = (() => {
			throw new Error("Simulated read error");
		}) as typeof Bun.file;

		try {
			const issues = await validateAgentsMd({ pluginRoot: testRoot });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "agents/validation-error",
				severity: "error",
				message: expect.stringContaining("Failed to validate agents"),
			});
		} finally {
			// Restore original Bun.file
			Bun.file = originalFile;
		}
	});

	test("accepts description with special characters", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
description: Reviews code for security issues (OWASP Top 10)
---

# Security Reviewer

This agent specializes in reviewing code for security vulnerabilities and best practices.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(0);
	});

	test("accepts description with quotes", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer
description: "Reviews code for security vulnerabilities"
---

# Security Reviewer

This agent specializes in reviewing code for security vulnerabilities and best practices.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(0);
	});

	test("accepts name with numbers and hyphens", async () => {
		const agentsDir = join(testRoot, "agents");
		mkdirSync(agentsDir);

		const agentFile = join(agentsDir, "security-reviewer-v2.md");
		writeFileSync(
			agentFile,
			`---
name: security-reviewer-v2
description: Reviews code for security vulnerabilities
---

# Security Reviewer V2

This agent specializes in reviewing code for security vulnerabilities and best practices.`,
		);

		const issues = await validateAgentsMd({ pluginRoot: testRoot });

		expect(issues).toHaveLength(0);
	});
});
