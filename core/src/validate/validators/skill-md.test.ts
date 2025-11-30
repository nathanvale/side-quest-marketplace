/**
 * Tests for skill-md validator
 *
 * Tests SKILL.md validation including:
 * - Legacy content checks (backward compatibility)
 * - YAML frontmatter parsing and validation
 * - Required fields: name, description
 * - Optional fields: allowed-tools
 * - Format validation per Claude Code spec
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateSkillMd } from "./skill-md.js";

const TEST_DIR = join(import.meta.dir, "test-fixtures", "skill-md");

beforeEach(() => {
	if (!existsSync(TEST_DIR)) {
		mkdirSync(TEST_DIR, { recursive: true });
	}
});

afterEach(() => {
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true, force: true });
	}
});

/**
 * Helper to create a skill directory with SKILL.md
 */
function createSkillMd(skillName: string, content: string) {
	const skillDir = join(TEST_DIR, "skills", skillName);
	mkdirSync(skillDir, { recursive: true });
	writeFileSync(join(skillDir, "SKILL.md"), content);
}

/**
 * Helper to create valid frontmatter
 */
function createFrontmatter(
	name: string,
	description: string,
	allowedTools?: string,
): string {
	const frontmatter = ["---", `name: ${name}`, `description: ${description}`];

	if (allowedTools) {
		frontmatter.push(`allowed-tools: ${allowedTools}`);
	}

	frontmatter.push("---");
	return frontmatter.join("\n");
}

/**
 * Helper to create a complete valid SKILL.md
 */
function createValidSkillMd(
	skillName: string = "my-skill",
	options: {
		name?: string;
		description?: string;
		allowedTools?: string;
		content?: string;
	} = {},
): void {
	const name = options.name ?? "my-skill";
	// Default description meets all quality heuristics: 50+ chars, has trigger word, has action verb
	const description =
		options.description ??
		"Analyze test cases and generate validation reports when testing.";
	const content =
		options.content ?? "\n\n# My Skill\n\nThis is a test skill.\n";

	const frontmatter = createFrontmatter(
		name,
		description,
		options.allowedTools,
	);
	const fullContent = `${frontmatter}${content}`;

	createSkillMd(skillName, fullContent);
}

