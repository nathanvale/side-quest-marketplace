/**
 * Tests for LLM prompt constraints builder.
 *
 * @module llm/constraints.test
 */

import { describe, expect, test } from "bun:test";
import type { FrontmatterRules } from "../config";
import {
	getTemplateFields,
	getTemplateSections,
	type TemplateInfo,
} from "../templates";
import {
	buildConstraintSet,
	formatConstraintSet,
	formatFieldConstraints,
	formatOutputSchema,
	formatVaultContext,
	type VaultContext,
} from "./constraints";

// ============================================================================
// Test Fixtures
// ============================================================================

const MOCK_TEMPLATE: TemplateInfo = {
	name: "booking",
	version: 3,
	path: "/vault/Templates/booking.md",
	content: `---
title: <% tp.system.prompt("Booking title") %>
created: <% tp.date.now("YYYY-MM-DD") %>
type: booking
booking_type: <% tp.system.prompt("Booking type") %>
status: <% tp.system.prompt("Status") %>
project: <% tp.system.prompt("Project") %>
booking_ref: <% tp.system.prompt("Booking reference") %>
date: <% tp.system.prompt("Date (YYYY-MM-DD)") %>
cost: <% tp.system.prompt("Cost") %>
currency: <% tp.system.prompt("Currency") %>
payment_status: <% tp.system.prompt("Payment status") %>
tags: <% tp.system.prompt("Tags") %>
---

## Booking Details

## Cost & Payment

## Contact Information

## Important Notes`,
};

const MOCK_RULES: FrontmatterRules = {
	required: {
		"Booking title": { type: "string" },
		"Booking type": {
			type: "enum",
			enum: ["accommodation", "flight", "activity", "transport", "dining"],
		},
		Status: {
			type: "enum",
			enum: ["pending", "confirmed", "cancelled"],
		},
		Project: { type: "wikilink" },
		"Booking reference": { type: "string", optional: true },
		"Date (YYYY-MM-DD)": { type: "date" },
		Cost: { type: "string" },
		Currency: {
			type: "enum",
			enum: ["AUD", "USD", "EUR", "GBP"],
		},
		"Payment status": {
			type: "enum",
			enum: ["pending", "partial", "paid"],
		},
		Tags: { type: "array", includes: ["booking"] },
	},
};

const MOCK_VAULT_CONTEXT: VaultContext = {
	areas: ["Travel", "Work", "Family"],
	projects: ["Japan Trip 2025", "Home Renovation"],
	suggestedTags: ["booking", "travel", "project", "work"],
};

// ============================================================================
// buildConstraintSet Tests
// ============================================================================

describe("buildConstraintSet", () => {
	test("extracts field constraints from template and rules", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);

		expect(constraints.fields).toHaveLength(10); // Excluding auto-date 'created'
		expect(constraints.fields[0]).toEqual({
			key: "Booking title",
			type: "string",
			required: true,
			enumValues: undefined,
			arrayIncludes: undefined,
			location: "frontmatter",
		});
	});

	test("marks required fields correctly", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);

		const requiredField = constraints.fields.find(
			(f) => f.key === "Booking title",
		);
		expect(requiredField?.required).toBe(true);

		const optionalField = constraints.fields.find(
			(f) => f.key === "Booking reference",
		);
		expect(optionalField?.required).toBe(false);
	});

	test("extracts enum values from rules", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);

		const enumField = constraints.fields.find((f) => f.key === "Booking type");
		expect(enumField?.type).toBe("enum");
		expect(enumField?.enumValues).toEqual([
			"accommodation",
			"flight",
			"activity",
			"transport",
			"dining",
		]);
	});

	test("extracts array includes constraint", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);

		const arrayField = constraints.fields.find((f) => f.key === "Tags");
		expect(arrayField?.type).toBe("array");
		expect(arrayField?.arrayIncludes).toEqual(["booking"]);
	});

	test("excludes auto-date fields", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);

		const autoDateField = constraints.fields.find((f) => f.key === "created");
		expect(autoDateField).toBeUndefined();
	});

	test("handles missing rules gracefully", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			undefined,
			undefined,
		);

		expect(constraints.fields).toHaveLength(10); // Still extracts fields from template
		expect(constraints.fields[0]?.required).toBe(false); // No rule = optional
	});

	test("includes vault context when provided", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			MOCK_VAULT_CONTEXT,
		);

		expect(constraints.vaultContext).toBeDefined();
		expect(constraints.vaultContext?.areas).toEqual([
			"Travel",
			"Work",
			"Family",
		]);
		expect(constraints.vaultContext?.projects).toEqual([
			"Japan Trip 2025",
			"Home Renovation",
		]);
	});

	test("builds output schema with sections", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);

		expect(constraints.outputSchema.sections).toEqual([
			"Booking Details",
			"Cost & Payment",
			"Contact Information",
			"Important Notes",
		]);
	});

	test("builds args example with placeholders", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);

		const argsExample = constraints.outputSchema.argsExample;
		expect(argsExample["Booking title"]).toBe("<value>");
		expect(argsExample["Booking type"]).toBe("accommodation"); // First enum value
		expect(argsExample["Date (YYYY-MM-DD)"]).toBe("YYYY-MM-DD");
		expect(argsExample.Project).toBe("[[Name]]");
		expect(argsExample["Booking reference"]).toBe(null); // Optional field
	});
});

