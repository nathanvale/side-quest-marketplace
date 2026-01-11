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
		expect(result.content).toContain("source: '<% tp.system.prompt");
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

	test("H12: sanitizes template name for YAML safety in type field", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: 'Test "With" Special:Characters/Colons',
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# Content",
			properties: [],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		// Type should be sanitized (no quotes, colons, or slashes)
		// The sanitizeYamlValue function replaces slashes with hyphens
		expect(result.content).toContain(
			"type: test-with-specialcharacters-colons",
		);
		// Should not contain dangerous YAML characters
		expect(result.content).not.toMatch(/type:.*[:"'/\\]/);
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

	test("P0-1: escapes backslash in date format to prevent quote escaping", () => {
		// Attack: Trailing backslash could escape the closing quote
		// Input: {{time|date:"YYYY\"}} extracts "YYYY\"
		// Without escaping: <% tp.date.now("YYYY\") %> — backslash escapes the quote!
		// With escaping: <% tp.date.now("YYYY\\") %> — safe
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
					value: '{{time|date:"YYYY\\"}}',
					type: "date",
				},
			],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		expect(result.content).toContain("tp.date.now");
		// The backslash must be escaped to prevent it from escaping the closing quote
		expect(result.content).toContain("\\\\");
	});

	test("P0-1: escapes templater delimiters in schema date format", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [
				{
					name: "published",
					// Attack: Templater delimiters in date format
					value: '{{schema:@Article:datePublished|date:"YYYY <% evil %> MM"}}',
					type: "date",
				},
			],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		expect(result.content).toContain("tp.date.now");
		// Templater delimiters must be escaped
		expect(result.content).toContain("\\<%");
		expect(result.content).toContain("%\\>");
	});

	test("P0-2: escapes backslash in default value", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			// Attack: Backslash in default value
			// Use ## Summary so it's not replaced by Dataview file.name
			noteContentFormat:
				'# {{title}}\n\n## Summary\n\n{{author|default:"foo\\bar"}}',
			properties: [],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		expect(result.content).toContain("tp.system.prompt");
		// Backslash must be escaped to prevent it from escaping the closing quote
		expect(result.content).toContain("\\\\");
	});

	test("P0-2: escapes templater delimiters in default value", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			// Use ## Summary so content isn't replaced by Dataview file.name
			noteContentFormat:
				'# {{title}}\n\n## Summary\n\n{{url|default:"<% tp.file.exists() %>"}}',
			properties: [],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		// Templater delimiters should be escaped
		expect(result.content).toContain("\\<%");
		expect(result.content).toContain("%\\>");
		// Should NOT create nested Templater code
		expect(result.content).not.toMatch(
			/<% tp\.system\.prompt\("[^"]*", "<% tp\.file\.exists/,
		);
	});

	test("P0-2: escapes variable label injection", () => {
		// If a variable name is not in MAPPABLE_VARIABLES, it's used as-is for the label
		// Variable names are \w+ so they can't contain quotes/delimiters
		// BUT we test that the LABEL (from MAPPABLE_VARIABLES or the variable name) is escaped
		// Let's use a property to test label escaping since property values can be complex
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [
				{
					name: "test",
					// This will extract variable "customVar" with no default, creating a prompt with label "customVar"
					value: "{{customVar}}",
					type: "text",
				},
			],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		// Variable name becomes the label and should be safe (it's \w+ from regex)
		expect(result.content).toContain("tp.system.prompt");
		expect(result.content).toContain("customVar");
	});

	test("escapes backslashes in date format", () => {
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
					value: '{{time|date:"YYYY\\\\MM\\\\DD"}}',
					type: "date",
				},
			],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		// Backslashes should be double-escaped
		expect(result.content).toContain("\\\\\\\\");
	});

	test("escapes closing delimiter in default value", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			// Use ## Summary so content isn't replaced by Dataview file.name
			noteContentFormat:
				'# {{title}}\n\n## Summary\n\n{{author|default:"end %> start"}}',
			properties: [],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		// Closing delimiter should be escaped
		expect(result.content).toContain("%\\>");
		// Should not prematurely close Templater code
		expect(result.content).not.toMatch(
			/<% tp\.system\.prompt\("[^"]*", "[^"]*" %> [^>]*"\) %>/,
		);
	});

	test("handles benign special characters without over-escaping", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			// Use ## Summary so content isn't replaced by Dataview file.name
			noteContentFormat:
				'# {{title}}\n\n## Summary\n\n{{author|default:"Hello, World!"}}',
			properties: [],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		// Benign characters should pass through unescaped
		expect(result.content).toContain("Hello, World!");
		expect(result.content).not.toContain("Hello\\,");
	});
});

describe("webClipperToTemplater - H1 uses Dataview syntax", () => {
	test("replaces H1 with Dataview file.name reference", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "YouTube Video",
			behavior: "create",
			noteNameFormat: "✂️🎬 {{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}\n\nVideo content",
			properties: [{ name: "type", value: "clipping", type: "text" }],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		// H1 should use Dataview syntax for dynamic title
		expect(result.content).toContain("# `= this.file.name`");
		// Should contain Templater rename script with emoji prefix extracted from noteNameFormat
		expect(result.content).toContain("<%*");
		expect(result.content).toContain('if (!title.startsWith("✂️🎬"))');
		expect(result.content).toContain('await tp.file.rename("✂️🎬 " + title)');
	});

	test("no rename script when no emoji prefix", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Test",
			behavior: "create",
			noteNameFormat: "{{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		// H1 should still use Dataview syntax
		expect(result.content).toContain("# `= this.file.name`");
		// Should NOT contain rename script
		expect(result.content).not.toContain("tp.file.rename");
		expect(result.content).not.toContain("<%*");
	});

	test("converts schema.org properties to empty strings in frontmatter", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Restaurant",
			behavior: "create",
			noteNameFormat: "✂️🍽️ {{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [
				{
					name: "cuisine",
					value: "{{schema:@Restaurant:servesCuisine}}",
					type: "text",
				},
				{
					name: "price_range",
					value: "{{schema:@Restaurant:priceRange}}",
					type: "text",
				},
				{ name: "source", value: "{{url}}", type: "text" },
			],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		// Schema.org variables should be converted to empty strings (no Templater equivalent)
		expect(result.content).toContain("cuisine: ");
		expect(result.content).toContain("price_range: ");
		expect(result.content).not.toContain("{{schema:");
		// Regular variables should be converted to Templater prompts
		expect(result.content).toContain(
			"source: '<% tp.system.prompt(\"URL\") %>'",
		);
	});

	test("extracts multi-character emoji prefixes", () => {
		const template: WebClipperTemplate = {
			schemaVersion: "0.1.0",
			name: "Podcast",
			behavior: "create",
			noteNameFormat: "✂️🎙️ {{title}}",
			path: "00 Inbox",
			noteContentFormat: "# {{title}}",
			properties: [],
		};

		const result = webClipperToTemplater(template);

		expect(result.success).toBe(true);
		// Multi-emoji prefix (✂️🎙️) should be extracted correctly
		expect(result.content).toContain('if (!title.startsWith("✂️🎙️"))');
		expect(result.content).toContain('await tp.file.rename("✂️🎙️ " + title)');
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
