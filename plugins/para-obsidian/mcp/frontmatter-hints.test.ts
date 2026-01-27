/**
 * Tests for frontmatter field hint functionality.
 *
 * Verifies that the frontmatter_set tool provides helpful hints
 * for enum values, expected types, and examples.
 */
import { describe, expect, test } from "bun:test";
import type { ParaObsidianConfig } from "../src/config";

// Test helpers that mirror the MCP server implementation
interface FrontmatterHint {
	readonly allowedValues?: ReadonlyArray<string>;
	readonly expectedType?:
		| "string"
		| "date"
		| "number"
		| "array"
		| "wikilink"
		| "enum"
		| "boolean";
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

// Mock config with realistic frontmatter rules
const mockConfig: ParaObsidianConfig = {
	vault: "/tmp/test-vault",
	frontmatterRules: {
		project: {
			required: {
				status: {
					type: "enum",
					enum: ["active", "on-hold", "completed", "archived"],
				},
				priority: {
					type: "enum",
					enum: ["high", "medium", "low"],
					description: "Project priority level",
				},
				tags: {
					type: "array",
					includes: ["project"],
				},
				start_date: {
					type: "date",
				},
				area: {
					type: "wikilink",
				},
			},
		},
		task: {
			required: {
				status: {
					type: "enum",
					enum: ["not-started", "in-progress", "blocked", "done", "cancelled"],
				},
				priority: {
					type: "enum",
					enum: ["low", "medium", "high", "urgent"],
				},
				effort: {
					type: "enum",
					enum: ["small", "medium", "large"],
				},
			},
		},
		resource: {
			required: {
				source: {
					type: "enum",
					enum: [
						"book",
						"article",
						"video",
						"course",
						"podcast",
						"paper",
						"web",
					],
				},
			},
		},
	},
};

describe("computeFrontmatterHint", () => {
	test("returns hint for enum field with allowed values", () => {
		const hint = computeFrontmatterHint(mockConfig, "project", "status");

		expect(hint).toBeDefined();
		expect(hint?.expectedType).toBe("enum");
		expect(hint?.allowedValues).toEqual([
			"active",
			"on-hold",
			"completed",
			"archived",
		]);
		expect(hint?.examples).toEqual(["active"]);
	});

	test("returns hint for enum field with description", () => {
		const hint = computeFrontmatterHint(mockConfig, "project", "priority");

		expect(hint).toBeDefined();
		expect(hint?.expectedType).toBe("enum");
		expect(hint?.allowedValues).toEqual(["high", "medium", "low"]);
		expect(hint?.description).toBe("Project priority level");
		expect(hint?.examples).toEqual(["high"]);
	});

	test("returns hint for array field with includes", () => {
		const hint = computeFrontmatterHint(mockConfig, "project", "tags");

		expect(hint).toBeDefined();
		expect(hint?.expectedType).toBe("array");
		expect(hint?.examples).toEqual(['["project"]']);
	});

	test("returns hint for date field with current date", () => {
		const hint = computeFrontmatterHint(mockConfig, "project", "start_date");

		expect(hint).toBeDefined();
		expect(hint?.expectedType).toBe("date");
		expect(hint?.examples).toBeDefined();
		expect(hint?.examples?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	test("returns hint for wikilink field", () => {
		const hint = computeFrontmatterHint(mockConfig, "project", "area");

		expect(hint).toBeDefined();
		expect(hint?.expectedType).toBe("wikilink");
		expect(hint?.examples).toEqual(["[[Note Name]]"]);
	});

	test("returns undefined for non-existent note type", () => {
		const hint = computeFrontmatterHint(mockConfig, "nonexistent", "status");

		expect(hint).toBeUndefined();
	});

	test("returns undefined for non-existent field", () => {
		const hint = computeFrontmatterHint(mockConfig, "project", "nonexistent");

		expect(hint).toBeUndefined();
	});

	test("handles different enum values for same field across note types", () => {
		const projectStatus = computeFrontmatterHint(
			mockConfig,
			"project",
			"status",
		);
		const taskStatus = computeFrontmatterHint(mockConfig, "task", "status");

		expect(projectStatus?.allowedValues).toEqual([
			"active",
			"on-hold",
			"completed",
			"archived",
		]);
		expect(taskStatus?.allowedValues).toEqual([
			"not-started",
			"in-progress",
			"blocked",
			"done",
			"cancelled",
		]);
	});

	test("handles task priority field", () => {
		const hint = computeFrontmatterHint(mockConfig, "task", "priority");

		expect(hint).toBeDefined();
		expect(hint?.expectedType).toBe("enum");
		expect(hint?.allowedValues).toEqual(["low", "medium", "high", "urgent"]);
		expect(hint?.examples).toEqual(["low"]);
	});

	test("handles resource source field", () => {
		const hint = computeFrontmatterHint(mockConfig, "resource", "source");

		expect(hint).toBeDefined();
		expect(hint?.expectedType).toBe("enum");
		expect(hint?.allowedValues).toEqual([
			"book",
			"article",
			"video",
			"course",
			"podcast",
			"paper",
			"web",
		]);
		expect(hint?.examples).toEqual(["book"]);
	});
});

describe("formatFrontmatterHint", () => {
	test("formats enum hint with all components", () => {
		const hint: FrontmatterHint = {
			expectedType: "enum",
			allowedValues: ["active", "on-hold", "completed"],
			examples: ["active"],
			description: "Project status",
		};

		const formatted = formatFrontmatterHint("status", hint);

		expect(formatted).toContain("**Hint for status:**");
		expect(formatted).toContain("Project status");
		expect(formatted).toContain("Type: enum");
		expect(formatted).toContain("Allowed values: active, on-hold, completed");
		expect(formatted).toContain("Example: status: active");
	});

	test("formats hint without description", () => {
		const hint: FrontmatterHint = {
			expectedType: "enum",
			allowedValues: ["high", "medium", "low"],
			examples: ["high"],
		};

		const formatted = formatFrontmatterHint("priority", hint);

		expect(formatted).toContain("**Hint for priority:**");
		expect(formatted).toContain("Type: enum");
		expect(formatted).toContain("Allowed values: high, medium, low");
		expect(formatted).toContain("Example: priority: high");
		expect(formatted).not.toContain("undefined");
	});

	test("formats array hint", () => {
		const hint: FrontmatterHint = {
			expectedType: "array",
			examples: ['["project", "work"]'],
		};

		const formatted = formatFrontmatterHint("tags", hint);

		expect(formatted).toContain("**Hint for tags:**");
		expect(formatted).toContain("Type: array");
		expect(formatted).toContain('Example: tags: ["project", "work"]');
	});

	test("formats date hint", () => {
		const hint: FrontmatterHint = {
			expectedType: "date",
			examples: ["2024-01-15"],
		};

		const formatted = formatFrontmatterHint("start_date", hint);

		expect(formatted).toContain("**Hint for start_date:**");
		expect(formatted).toContain("Type: date");
		expect(formatted).toContain("Example: start_date: 2024-01-15");
	});

	test("formats wikilink hint", () => {
		const hint: FrontmatterHint = {
			expectedType: "wikilink",
			examples: ["[[Note Name]]"],
		};

		const formatted = formatFrontmatterHint("area", hint);

		expect(formatted).toContain("**Hint for area:**");
		expect(formatted).toContain("Type: wikilink");
		expect(formatted).toContain("Example: area: [[Note Name]]");
	});

	test("returns empty string for empty hint", () => {
		const hint: FrontmatterHint = {};

		const formatted = formatFrontmatterHint("field", hint);

		expect(formatted).toBe("");
	});
});

describe("Integration: Hint workflow", () => {
	test("provides helpful hints for setting project status", () => {
		const hint = computeFrontmatterHint(mockConfig, "project", "status");
		expect(hint).toBeDefined();

		const formatted = formatFrontmatterHint("status", hint!);

		// Verify the output would be helpful to users
		expect(formatted).toContain(
			"Allowed values: active, on-hold, completed, archived",
		);
		expect(formatted).toContain("Example: status: active");
	});

	test("provides helpful hints for setting task effort", () => {
		const hint = computeFrontmatterHint(mockConfig, "task", "effort");
		expect(hint).toBeDefined();

		const formatted = formatFrontmatterHint("effort", hint!);

		// Verify the output would be helpful to users
		expect(formatted).toContain("Allowed values: small, medium, large");
		expect(formatted).toContain("Example: effort: small");
	});

	test("handles multiple fields in sequence", () => {
		const fields = ["status", "priority", "tags"];
		const hints = fields.map((field) =>
			computeFrontmatterHint(mockConfig, "project", field),
		);

		expect(hints[0]?.allowedValues).toEqual([
			"active",
			"on-hold",
			"completed",
			"archived",
		]);
		expect(hints[1]?.allowedValues).toEqual(["high", "medium", "low"]);
		expect(hints[2]?.expectedType).toBe("array");
	});
});
