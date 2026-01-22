/**
 * Integration tests demonstrating the frontmatter_set tool with hints.
 *
 * These tests verify the complete workflow of setting frontmatter fields
 * and receiving helpful enum suggestions and type hints in the response.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	cleanupTestDir,
	createTempDir,
	writeTestFile,
} from "@sidequest/core/testing";
import type { ParaObsidianConfig } from "../src/config";
import { loadConfig } from "../src/config";
import { readFrontmatterFile, updateFrontmatterFile } from "../src/frontmatter";

// Test helper that mirrors the MCP server hint logic
interface FrontmatterHint {
	readonly allowedValues?: ReadonlyArray<string>;
	readonly expectedType?:
		| "string"
		| "date"
		| "number"
		| "array"
		| "wikilink"
		| "enum";
	readonly examples?: ReadonlyArray<string>;
	readonly description?: string;
}

function computeFrontmatterHint(
	config: ParaObsidianConfig,
	noteType: string,
	field: string,
): FrontmatterHint | undefined {
	const rules = config.frontmatterRules?.[noteType];
	if (!rules?.required) return undefined;

	const rule = rules.required[field];
	if (!rule) return undefined;

	// Build hint object with all properties at creation time
	const hintProps: FrontmatterHint = {
		expectedType: rule.type,
		description: rule.description,
	};

	// Add enum-specific hints
	if (rule.type === "enum" && rule.enum) {
		return {
			...hintProps,
			allowedValues: rule.enum,
			examples: [rule.enum[0]!], // First enum value as example
		};
	}

	// Add array-specific hints
	if (rule.type === "array") {
		return {
			...hintProps,
			examples: rule.includes
				? [`[${rule.includes.map((v) => `"${v}"`).join(", ")}]`]
				: ['["tag1", "tag2"]'],
		};
	}

	// Add date-specific hints
	if (rule.type === "date") {
		const today = new Date().toISOString().split("T")[0]!;
		return {
			...hintProps,
			examples: [today],
		};
	}

	// Add wikilink-specific hints
	if (rule.type === "wikilink") {
		return {
			...hintProps,
			examples: ["[[Note Name]]"],
		};
	}

	return hintProps;
}

function formatFrontmatterHint(field: string, hint: FrontmatterHint): string {
	const parts: string[] = [];

	if (hint.description) {
		parts.push(hint.description);
	}

	if (hint.expectedType) {
		parts.push(`Type: ${hint.expectedType}`);
	}

	if (hint.allowedValues && hint.allowedValues.length > 0) {
		parts.push(`Allowed values: ${hint.allowedValues.join(", ")}`);
	}

	if (hint.examples && hint.examples.length > 0) {
		parts.push(`Example: ${field}: ${hint.examples[0]}`);
	}

	return parts.length > 0
		? `\n\n**Hint for ${field}:**\n${parts.join("\n")}`
		: "";
}

// Simulates the MCP tool response generation
function simulateFrontmatterSetResponse(
	config: ParaObsidianConfig,
	file: string,
	set: Record<string, unknown>,
): string {
	const { attributes } = readFrontmatterFile(config, file);
	const noteType = attributes.type as string | undefined;

	const result = updateFrontmatterFile(config, file, {
		set,
		dryRun: true, // Use dry-run for tests
	});

	const lines = [`## Would update Frontmatter: ${result.relative}`, ""];
	if (result.changes.length === 0) {
		lines.push("_No changes_");
	} else {
		lines.push("**Changes:**");
		for (const change of result.changes) {
			lines.push(`- ${change}`);
		}
	}

	// Add hints for fields that were set
	if (noteType) {
		const hintLines: string[] = [];
		for (const field of Object.keys(set)) {
			const hint = computeFrontmatterHint(config, noteType, field);
			if (hint) {
				hintLines.push(formatFrontmatterHint(field, hint));
			}
		}
		if (hintLines.length > 0) {
			lines.push("");
			lines.push("---");
			lines.push(...hintLines);
		}
	}

	return lines.join("\n");
}

describe("frontmatter_set integration with hints", () => {
	let testVault: string;
	const originalEnv = process.env.PARA_VAULT;

	beforeEach(() => {
		// Create temporary vault
		testVault = createTempDir("para-test-");
		process.env.PARA_VAULT = testVault;
	});

	afterEach(() => {
		// Cleanup
		process.env.PARA_VAULT = originalEnv;
		cleanupTestDir(testVault);
	});

	test("provides enum hints when setting project status", () => {
		// Create a test project note
		const initialContent = `---
title: My Project
type: project
status: active
created: 2024-01-01
start_date: 2024-01-01
target_completion: 2024-12-31
area: "[[Work]]"
reviewed: 2024-01-01
review_period: monthly
tags:
  - project
---

# My Project

Content here.`;

		writeTestFile(testVault, "My Project.md", initialContent);

		const config = loadConfig();
		const response = simulateFrontmatterSetResponse(config, "My Project.md", {
			status: "on-hold",
		});

		// Verify the response includes helpful hints
		expect(response).toContain("## Would update Frontmatter");
		expect(response).toContain("set status");
		expect(response).toContain("**Hint for status:**");
		expect(response).toContain("Type: enum");
		expect(response).toContain(
			"Allowed values: active, on-hold, completed, archived",
		);
		expect(response).toContain("Example: status: active");
	});

	test("provides enum hints when setting task priority", () => {
		const initialContent = `---
title: My Task
type: task
task_type: task
status: not-started
priority: medium
effort: medium
created: 2024-01-01
reviewed: 2024-01-01
tags:
  - task
---

# My Task

Task details.`;

		writeTestFile(testVault, "My Task.md", initialContent);

		const config = loadConfig();
		const response = simulateFrontmatterSetResponse(config, "My Task.md", {
			priority: "high",
		});

		// Verify the response includes helpful hints
		expect(response).toContain("**Hint for priority:**");
		expect(response).toContain("Type: enum");
		expect(response).toContain("Allowed values: low, medium, high, urgent");
		expect(response).toContain("Example: priority: low");
	});

	test("provides hints for multiple fields", () => {
		const initialContent = `---
title: My Task
type: task
task_type: task
status: not-started
priority: low
effort: small
created: 2024-01-01
reviewed: 2024-01-01
tags:
  - task
---

# My Task`;

		writeTestFile(testVault, "My Task.md", initialContent);

		const config = loadConfig();
		const response = simulateFrontmatterSetResponse(config, "My Task.md", {
			status: "in-progress",
			priority: "high",
			effort: "large",
		});

		// Verify hints for all three fields
		expect(response).toContain("**Hint for status:**");
		expect(response).toContain(
			"Allowed values: not-started, in-progress, blocked, done, cancelled",
		);

		expect(response).toContain("**Hint for priority:**");
		expect(response).toContain("Allowed values: low, medium, high, urgent");

		expect(response).toContain("**Hint for effort:**");
		expect(response).toContain("Allowed values: small, medium, large");
	});

	test("provides date hints for date fields", () => {
		const initialContent = `---
title: My Project
type: project
status: active
created: 2024-01-01
start_date: 2024-01-01
target_completion: 2024-12-31
area: "[[Work]]"
reviewed: 2024-01-01
review_period: monthly
tags:
  - project
---

# My Project`;

		writeTestFile(testVault, "My Project.md", initialContent);

		const config = loadConfig();
		const response = simulateFrontmatterSetResponse(config, "My Project.md", {
			start_date: "2024-02-01",
		});

		expect(response).toContain("**Hint for start_date:**");
		expect(response).toContain("Type: date");
		expect(response).toContain("Example: start_date:");
		// Check that the example is a valid date format
		expect(response).toMatch(/Example: start_date: \d{4}-\d{2}-\d{2}/);
	});

	test("provides wikilink hints for link fields", () => {
		const initialContent = `---
title: My Project
type: project
status: active
created: 2024-01-01
start_date: 2024-01-01
target_completion: 2024-12-31
area: "[[Work]]"
reviewed: 2024-01-01
review_period: monthly
tags:
  - project
---

# My Project`;

		writeTestFile(testVault, "My Project.md", initialContent);

		const config = loadConfig();
		const response = simulateFrontmatterSetResponse(config, "My Project.md", {
			area: "[[Personal]]",
		});

		expect(response).toContain("**Hint for area:**");
		expect(response).toContain("Type: wikilink");
		expect(response).toContain("Example: area: [[Note Name]]");
	});

	test("provides hints for resource source_format field", () => {
		const initialContent = `---
title: My Resource
type: resource
source_format: article
created: 2024-01-01
tags:
  - resource
---

# My Resource`;

		writeTestFile(testVault, "My Resource.md", initialContent);

		const config = loadConfig();
		const response = simulateFrontmatterSetResponse(config, "My Resource.md", {
			source_format: "video",
		});

		expect(response).toContain("**Hint for source_format:**");
		expect(response).toContain("Type: enum");
		expect(response).toContain(
			"Allowed values: article, video, audio, document, thread, image, book, course, podcast, paper",
		);
		expect(response).toContain("Example: source_format: article");
	});

	test("no hints for unknown fields", () => {
		const initialContent = `---
title: My Project
type: project
status: active
created: 2024-01-01
start_date: 2024-01-01
target_completion: 2024-12-31
area: "[[Work]]"
reviewed: 2024-01-01
review_period: monthly
tags:
  - project
---

# My Project`;

		writeTestFile(testVault, "My Project.md", initialContent);

		const config = loadConfig();
		const response = simulateFrontmatterSetResponse(config, "My Project.md", {
			custom_field: "custom value",
		});

		// Should still show the change
		expect(response).toContain("set custom_field");
		// But no hint section since the field isn't in the rules
		expect(response).not.toContain("**Hint for custom_field:**");
	});
});
