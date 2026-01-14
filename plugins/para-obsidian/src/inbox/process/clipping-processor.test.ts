import { describe, expect, test } from "bun:test";
import { parseClippingSections } from "./clipping-processor.js";

describe("parseClippingSections", () => {
	test("extracts content section from clipping", () => {
		const content = `# \`= this.file.name\`

**Source:** [google.com](https://example.com)
**Clipped:** 2026-01-14 18:43

---

## Content

- Good for kids
- Kid-friendly hikes
- Playground`;

		const result = parseClippingSections(content);

		expect(result.contentSection).toBe(
			"- Good for kids\n- Kid-friendly hikes\n- Playground",
		);
	});

	test("extracts highlights section when present", () => {
		const content = `# \`= this.file.name\`

**Source:** [example.com](https://example.com)
**Clipped:** 2026-01-14 18:43

---

## Highlights

- Important point 1
- Important point 2

---

## Content

Full page content here.`;

		const result = parseClippingSections(content);

		expect(result.highlights).toBe("- Important point 1\n- Important point 2");
		expect(result.contentSection).toBe("Full page content here.");
	});

	test("returns empty highlights when section is empty", () => {
		const content = `# \`= this.file.name\`

**Source:** [example.com](https://example.com)
**Clipped:** 2026-01-14 18:43

---

## Highlights



---

## Content

This is the full article content with paragraphs and details about the topic.
It includes multiple lines of text.`;

		const result = parseClippingSections(content);

		expect(result.highlights).toBe("");
		expect(result.contentSection).toContain("full article content");
	});

	test("handles content with no highlights section", () => {
		const content = `# Title

## Content

Just content, no highlights section at all.`;

		const result = parseClippingSections(content);

		expect(result.highlights).toBe("");
		expect(result.contentSection).toContain("Just content");
	});

	test("handles legacy clipping format with only Content section", () => {
		const content = `# \`= this.file.name\`

**Source:** [google.com](https://example.com)
**Clipped:** 2026-01-14 17:09

---

## Content

- Good for kids
- Good for kids birthday`;

		const result = parseClippingSections(content);

		expect(result.highlights).toBe("");
		expect(result.contentSection).toContain("Good for kids");
	});
});

describe("highlight_count detection", () => {
	test("highlight_count > 0 indicates highlights clip", () => {
		// This tests the concept - actual detection happens in processClipping
		// via frontmatter.highlight_count property
		const highlightCount = 4;
		const isHighlightsClip = highlightCount > 0;

		expect(isHighlightsClip).toBe(true);
	});

	test("highlight_count = 0 indicates full page clip", () => {
		const highlightCount = 0;
		const isHighlightsClip = highlightCount > 0;

		expect(isHighlightsClip).toBe(false);
	});

	test("missing highlight_count treated as full page clip", () => {
		const highlightCount = undefined;
		const isHighlightsClip = (highlightCount ?? 0) > 0;

		expect(isHighlightsClip).toBe(false);
	});
});
