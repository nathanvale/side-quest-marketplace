/**
 * Tests for frontmatter parsing and serialization utilities.
 *
 * @module obsidian/frontmatter.test
 */

import { describe, expect, test } from "bun:test";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
	test("parses valid frontmatter", () => {
		const content = `---
title: Test Note
tags:
  - work
---
# Content here`;

		const result = parseFrontmatter(content);
		expect(result.attributes).toEqual({
			title: "Test Note",
			tags: ["work"],
		});
		expect(result.body).toBe("\n# Content here");
	});

	test("returns empty attributes for content without frontmatter", () => {
		const content = "# Just content\nNo frontmatter here.";
		const result = parseFrontmatter(content);
		expect(result.attributes).toEqual({});
		expect(result.body).toBe(content);
	});

	test("returns empty attributes for unclosed frontmatter", () => {
		const content = `---
title: Test Note
# No closing markers`;

		const result = parseFrontmatter(content);
		expect(result.attributes).toEqual({});
		expect(result.body).toBe(content);
	});

	test("throws error for invalid YAML", () => {
		const content = `---
title: Test Note
invalid: [unclosed
---
# Content`;

		expect(() => parseFrontmatter(content)).toThrow("Invalid frontmatter");
	});

	test("handles empty frontmatter block", () => {
		const content = `---
---
# Content`;

		const result = parseFrontmatter(content);
		expect(result.attributes).toEqual({});
		expect(result.body).toBe("\n# Content");
	});

	test("handles frontmatter with complex nested structures", () => {
		const content = `---
title: Complex Note
metadata:
  author: John
  tags:
    - work
    - project
  nested:
    deep: value
---
Body content`;

		const result = parseFrontmatter(content);
		expect(result.attributes).toEqual({
			title: "Complex Note",
			metadata: {
				author: "John",
				tags: ["work", "project"],
				nested: {
					deep: "value",
				},
			},
		});
		expect(result.body).toBe("\nBody content");
	});
});

describe("serializeFrontmatter", () => {
	test("serializes attributes and body", () => {
		const result = serializeFrontmatter(
			{ title: "Note", tags: ["work"] },
			"# Content",
		);

		expect(result).toContain("---");
		expect(result).toContain("title: Note");
		expect(result).toContain("tags:");
		expect(result).toContain("- work");
		expect(result).toContain("# Content");
	});

	test("omits null values from frontmatter (Obsidian best practice)", () => {
		const result = serializeFrontmatter(
			{
				title: "Note",
				area: null,
				project: null,
				status: "active",
			},
			"# Content",
		);

		// Should contain non-null values
		expect(result).toContain("title: Note");
		expect(result).toContain("status: active");

		// Should NOT contain null values
		expect(result).not.toContain("area");
		expect(result).not.toContain("project");
		expect(result).not.toContain("null");
	});

	test("preserves empty strings (different from null)", () => {
		const result = serializeFrontmatter(
			{
				title: "Note",
				description: "",
			},
			"# Content",
		);

		expect(result).toContain("title: Note");
		expect(result).toContain('description: ""');
	});

	test("preserves zero values", () => {
		const result = serializeFrontmatter(
			{
				title: "Note",
				count: 0,
			},
			"# Content",
		);

		expect(result).toContain("title: Note");
		expect(result).toContain("count: 0");
	});

	test("preserves false boolean values", () => {
		const result = serializeFrontmatter(
			{
				title: "Note",
				completed: false,
			},
			"# Content",
		);

		expect(result).toContain("title: Note");
		expect(result).toContain("completed: false");
	});

	test("roundtrip: parse then serialize maintains non-null values", () => {
		const original = `---
title: Test Note
status: active
tags:
  - work
---
# Content here`;

		const parsed = parseFrontmatter(original);
		const serialized = serializeFrontmatter(parsed.attributes, parsed.body);
		const reparsed = parseFrontmatter(serialized);

		expect(reparsed.attributes).toEqual(parsed.attributes);
	});

	test("handles empty attributes object", () => {
		const result = serializeFrontmatter({}, "# Content");

		expect(result).toBe("---\n\n---\n# Content");
	});

	test("strips leading newline from body", () => {
		const result = serializeFrontmatter({ title: "Note" }, "\n# Content");

		expect(result).toContain("---\n# Content");
		expect(result).not.toContain("---\n\n# Content");
	});

	test("handles complex nested structures", () => {
		const attributes = {
			title: "Complex Note",
			metadata: {
				author: "John",
				tags: ["work", "project"],
				nested: {
					deep: "value",
				},
			},
		};

		const result = serializeFrontmatter(attributes, "Body content");

		expect(result).toContain("title: Complex Note");
		expect(result).toContain("metadata:");
		expect(result).toContain("author: John");
		expect(result).toContain("- work");
		expect(result).toContain("- project");
		expect(result).toContain("deep: value");
	});
});