describe("validateSkillMd", () => {
	describe("missing skills directory", () => {
		test("returns no issues when skills directory doesn't exist", async () => {
			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });
			expect(issues).toHaveLength(0);
		});
	});

	describe("missing SKILL.md file", () => {
		test("returns error when SKILL.md doesn't exist in skill directory", async () => {
			const skillDir = join(TEST_DIR, "skills", "test-skill");
			mkdirSync(skillDir, { recursive: true });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(1);
			expect(issues[0]).toMatchObject({
				ruleId: "skill/missing-file",
				severity: "error",
				message: expect.stringContaining("SKILL.md not found"),
			});
		});
	});

	describe("legacy validations (backward compatibility)", () => {
		test("warns when content is too short", async () => {
			createSkillMd("short-skill", "# Short");

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "skill/too-short")).toBe(true);
		});

		test("warns when missing heading", async () => {
			createSkillMd(
				"no-heading",
				"This is a skill without a heading but with enough content to pass the length check.",
			);

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "skill/missing-heading")).toBe(
				true,
			);
		});

		test("passes legacy checks with sufficient content and heading", async () => {
			createSkillMd(
				"good-legacy",
				"# Good Skill\n\nThis skill has a heading and sufficient content to pass the legacy validation checks.",
			);

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			const legacyIssues = issues.filter(
				(i) =>
					i.ruleId === "skill/too-short" ||
					i.ruleId === "skill/missing-heading",
			);
			expect(legacyIssues).toHaveLength(0);
		});
	});

	describe("frontmatter validation", () => {
		test("warns when frontmatter is missing", async () => {
			createSkillMd(
				"no-frontmatter",
				"# Skill Without Frontmatter\n\nThis skill has enough content but no frontmatter.",
			);

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "skill/missing-frontmatter")).toBe(
				true,
			);
			const warning = issues.find(
				(i) => i.ruleId === "skill/missing-frontmatter",
			);
			expect(warning?.severity).toBe("warning");
		});

		test("skips further frontmatter validation when frontmatter is missing", async () => {
			createSkillMd("no-frontmatter", "# Skill\n\nNo frontmatter here.");

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			const frontmatterIssues = issues.filter(
				(i) =>
					i.ruleId === "skill/missing-name" ||
					i.ruleId === "skill/missing-description",
			);
			expect(frontmatterIssues).toHaveLength(0);
		});
	});

	describe("name field validation", () => {
		test("returns error when name field is missing", async () => {
			createSkillMd(
				"missing-name",
				"---\ndescription: A skill without a name\n---\n\n# Skill\n\nContent here.",
			);

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "skill/missing-name")).toBe(true);
			const error = issues.find((i) => i.ruleId === "skill/missing-name");
			expect(error?.severity).toBe("error");
		});

		test("returns error when name contains uppercase letters", async () => {
			createValidSkillMd("invalid-name", { name: "My-Skill" });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "skill/invalid-name-format")).toBe(
				true,
			);
			const error = issues.find(
				(i) => i.ruleId === "skill/invalid-name-format",
			);
			expect(error?.message).toContain("My-Skill");
		});

		test("returns error when name contains spaces", async () => {
			createValidSkillMd("invalid-name", { name: "my skill" });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "skill/invalid-name-format")).toBe(
				true,
			);
		});

		test("returns error when name contains special characters", async () => {
			createValidSkillMd("invalid-name", { name: "my_skill!" });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "skill/invalid-name-format")).toBe(
				true,
			);
		});

		test("returns error when name exceeds 64 characters", async () => {
			const longName = "a".repeat(65);
			createValidSkillMd("long-name", { name: longName });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "skill/invalid-name-format")).toBe(
				true,
			);
			const error = issues.find(
				(i) => i.ruleId === "skill/invalid-name-format",
			);
			expect(error?.message).toContain("64 characters");
			expect(error?.message).toContain("65 chars");
		});

		test("accepts valid name with lowercase letters", async () => {
			createValidSkillMd("valid-name", { name: "myskill" });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.filter((i) => i.ruleId.includes("name"))).toHaveLength(0);
		});

		test("accepts valid name with hyphens", async () => {
			createValidSkillMd("valid-name", { name: "my-skill-name" });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.filter((i) => i.ruleId.includes("name"))).toHaveLength(0);
		});

		test("accepts valid name with numbers", async () => {
			createValidSkillMd("valid-name", { name: "skill-v2-test" });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.filter((i) => i.ruleId.includes("name"))).toHaveLength(0);
		});

		test("accepts name exactly 64 characters long", async () => {
			const maxName = "a".repeat(64);
			createValidSkillMd("max-name", { name: maxName });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.filter((i) => i.ruleId.includes("name"))).toHaveLength(0);
		});
	});

	describe("description field validation", () => {
		test("returns error when description field is missing", async () => {
			createSkillMd(
				"missing-description",
				"---\nname: my-skill\n---\n\n# Skill\n\nContent here.",
			);

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.some((i) => i.ruleId === "skill/missing-description")).toBe(
				true,
			);
			const error = issues.find(
				(i) => i.ruleId === "skill/missing-description",
			);
			expect(error?.severity).toBe("error");
		});

		test("returns error when description exceeds 1024 characters", async () => {
			const longDescription = "a".repeat(1025);
			createValidSkillMd("long-description", { description: longDescription });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.some((i) => i.ruleId === "skill/description-too-long"),
			).toBe(true);
			const error = issues.find(
				(i) => i.ruleId === "skill/description-too-long",
			);
			expect(error?.message).toContain("1024 characters");
			expect(error?.message).toContain("1025 chars");
		});

		test("accepts description at exactly 1024 characters", async () => {
			const maxDescription = "a".repeat(1024);
			createValidSkillMd("max-description", { description: maxDescription });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.filter((i) => i.ruleId === "skill/description-too-long"),
			).toHaveLength(0);
		});

		test("accepts valid description with normal text", async () => {
			createValidSkillMd("valid-description", {
				description:
					"A helpful skill that creates test fixtures when you need validation data.",
			});

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.filter((i) => i.ruleId.includes("description")),
			).toHaveLength(0);
		});
	});

	describe("description quality heuristics", () => {
		test("warns when description is too short (< 50 chars)", async () => {
			createValidSkillMd("short-description", {
				description: "Helps with documents",
			});

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.some((i) => i.ruleId === "skill/description-too-short"),
			).toBe(true);
			const warning = issues.find(
				(i) => i.ruleId === "skill/description-too-short",
			);
			expect(warning?.severity).toBe("warning");
			expect(warning?.message).toContain("20 chars");
			expect(warning?.suggestion).toContain("at least 50 characters");
		});

		test("warns when description is missing trigger words", async () => {
			createValidSkillMd("no-triggers", {
				description:
					"A sophisticated tool that analyzes and processes various types of data",
			});

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.some(
					(i) => i.ruleId === "skill/description-missing-trigger-words",
				),
			).toBe(true);
			const warning = issues.find(
				(i) => i.ruleId === "skill/description-missing-trigger-words",
			);
			expect(warning?.severity).toBe("warning");
			expect(warning?.suggestion).toContain("when");
		});

		test("warns when description is missing action verbs", async () => {
			createValidSkillMd("no-actions", {
				description:
					"This is a tool for working with files when you need document support",
			});

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.some(
					(i) => i.ruleId === "skill/description-missing-action-verbs",
				),
			).toBe(true);
			const warning = issues.find(
				(i) => i.ruleId === "skill/description-missing-action-verbs",
			);
			expect(warning?.severity).toBe("warning");
			expect(warning?.suggestion).toContain("action verbs");
		});

		test("passes with high-quality description (has length, triggers, and actions)", async () => {
			createValidSkillMd("quality-description", {
				description:
					"Analyze Excel spreadsheets, create pivot tables, and generate charts. Use when working with Excel files or tabular data.",
			});

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			// Should have no quality warnings
			expect(
				issues.filter(
					(i) =>
						i.ruleId === "skill/description-too-short" ||
						i.ruleId === "skill/description-missing-trigger-words" ||
						i.ruleId === "skill/description-missing-action-verbs",
				),
			).toHaveLength(0);
		});

		test("passes with description containing 'for' as trigger word", async () => {
			createValidSkillMd("for-trigger", {
				description:
					"Search code repositories and find patterns. Great for debugging complex codebases.",
			});

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.filter(
					(i) => i.ruleId === "skill/description-missing-trigger-words",
				),
			).toHaveLength(0);
		});

		test("passes with description containing 'helps' as trigger word", async () => {
			createValidSkillMd("helps-trigger", {
				description:
					"Generate documentation from source code. Helps with maintaining API references and developer guides.",
			});

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.filter(
					(i) => i.ruleId === "skill/description-missing-trigger-words",
				),
			).toHaveLength(0);
		});

		test("accepts description at exactly 50 characters", async () => {
			createValidSkillMd("exact-50", {
				description: "Generate and analyze all reports when you need it.",
			});

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.filter((i) => i.ruleId === "skill/description-too-short"),
			).toHaveLength(0);
		});
	});

	describe("allowed-tools field validation", () => {
		test("accepts valid allowed-tools with single tool", async () => {
			createValidSkillMd("single-tool", { allowedTools: "Read" });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.filter((i) => i.ruleId === "skill/invalid-allowed-tools"),
			).toHaveLength(0);
		});

		test("accepts valid allowed-tools with multiple tools", async () => {
			createValidSkillMd("multiple-tools", {
				allowedTools: "Read, Grep, Write",
			});

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.filter((i) => i.ruleId === "skill/invalid-allowed-tools"),
			).toHaveLength(0);
		});

		test("accepts allowed-tools with extra whitespace", async () => {
			createValidSkillMd("whitespace-tools", {
				allowedTools: "Read,  Grep  , Write",
			});

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.filter((i) => i.ruleId === "skill/invalid-allowed-tools"),
			).toHaveLength(0);
		});

		test("warns when allowed-tools has empty values", async () => {
			createValidSkillMd("empty-tools", { allowedTools: "Read, , Write" });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.some((i) => i.ruleId === "skill/invalid-allowed-tools"),
			).toBe(true);
		});

		test("warns when allowed-tools is just commas", async () => {
			createValidSkillMd("comma-only", { allowedTools: ",,," });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.some((i) => i.ruleId === "skill/invalid-allowed-tools"),
			).toBe(true);
		});

		test("passes when allowed-tools is omitted", async () => {
			createValidSkillMd("no-tools");

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(
				issues.filter((i) => i.ruleId === "skill/invalid-allowed-tools"),
			).toHaveLength(0);
		});
	});

	describe("complete valid SKILL.md", () => {
		test("passes with minimal valid frontmatter and content", async () => {
			createValidSkillMd("complete-skill");

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("passes with all optional fields", async () => {
			createValidSkillMd("full-skill", {
				allowedTools: "Read, Grep, Write, Edit",
			});

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("passes with complex content after frontmatter", async () => {
			createValidSkillMd("complex-skill", {
				content: `

# My Complex Skill

This skill does amazing things.

## Usage

Use this skill when you need to:
- Do task A
- Do task B
- Do task C

## Examples

Here are some examples of how to use this skill.
`,
			});

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});
	});

	describe("multiple skills", () => {
		test("validates multiple skills in the same directory", async () => {
			createValidSkillMd("skill-one");
			createValidSkillMd("skill-two", { name: "skill-two" });
			createValidSkillMd("skill-three", { name: "skill-three" });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues).toHaveLength(0);
		});

		test("reports issues for each invalid skill separately", async () => {
			createValidSkillMd("valid-skill");
			createSkillMd("invalid-skill", "# No frontmatter");
			createValidSkillMd("missing-name", { name: "" });

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.length).toBeGreaterThan(0);
			// Should have issues for invalid-skill (missing frontmatter)
			expect(issues.some((i) => i.message.includes("invalid-skill"))).toBe(
				true,
			);
		});
	});

	describe("frontmatter parsing edge cases", () => {
		test("handles frontmatter with comments", async () => {
			createSkillMd(
				"with-comments",
				`---
# This is a comment
name: my-skill
description: A test skill
# Another comment
---

# Skill Content`,
			);

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
		});

		test("handles frontmatter with extra whitespace", async () => {
			createSkillMd(
				"with-whitespace",
				`---
name:    my-skill
description:   A test skill
---

# Skill Content`,
			);

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
		});

		test("ignores unknown frontmatter fields", async () => {
			createSkillMd(
				"unknown-fields",
				`---
name: my-skill
description: A test skill
author: Test Author
version: 1.0.0
---

# Skill Content`,
			);

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
		});

		test("handles frontmatter at start of file only", async () => {
			createSkillMd(
				"frontmatter-start",
				`---
name: my-skill
description: A test skill
---

# Content

Some other text:

---
This is not frontmatter
---`,
			);

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
		});
	});

	describe("error handling", () => {
		test("handles validation errors gracefully", async () => {
			// Create a skills directory but make it unreadable
			const skillsDir = join(TEST_DIR, "skills");
			mkdirSync(skillsDir, { recursive: true });

			// Write a file named the same as what should be a directory
			writeFileSync(join(skillsDir, "bad-entry"), "not a directory");

			const issues = await validateSkillMd({ pluginRoot: TEST_DIR });

			// Should not throw, just skip the non-directory entry
			expect(
				issues.filter((i) => i.ruleId === "skill/validation-error"),
			).toHaveLength(0);
		});
	});
});