// ============================================================================
// formatFieldConstraints Tests
// ============================================================================

describe("formatFieldConstraints", () => {
	test("marks required fields", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatFieldConstraints(constraints.fields);

		expect(formatted).toContain('"Booking title" (frontmatter) REQUIRED');
	});

	test("marks optional fields", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatFieldConstraints(constraints.fields);

		expect(formatted).toContain('"Booking reference" (frontmatter) OPTIONAL');
	});

	test("includes enum values inline", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatFieldConstraints(constraints.fields);

		expect(formatted).toContain(
			'"Booking type" (frontmatter) REQUIRED - must be one of: accommodation, flight, activity, transport, dining',
		);
	});

	test("adds wikilink formatting guidance", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatFieldConstraints(constraints.fields);

		expect(formatted).toContain(
			'"Project" (frontmatter) REQUIRED - wikilink format [[Name]], or null if not applicable (use literal null, not a string)',
		);
	});

	test("includes array includes constraint", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatFieldConstraints(constraints.fields);

		expect(formatted).toContain(
			'"Tags" (frontmatter) REQUIRED - array of strings',
		);
		expect(formatted).toContain("→ MUST include these values: booking");
	});

	test("formats date fields", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatFieldConstraints(constraints.fields);

		expect(formatted).toContain(
			'"Date (YYYY-MM-DD)" (frontmatter) REQUIRED - date in YYYY-MM-DD format',
		);
	});

	test("formats generic string fields", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatFieldConstraints(constraints.fields);

		expect(formatted).toContain('"Cost" (frontmatter) REQUIRED - string');
	});
});

// ============================================================================
// formatVaultContext Tests
// ============================================================================

describe("formatVaultContext", () => {
	test("lists existing areas with guidance", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			MOCK_VAULT_CONTEXT,
		);

		if (!constraints.vaultContext) {
			throw new Error("Vault context should be defined");
		}

		const formatted = formatVaultContext(constraints.vaultContext);

		expect(formatted).toContain("EXISTING AREAS");
		expect(formatted).toContain("- Travel");
		expect(formatted).toContain("- Work");
		expect(formatted).toContain("- Family");
		expect(formatted).toContain(
			"→ Area assignment is REQUIRED for projects/resources",
		);
	});

	test("lists existing projects", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			MOCK_VAULT_CONTEXT,
		);

		if (!constraints.vaultContext) {
			throw new Error("Vault context should be defined");
		}

		const formatted = formatVaultContext(constraints.vaultContext);

		expect(formatted).toContain("EXISTING PROJECTS");
		expect(formatted).toContain("- Japan Trip 2025");
		expect(formatted).toContain("- Home Renovation");
	});

	test("constrains tags to allowed values", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			MOCK_VAULT_CONTEXT,
		);

		if (!constraints.vaultContext) {
			throw new Error("Vault context should be defined");
		}

		const formatted = formatVaultContext(constraints.vaultContext);

		expect(formatted).toContain("ALLOWED TAGS");
		expect(formatted).toContain("booking, travel, project, work");
		expect(formatted).toContain("DO NOT invent new tags");
	});

	test("includes critical wikilink rules", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			MOCK_VAULT_CONTEXT,
		);

		if (!constraints.vaultContext) {
			throw new Error("Vault context should be defined");
		}

		const formatted = formatVaultContext(constraints.vaultContext);

		expect(formatted).toContain(
			"CRITICAL: Wikilinks MUST be quoted: area: \"[[Home]]\" (valid YAML, Dataview-compatible)",
		);
	});

	test("handles empty areas list", () => {
		const emptyContext: VaultContext = {
			areas: [],
			projects: [],
			suggestedTags: ["booking"],
		};

		const formatted = formatVaultContext(emptyContext);

		expect(formatted).toContain(
			"[None yet - suggest one based on content analysis]",
		);
	});

	test("handles empty projects list", () => {
		const emptyContext: VaultContext = {
			areas: ["Work"],
			projects: [],
			suggestedTags: ["booking"],
		};

		const formatted = formatVaultContext(emptyContext);

		expect(formatted).toContain(
			"[None yet - suggest one if task relates to a project]",
		);
	});
});

