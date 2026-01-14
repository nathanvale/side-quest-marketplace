import { describe, expect, test } from "bun:test";
import { parseClippingSections } from "./clipping-processor.js";

describe("parseClippingSections", () => {
	test("detects highlights-only clip when highlights section has content and content is empty", () => {
		const content = `# \`= this.file.name\`

**Source:** [google.com](https://example.com)
**Clipped:** 2026-01-14 18:43

---

## Highlights

- Good for kids
- Kid-friendly hikes
- Playground

---

## Content

`;

		const result = parseClippingSections(content);

		expect(result.isHighlightsClip).toBe(true);
		expect(result.highlights).toBe(
			"- Good for kids\n- Kid-friendly hikes\n- Playground",
		);
		expect(result.contentSection).toBe("");
	});

	test("detects full page clip when content has content and highlights is empty", () => {
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

		expect(result.isHighlightsClip).toBe(false);
		expect(result.highlights).toBe("");
		expect(result.contentSection).toContain("full article content");
	});

	test("detects highlights clip when content matches highlights (Web Clipper behavior)", () => {
		const content = `# \`= this.file.name\`

**Source:** [example.com](https://example.com)
**Clipped:** 2026-01-14 18:43

---

## Highlights

- Important point 1
- Important point 2

---

## Content

- Important point 1
- Important point 2`;

		const result = parseClippingSections(content);

		expect(result.isHighlightsClip).toBe(true);
		expect(result.highlights).toBe("- Important point 1\n- Important point 2");
	});

	test("detects full page clip when both sections have different content", () => {
		const content = `# \`= this.file.name\`

**Source:** [example.com](https://example.com)
**Clipped:** 2026-01-14 18:43

---

## Highlights



---

## Content

Full page content that is completely different.
Multiple paragraphs of actual article text.`;

		const result = parseClippingSections(content);

		expect(result.isHighlightsClip).toBe(false);
		expect(result.contentSection).toContain("Full page content");
	});

	test("handles content with no highlights section", () => {
		const content = `# Title

## Content

Just content, no highlights section at all.`;

		const result = parseClippingSections(content);

		expect(result.isHighlightsClip).toBe(false);
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

		// Legacy format - no ## Highlights section means we can't tell if these are highlights
		// Should be treated as full page clip (conservative approach)
		expect(result.isHighlightsClip).toBe(false);
		expect(result.highlights).toBe("");
		expect(result.contentSection).toContain("Good for kids");
	});

	test("detects highlights clip when Web Clipper adds double-dash formatting", () => {
		// Real-world case: Web Clipper sometimes adds extra dashes to list items
		const content = `# \`= this.file.name\`

**Source:** [google.com](https://example.com)
**Clipped:** 2026-01-14 18:59

---

## Highlights

- - Good for kids
- Good for kids birthday
- Kid-friendly hikes
- Playground

---

## Content

- Good for kids
- Good for kids birthday
- Kid-friendly hikes
- Playground`;

		const result = parseClippingSections(content);

		// Despite formatting differences (double-dash in highlights), should detect as highlights clip
		// because the actual text content is the same
		expect(result.isHighlightsClip).toBe(true);
		expect(result.highlights).toContain("Good for kids");
	});
});
