/**
 * Tests for native placeholder parsing and substitution.
 */
import { describe, expect, test } from "bun:test";
import {
	applyFieldSubstitutions,
	applyNativeDateSubstitutions,
	applyNativePlaceholders,
	extractFieldNames,
	hasNativePlaceholders,
	hasTemplaterSyntax,
	parsePlaceholders,
} from "./placeholder";

describe("parsePlaceholders", () => {
	test("parses simple field placeholder", () => {
		const result = parsePlaceholders("{{myField}}");
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			type: "field",
			name: "myField",
			raw: "{{myField}}",
		});
	});

	test("parses field with default value", () => {
		const result = parsePlaceholders("{{status:planning}}");
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			type: "field",
			name: "status",
			default: "planning",
			raw: "{{status:planning}}",
		});
	});

	test("parses simple date placeholder", () => {
		const result = parsePlaceholders("{{date}}");
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			type: "date",
			name: "date",
			format: "YYYY-MM-DD",
			raw: "{{date}}",
		});
	});

	test("parses date with format", () => {
		const result = parsePlaceholders("{{date:YYYY-MM-DDTHH:mm:ss}}");
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			type: "date",
			name: "date",
			format: "YYYY-MM-DDTHH:mm:ss",
			raw: "{{date:YYYY-MM-DDTHH:mm:ss}}",
		});
	});

	test("parses date with format and positive offset", () => {
		const result = parsePlaceholders("{{date:YYYY-MM-DD:+7}}");
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			type: "date",
			name: "date",
			format: "YYYY-MM-DD",
			offset: 7,
			raw: "{{date:YYYY-MM-DD:+7}}",
		});
	});

	test("parses date with format and negative offset", () => {
		const result = parsePlaceholders("{{date:YYYY-MM-DD:-30}}");
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			type: "date",
			name: "date",
			format: "YYYY-MM-DD",
			offset: -30,
			raw: "{{date:YYYY-MM-DD:-30}}",
		});
	});

	test("parses special title placeholder", () => {
		const result = parsePlaceholders("{{title}}");
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			type: "special",
			name: "title",
			raw: "{{title}}",
		});
	});

	test("parses special content placeholder", () => {
		const result = parsePlaceholders("{{content}}");
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			type: "special",
			name: "content",
			raw: "{{content}}",
		});
	});

	test("parses multiple placeholders", () => {
		const content = `---
created: {{date:YYYY-MM-DDTHH:mm:ss}}
status: "{{status:planning}}"
area: "[[{{area}}]]"
---
# {{title}}`;

		const result = parsePlaceholders(content);
		expect(result).toHaveLength(4);

		const names = result.map((p) => p.name);
		expect(names).toContain("date");
		expect(names).toContain("status");
		expect(names).toContain("area");
		expect(names).toContain("title");
	});

	test("deduplicates identical placeholders", () => {
		const result = parsePlaceholders("{{title}} and {{title}} again");
		expect(result).toHaveLength(1);
	});

	test("handles field name starting with date prefix", () => {
		// {{dateField}} should be a field, not a date
		const result = parsePlaceholders("{{dateField}}");
		expect(result).toHaveLength(1);
		const first = result[0];
		expect(first?.type).toBe("field");
		expect(first?.name).toBe("dateField");
	});

	test("handles empty default value", () => {
		const result = parsePlaceholders("{{field:}}");
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			type: "field",
			name: "field",
			default: "",
			raw: "{{field:}}",
		});
	});
});

describe("applyFieldSubstitutions", () => {
	test("replaces field with provided value", () => {
		const result = applyFieldSubstitutions("Status: {{status}}", {
			status: "active",
		});
		expect(result).toBe("Status: active");
	});

	test("uses default value when not provided", () => {
		const result = applyFieldSubstitutions("Status: {{status:planning}}", {});
		expect(result).toBe("Status: planning");
	});

	test("overrides default with provided value", () => {
		const result = applyFieldSubstitutions("Status: {{status:planning}}", {
			status: "active",
		});
		expect(result).toBe("Status: active");
	});

	test("preserves unmatched required placeholders by default", () => {
		const result = applyFieldSubstitutions("Area: {{area}}", {});
		expect(result).toBe("Area: {{area}}");
	});

	test("removes unmatched when option set", () => {
		const result = applyFieldSubstitutions(
			"Area: {{area}}",
			{},
			{ removeUnmatched: true },
		);
		expect(result).toBe("Area: ");
	});

	test("strips wikilinks from value by default", () => {
		const result = applyFieldSubstitutions("[[{{area}}]]", {
			area: "[[Work]]",
		});
		expect(result).toBe("[[Work]]");
	});

	test("preserves wikilinks when option disabled", () => {
		const result = applyFieldSubstitutions(
			"[[{{area}}]]",
			{ area: "[[Work]]" },
			{ stripWikilinks: false },
		);
		expect(result).toBe("[[[[Work]]]]");
	});

	test("does not replace date placeholders", () => {
		const result = applyFieldSubstitutions("{{date}}", { date: "2025-01-01" });
		// date is reserved, should not be replaced by field substitution
		expect(result).toBe("{{date}}");
	});

	test("does not replace title placeholder", () => {
		const result = applyFieldSubstitutions("{{title}}", { title: "My Note" });
		// title is reserved, handled separately
		expect(result).toBe("{{title}}");
	});

	test("handles multiple fields in content", () => {
		const content = "{{field1}} and {{field2:default}}";
		const result = applyFieldSubstitutions(content, { field1: "value1" });
		expect(result).toBe("value1 and default");
	});
});

