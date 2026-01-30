/**
 * Tests for template applier module.
 *
 * @module inbox/process/template-applier.test
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { applyTemplateVariables, getTemplatePath } from "./template-applier.js";
import type { TemplateVariables } from "./types.js";

describe("getTemplatePath", () => {
	const originalEnv = process.env.PARA_VAULT;

	beforeAll(() => {
		// Set a mock vault path for tests
		process.env.PARA_VAULT = "/tmp/test-vault";
	});

	afterAll(() => {
		// Restore original env
		if (originalEnv) {
			process.env.PARA_VAULT = originalEnv;
		} else {
			delete process.env.PARA_VAULT;
		}
	});

	test("returns correct path for youtube template", () => {
		const path = getTemplatePath("youtube");
		expect(path).toContain("Templates/clipping-youtube.md");
	});

	test("returns correct path for generic template", () => {
		const path = getTemplatePath("generic");
		expect(path).toContain("Templates/clipping-generic.md");
	});
});

describe("applyTemplateVariables", () => {
	test("replaces single variable", () => {
		const template = "# {{title}}";
		const variables: TemplateVariables = {
			title: "My Title",
			source: "https://example.com",
			domain: "example.com",
			clipped: "2024-01-15T10:30:00Z",
			content: "test",
		};

		const result = applyTemplateVariables(template, variables);
		expect(result).toBe("# My Title");
	});

	test("replaces multiple variables", () => {
		const template = "# {{title}}\n\nSource: {{source}}\nDomain: {{domain}}";
		const variables: TemplateVariables = {
			title: "My Title",
			source: "https://example.com/article",
			domain: "example.com",
			clipped: "2024-01-15T10:30:00Z",
			content: "test",
		};

		const result = applyTemplateVariables(template, variables);
		expect(result).toBe(
			"# My Title\n\nSource: https://example.com/article\nDomain: example.com",
		);
	});

	test("handles undefined variables with empty string", () => {
		const template = "# {{title}}\n\nTranscript: {{transcript}}";
		const variables: TemplateVariables = {
			title: "My Video",
			source: "https://youtube.com",
			domain: "youtube.com",
			clipped: "2024-01-15T10:30:00Z",
			content: "test",
			// transcript is undefined
		};

		const result = applyTemplateVariables(template, variables);
		expect(result).toBe("# My Video\n\nTranscript: ");
	});

	test("handles optional variables", () => {
		const template =
			"# {{title}}\n\nVideo ID: {{video_id}}\nChannel: {{channel_name}}";
		const variables: TemplateVariables = {
			title: "Tutorial",
			source: "https://youtube.com",
			domain: "youtube.com",
			clipped: "2024-01-15T10:30:00Z",
			content: "test",
			video_id: "abc123",
			channel_name: "Tech Channel",
		};

		const result = applyTemplateVariables(template, variables);
		expect(result).toBe(
			"# Tutorial\n\nVideo ID: abc123\nChannel: Tech Channel",
		);
	});

	test("leaves non-matching text unchanged", () => {
		const template = "# {{title}}\n\nSome static text\n\nMore content";
		const variables: TemplateVariables = {
			title: "Test",
			source: "https://example.com",
			domain: "example.com",
			clipped: "2024-01-15T10:30:00Z",
			content: "test",
		};

		const result = applyTemplateVariables(template, variables);
		expect(result).toBe("# Test\n\nSome static text\n\nMore content");
	});

	test("handles variables in frontmatter", () => {
		const template = `---
type: youtube
video_id: {{video_id}}
source: {{source}}
---
# {{title}}

Content here`;
		const variables: TemplateVariables = {
			title: "My Video",
			source: "https://youtube.com/watch?v=abc",
			domain: "youtube.com",
			clipped: "2024-01-15T10:30:00Z",
			content: "test",
			video_id: "abc",
		};

		const result = applyTemplateVariables(template, variables);
		expect(result).toContain("video_id: abc");
		expect(result).toContain("source: https://youtube.com/watch?v=abc");
		expect(result).toContain("# My Video");
	});

	test("removes empty Highlights section from content", () => {
		const template = "{{content}}";
		const variables: TemplateVariables = {
			title: "Test",
			source: "https://example.com",
			domain: "example.com",
			clipped: "2024-01-15T10:30:00Z",
			content: "Some content\n\n---\n\n## Highlights\n\n---\n\nMore content",
		};

		const result = applyTemplateVariables(template, variables);
		expect(result).not.toContain("## Highlights");
		expect(result).toContain("Some content");
		expect(result).toContain("More content");
	});

	test("removes empty Highlights at end of content", () => {
		const template = "{{content}}";
		const variables: TemplateVariables = {
			title: "Test",
			source: "https://example.com",
			domain: "example.com",
			clipped: "2024-01-15T10:30:00Z",
			content: "Some content\n\n## Highlights\n\n",
		};

		const result = applyTemplateVariables(template, variables);
		expect(result).not.toContain("## Highlights");
		expect(result).toContain("Some content");
	});

	test("cleans up consecutive dividers after removing empty sections", () => {
		const template = "{{content}}";
		const variables: TemplateVariables = {
			title: "Test",
			source: "https://example.com",
			domain: "example.com",
			clipped: "2024-01-15T10:30:00Z",
			content: "Content above\n\n---\n\n\n\n---\n\nContent below",
		};

		const result = applyTemplateVariables(template, variables);
		// Should merge consecutive dividers into one
		expect(result).not.toContain("---\n\n\n\n---");
		expect(result).toContain("Content above");
		expect(result).toContain("Content below");
	});

	test("preserves Highlights section when it has content", () => {
		const template = "{{content}}";
		const variables: TemplateVariables = {
			title: "Test",
			source: "https://example.com",
			domain: "example.com",
			clipped: "2024-01-15T10:30:00Z",
			content:
				"Some content\n\n---\n\n## Highlights\n\n- Important point\n- Another highlight\n\n---\n\nMore content",
		};

		const result = applyTemplateVariables(template, variables);
		expect(result).toContain("## Highlights");
		expect(result).toContain("- Important point");
		expect(result).toContain("- Another highlight");
	});
});