// ============================================================================
// formatOutputSchema Tests
// ============================================================================

describe("formatOutputSchema", () => {
	test("builds args example from constraints", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatOutputSchema(constraints.outputSchema);

		expect(formatted).toContain('"Booking title": "<value>"');
		expect(formatted).toContain('"Booking type": "accommodation"'); // First enum
		expect(formatted).toContain('"Booking reference": null'); // Optional
	});

	test("builds content example from sections", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatOutputSchema(constraints.outputSchema);

		expect(formatted).toContain('"Booking Details"');
		expect(formatted).toContain('"Cost & Payment"');
		expect(formatted).toContain('"Contact Information"');
		expect(formatted).toContain('"Important Notes"');
	});

	test("includes JSON format specification", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatOutputSchema(constraints.outputSchema);

		expect(formatted).toContain("OUTPUT FORMAT:");
		expect(formatted).toContain("Return ONLY a JSON object");
		expect(formatted).toContain('"args":');
		expect(formatted).toContain('"content":');
		expect(formatted).toContain('"title":');
	});

	test("includes critical rules for wikilinks", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatOutputSchema(constraints.outputSchema);

		expect(formatted).toContain("For wikilink fields: Use literal null");
		expect(formatted).toContain('CORRECT: "area": null');
		expect(formatted).toContain('WRONG: "area": "[[null]]"');
	});

	test("includes date format rules", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatOutputSchema(constraints.outputSchema);

		expect(formatted).toContain("Dates MUST be YYYY-MM-DD format");
	});
});

// ============================================================================
// formatConstraintSet Tests
// ============================================================================

describe("formatConstraintSet", () => {
	test("combines all formatting functions", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			MOCK_VAULT_CONTEXT,
		);
		const formatted = formatConstraintSet(constraints);

		expect(formatted.fields).toBeDefined();
		expect(formatted.vaultContext).toBeDefined();
		expect(formatted.outputSchema).toBeDefined();
	});

	test("vault context is undefined when not provided", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatConstraintSet(constraints);

		expect(formatted.vaultContext).toBeUndefined();
	});

	test("fields section includes all constraints", () => {
		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			MOCK_RULES,
			undefined,
		);
		const formatted = formatConstraintSet(constraints);

		expect(formatted.fields).toContain("REQUIRED");
		expect(formatted.fields).toContain("OPTIONAL");
		expect(formatted.fields).toContain("must be one of:");
	});
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe("edge cases", () => {
	test("handles template with no fields", () => {
		const emptyTemplate: TemplateInfo = {
			name: "empty",
			version: 1,
			path: "/vault/Templates/empty.md",
			content: "---\n---\n\n## Notes",
		};

		const fields = getTemplateFields(emptyTemplate);
		const sections = getTemplateSections(emptyTemplate);
		const constraints = buildConstraintSet(
			fields,
			sections,
			undefined,
			undefined,
		);

		expect(constraints.fields).toHaveLength(0);
		expect(constraints.outputSchema.sections).toEqual(["Notes"]);
	});

	test("handles template with no sections", () => {
		const noSectionsTemplate: TemplateInfo = {
			name: "simple",
			version: 1,
			path: "/vault/Templates/simple.md",
			content: `---
title: <% tp.system.prompt("Title") %>
---

Body content without sections`,
		};

		const fields = getTemplateFields(noSectionsTemplate);
		const sections = getTemplateSections(noSectionsTemplate);
		const constraints = buildConstraintSet(
			fields,
			sections,
			undefined,
			undefined,
		);

		expect(constraints.fields).toHaveLength(1);
		expect(constraints.outputSchema.sections).toHaveLength(0);
	});

	test("handles rules with no required fields", () => {
		const emptyRules: FrontmatterRules = {
			required: {},
		};

		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			emptyRules,
			undefined,
		);

		// Fields are extracted from template, but all are optional
		expect(constraints.fields.every((f) => !f.required)).toBe(true);
	});

	test("handles fields without matching rules", () => {
		const partialRules: FrontmatterRules = {
			required: {
				"Booking title": { type: "string" },
				// Other fields not in rules
			},
		};

		const fields = getTemplateFields(MOCK_TEMPLATE);
		const sections = getTemplateSections(MOCK_TEMPLATE);
		const constraints = buildConstraintSet(
			fields,
			sections,
			partialRules,
			undefined,
		);

		const titleField = constraints.fields.find(
			(f) => f.key === "Booking title",
		);
		const untypedField = constraints.fields.find((f) => f.key === "Cost");

		expect(titleField?.required).toBe(true);
		expect(untypedField?.required).toBe(false); // No rule = optional
		expect(untypedField?.type).toBe("string"); // Default type
	});
});
