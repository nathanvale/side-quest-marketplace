import { describe, expect, test } from "bun:test";
import { parseClippingSections } from "./clipping-processor.js";

describe("parseClippingSections", () => {
	test("extracts content section and highlight count from highlights clip", () => {
		const content = `# \`= this.file.name\`

**Source:** [google.com](https://example.com)
**Clipped:** 2026-01-14 18:43

---

## Content

- Good for kids
- Kid-friendly hikes
- Playground

<!-- highlights:3 -->`;

		const result = parseClippingSections(content);

		expect(result.contentSection).toBe(
			"- Good for kids\n- Kid-friendly hikes\n- Playground",
		);
		expect(result.highlightCount).toBe(3);
	});

	test("extracts content section and zero highlight count from full page clip", () => {
		const content = `# \`= this.file.name\`

**Source:** [example.com](https://example.com)
**Clipped:** 2026-01-14 18:43

---

## Content

This is the full article content with paragraphs and details about the topic.
It includes multiple lines of text.

<!-- highlights:0 -->`;

		const result = parseClippingSections(content);

		expect(result.contentSection).toContain("full article content");
		expect(result.highlightCount).toBe(0);
	});

	test("handles missing highlight marker (legacy clips)", () => {
		const content = `# \`= this.file.name\`

**Source:** [google.com](https://example.com)
**Clipped:** 2026-01-14 17:09

---

## Content

- Good for kids
- Good for kids birthday`;

		const result = parseClippingSections(content);

		expect(result.contentSection).toContain("Good for kids");
		expect(result.highlightCount).toBe(0); // Missing marker = assume full page
	});

	test("handles highlight marker with spaces", () => {
		const content = `## Content

Some content here

<!--  highlights:5  -->`;

		const result = parseClippingSections(content);

		expect(result.highlightCount).toBe(5);
	});

	test("extracts content without highlight marker in output", () => {
		const content = `## Content

My highlighted notes

<!-- highlights:2 -->`;

		const result = parseClippingSections(content);

		expect(result.contentSection).toBe("My highlighted notes");
		expect(result.contentSection).not.toContain("highlights:");
	});
});

describe("highlights clip detection", () => {
	test("highlightCount > 0 indicates highlights clip", () => {
		const content = `## Content

Highlights here

<!-- highlights:4 -->`;

		const result = parseClippingSections(content);
		const isHighlightsClip = result.highlightCount > 0;

		expect(isHighlightsClip).toBe(true);
	});

	test("highlightCount = 0 indicates full page clip", () => {
		const content = `## Content

Full page content

<!-- highlights:0 -->`;

		const result = parseClippingSections(content);
		const isHighlightsClip = result.highlightCount > 0;

		expect(isHighlightsClip).toBe(false);
	});

	test("missing marker treated as full page clip", () => {
		const content = `## Content

Legacy content without marker`;

		const result = parseClippingSections(content);
		const isHighlightsClip = result.highlightCount > 0;

		expect(isHighlightsClip).toBe(false);
	});
});
