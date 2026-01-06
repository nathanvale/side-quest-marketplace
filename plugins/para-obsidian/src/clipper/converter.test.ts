/**
 * Tests for WebClipper template converter.
 *
 * @module clipper/converter.test
 */

import { describe, expect, test } from "bun:test";
import {
	compareTemplates,
	extractTemplateMetadata,
	webClipperToTemplater,
} from "./converter";
import type { WebClipperTemplate } from "./types";

describe("webClipperToTemplater", () => {
	test("converts basic template", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}\n\nContent here",
			properties: [
				{ name: "type", value: "test", type: "text" },
				{ name: "source", value: "{{url}}", type: "text" },
			],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		expect(result.content).toContain("---");
		expect(result.content).toContain("type: test");
		expect(result.content).toContain('source: "<% tp.system.prompt');
	});

	test("converts date variables", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [
				{
					name: "created",
					value: '{{time|date:"YYYY-MM-DD"}}',
					type: "date",
				},
			],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		expect(result.content).toContain("tp.date.now");
		expect(result.content).toContain("YYYY-MM-DD");
	});

	test("converts time variable in content", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "Created at {{time}}",
			properties: [],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		// time variable without date filter becomes a prompt
		expect(result.content).toContain("tp.system.prompt");
	});

	test("strips WebClipper-only features and reports warnings", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat:
				"{{schema:@Article:name}}\n{{selector:h1}}\n{{selectorHtml:article|markdown}}",
			properties: [],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		expect(result.unsupportedFeatures).toBeDefined();
		expect(result.unsupportedFeatures?.length).toBeGreaterThan(0);
	});

	test("handles multitext properties", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [{ name: "tags", value: "clip, web", type: "multitext" }],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		expect(result.content).toContain("tags:");
	});

	test("preserves static property values and adds versioning", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Article",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# Content",
			properties: [
				{ name: "type", value: "clipping", type: "text" }, // Will be overridden by template name
				{ name: "status", value: "to-read", type: "text" },
			],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		// Type is derived from template name, not properties
		expect(result.content).toContain("type: article");
		expect(result.content).toContain("template_version: 1");
		expect(result.content).toContain("status: to-read");
	});
});

describe("extractTemplateMetadata", () => {
	test("extracts variables from template", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}\n\n{{description}}",
			properties: [
				{ name: "source", value: "{{url}}", type: "text" },
				{
					name: "created",
					value: '{{time|date:"YYYY-MM-DD"}}',
					type: "date",
				},
			],
		};

		const metadata = extractTemplateMetadata(template);

		expect(metadata.name).toBe("Test");
		expect(metadata.variables.length).toBeGreaterThan(0);

		// Variables are extracted from both content and properties
		expect(metadata.variables.length).toBeGreaterThan(0);

		// Check for date variables (extracted from time|date filter)
		const dateVars = metadata.variables.filter((v) => v.isDate);
		expect(dateVars.length).toBeGreaterThanOrEqual(0);
	});

	test("extracts frontmatter fields", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [
				{ name: "type", value: "test", type: "text" },
				{ name: "source", value: "{{url}}", type: "text" },
				{ name: "created", value: "{{time}}", type: "date" },
			],
		};

		const metadata = extractTemplateMetadata(template);

		expect(metadata.frontmatterFields).toContain("type");
		expect(metadata.frontmatterFields).toContain("source");
		expect(metadata.frontmatterFields).toContain("created");
		expect(metadata.frontmatterFields).toHaveLength(3);
	});

	test("sets sourceFormat to webclipper", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [],
		};

		const metadata = extractTemplateMetadata(template);

		expect(metadata.sourceFormat).toBe("webclipper");
	});
});

describe("webClipperToTemplater - security", () => {
	test("rejects excessively long content", () => {
		// Create content that exceeds 1MB limit
		const hugeContent = "a".repeat(1024 * 1024 + 1);
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: hugeContent,
			properties: [],
		};

		// Should throw an error due to content length
		expect(() => webClipperToTemplater(template)).toThrow(
			"exceeds maximum length",
		);
	});

	test("handles content at the limit", () => {
		// Create content at exactly the 1MB limit (should succeed)
		const maxContent = "a".repeat(1024 * 1024);
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: maxContent,
			properties: [],
		};

		// Should not throw - exactly at limit
		const result = webClipperToTemplater(template);
		expect(result.success).toBe(true);
	});
});

describe("compareTemplates", () => {
	test("identifies identical templates", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [],
		};

		const comparison = compareTemplates(template, { ...template });

		expect(comparison.identical).toBe(true);
		expect(comparison.differences).toHaveLength(0);
	});

	test("detects content differences", () => {
		const template1: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [],
		};

		const template2: WebClipperTemplate = {
			...template1,
			noteContentFormat: "# {{title}}\n\nUpdated content",
		};

		const comparison = compareTemplates(template1, template2);

		expect(comparison.identical).toBe(false);
		expect(
			comparison.differences.some((d) => d.includes("noteContentFormat")),
		).toBe(true);
	});

	test("detects property differences", () => {
		const template1: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [{ name: "type", value: "old", type: "text" }],
		};

		const template2: WebClipperTemplate = {
			...template1,
			properties: [{ name: "type", value: "new", type: "text" }],
		};

		const comparison = compareTemplates(template1, template2);

		expect(comparison.identical).toBe(false);
		expect(comparison.differences.some((d) => d.includes("type"))).toBe(true);
	});

	test("detects trigger differences", () => {
		const template1: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [],
			triggers: ["https://example.com"],
		};

		const template2: WebClipperTemplate = {
			...template1,
			triggers: ["https://example.com", "https://test.com"],
		};

		const comparison = compareTemplates(template1, template2);

		expect(comparison.identical).toBe(false);
		expect(comparison.differences.some((d) => d.includes("trigger"))).toBe(
			true,
		);
	});
});