describe("applyNativeDateSubstitutions", () => {
	const fixedDate = new Date("2025-01-16T14:30:00");

	test("replaces {{date}} with default format", () => {
		const result = applyNativeDateSubstitutions("Created: {{date}}", fixedDate);
		expect(result).toBe("Created: 2025-01-16");
	});

	test("replaces {{date:format}} with custom format", () => {
		const result = applyNativeDateSubstitutions(
			"Created: {{date:DD/MM/YYYY}}",
			fixedDate,
		);
		expect(result).toBe("Created: 16/01/2025");
	});

	test("handles ISO 8601 format with T separator", () => {
		const result = applyNativeDateSubstitutions(
			"{{date:YYYY-MM-DDTHH:mm:ss}}",
			fixedDate,
		);
		expect(result).toBe("2025-01-16T14:30:00");
	});

	test("applies positive offset", () => {
		const result = applyNativeDateSubstitutions(
			"Due: {{date:YYYY-MM-DD:+7}}",
			fixedDate,
		);
		expect(result).toBe("Due: 2025-01-23");
	});

	test("applies negative offset", () => {
		const result = applyNativeDateSubstitutions(
			"Yesterday: {{date:YYYY-MM-DD:-1}}",
			fixedDate,
		);
		expect(result).toBe("Yesterday: 2025-01-15");
	});

	test("handles format with time", () => {
		const result = applyNativeDateSubstitutions(
			"{{date:YYYY-MM-DD HH:mm}}",
			fixedDate,
		);
		expect(result).toBe("2025-01-16 14:30");
	});

	test("handles invalid format gracefully", () => {
		const result = applyNativeDateSubstitutions(
			"{{date:INVALID_TOKEN_XYZ}}",
			fixedDate,
		);
		expect(result).toContain("[Invalid date format:");
	});

	test("replaces multiple date placeholders", () => {
		const content = "Start: {{date:YYYY-MM-DD}} End: {{date:YYYY-MM-DD:+30}}";
		const result = applyNativeDateSubstitutions(content, fixedDate);
		expect(result).toBe("Start: 2025-01-16 End: 2025-02-15");
	});

	test("does not affect field placeholders", () => {
		const result = applyNativeDateSubstitutions(
			"{{status}} and {{date}}",
			fixedDate,
		);
		expect(result).toBe("{{status}} and 2025-01-16");
	});
});

describe("applyNativePlaceholders", () => {
	const fixedDate = new Date("2025-01-16T14:30:00");

	test("applies all placeholder types", () => {
		const content = `---
created: {{date:YYYY-MM-DDTHH:mm:ss}}
status: "{{status:planning}}"
---
# {{title}}`;

		const result = applyNativePlaceholders(
			content,
			{ title: "My Note" },
			{ baseDate: fixedDate },
		);

		expect(result).toContain("created: 2025-01-16T14:30:00");
		expect(result).toContain('status: "planning"');
		expect(result).toContain("# My Note");
	});

	test("handles wikilinks correctly", () => {
		const content = 'area: "[[{{area}}]]"';
		const result = applyNativePlaceholders(
			content,
			{ area: "Work" },
			{ baseDate: fixedDate },
		);
		expect(result).toBe('area: "[[Work]]"');
	});

	test("strips double wikilinks from args", () => {
		const content = 'area: "[[{{area}}]]"';
		const result = applyNativePlaceholders(
			content,
			{ area: "[[Work]]" },
			{ baseDate: fixedDate },
		);
		expect(result).toBe('area: "[[Work]]"');
	});

	test("removes unmatched when option set", () => {
		const content = "{{required}} {{optional:default}}";
		const result = applyNativePlaceholders(
			content,
			{},
			{ removeUnmatched: true },
		);
		expect(result).toBe(" default");
	});
});

describe("hasTemplaterSyntax", () => {
	test("detects Templater syntax", () => {
		expect(hasTemplaterSyntax('<% tp.date.now("YYYY-MM-DD") %>')).toBe(true);
		expect(hasTemplaterSyntax('<% tp.system.prompt("Title") %>')).toBe(true);
	});

	test("returns false for native placeholders", () => {
		expect(hasTemplaterSyntax("{{date}}")).toBe(false);
		expect(hasTemplaterSyntax("{{title}}")).toBe(false);
	});

	test("handles mixed content", () => {
		expect(hasTemplaterSyntax("{{date}} and <% tp.date.now() %>")).toBe(true);
	});
});

describe("hasNativePlaceholders", () => {
	test("detects native placeholders", () => {
		expect(hasNativePlaceholders("{{date}}")).toBe(true);
		expect(hasNativePlaceholders("{{title}}")).toBe(true);
		expect(hasNativePlaceholders("{{field:default}}")).toBe(true);
	});

	test("returns false for Templater syntax", () => {
		expect(hasNativePlaceholders('<% tp.date.now("YYYY-MM-DD") %>')).toBe(
			false,
		);
	});

	test("returns false for plain text", () => {
		expect(hasNativePlaceholders("Hello world")).toBe(false);
	});
});

describe("extractFieldNames", () => {
	test("extracts field names from content", () => {
		const content = "{{title}} {{status:active}} {{area}}";
		const names = extractFieldNames(content);
		// title is special, not a field
		expect(names).toContain("status");
		expect(names).toContain("area");
	});

	test("excludes date and special placeholders", () => {
		const content = "{{date}} {{title}} {{content}} {{myField}}";
		const names = extractFieldNames(content);
		expect(names).toEqual(["myField"]);
	});

	test("returns empty array for no fields", () => {
		const content = "{{date}} {{title}}";
		const names = extractFieldNames(content);
		expect(names).toEqual([]);
	});
});
