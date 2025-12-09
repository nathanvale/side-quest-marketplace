/**
 * Tests for extractSourceHeadings() function.
 */
import { describe, expect, test } from "bun:test";
import { extractSourceHeadings } from "./templates";

describe("extractSourceHeadings", () => {
	test("extracts simple headings", () => {
		const content = `# Main Title
Some content
## Overview
More content
## Requirements`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "Main Title", level: 1, startLine: 1 },
			{ text: "Overview", level: 2, startLine: 3 },
			{ text: "Requirements", level: 2, startLine: 5 },
		]);
	});

	test("extracts all heading levels (1-6)", () => {
		const content = `# Level 1
## Level 2
### Level 3
#### Level 4
##### Level 5
###### Level 6`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "Level 1", level: 1, startLine: 1 },
			{ text: "Level 2", level: 2, startLine: 2 },
			{ text: "Level 3", level: 3, startLine: 3 },
			{ text: "Level 4", level: 4, startLine: 4 },
			{ text: "Level 5", level: 5, startLine: 5 },
			{ text: "Level 6", level: 6, startLine: 6 },
		]);
	});

	test("returns empty array for empty content", () => {
		expect(extractSourceHeadings("")).toEqual([]);
		expect(extractSourceHeadings("   ")).toEqual([]);
		expect(extractSourceHeadings("\n\n")).toEqual([]);
	});

	test("returns empty array when no headings present", () => {
		const content = `Just some text
No headings here
Just paragraphs`;

		expect(extractSourceHeadings(content)).toEqual([]);
	});

	test("preserves heading text with inline formatting", () => {
		const content = `# **Bold** Title
## Title with *italic*
### Title with [link](url)
#### Title with \`code\``;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "**Bold** Title", level: 1, startLine: 1 },
			{ text: "Title with *italic*", level: 2, startLine: 2 },
			{ text: "Title with [link](url)", level: 3, startLine: 3 },
			{ text: "Title with `code`", level: 4, startLine: 4 },
		]);
	});

	test("ignores headings inside code blocks (backticks)", () => {
		const content = `# Real Heading

\`\`\`
# Fake Heading in Code
## Another Fake
\`\`\`

## Real Heading 2`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "Real Heading", level: 1, startLine: 1 },
			{ text: "Real Heading 2", level: 2, startLine: 8 },
		]);
	});

	test("ignores headings inside code blocks (tildes)", () => {
		const content = `# Real Heading

~~~
# Fake Heading in Code
## Another Fake
~~~

## Real Heading 2`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "Real Heading", level: 1, startLine: 1 },
			{ text: "Real Heading 2", level: 2, startLine: 8 },
		]);
	});

	test("handles code blocks with language specifiers", () => {
		const content = `# Real Heading

\`\`\`typescript
# Fake Heading in Code
function foo() {}
\`\`\`

## Real Heading 2`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "Real Heading", level: 1, startLine: 1 },
			{ text: "Real Heading 2", level: 2, startLine: 8 },
		]);
	});

	test("handles nested code blocks correctly", () => {
		const content = `# Real Heading

\`\`\`
# Code 1
\`\`\`

## Real 2

\`\`\`
# Code 2
\`\`\`

### Real 3`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "Real Heading", level: 1, startLine: 1 },
			{ text: "Real 2", level: 2, startLine: 7 },
			{ text: "Real 3", level: 3, startLine: 13 },
		]);
	});

	test("ignores # without space (not valid markdown)", () => {
		const content = `# Valid Heading
#Invalid
## Valid 2`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "Valid Heading", level: 1, startLine: 1 },
			{ text: "Valid 2", level: 2, startLine: 3 },
		]);
	});

	test("trims whitespace from heading text", () => {
		const content = `#    Lots of Spaces
##  Few Spaces  `;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "Lots of Spaces", level: 1, startLine: 1 },
			{ text: "Few Spaces", level: 2, startLine: 2 },
		]);
	});

	test("handles headings with trailing whitespace", () => {
		const content = `# Title
## Subtitle  `;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "Title", level: 1, startLine: 1 },
			{ text: "Subtitle", level: 2, startLine: 2 },
		]);
	});

	test("reports correct line numbers with blank lines", () => {
		const content = `# First


## Second

### Third`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "First", level: 1, startLine: 1 },
			{ text: "Second", level: 2, startLine: 4 },
			{ text: "Third", level: 3, startLine: 6 },
		]);
	});

	test("handles headings with special characters", () => {
		const content = `# Title with & Special
## Title with @#$%
### Title (with parens)
#### Title [with brackets]`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "Title with & Special", level: 1, startLine: 1 },
			{ text: "Title with @#$%", level: 2, startLine: 2 },
			{ text: "Title (with parens)", level: 3, startLine: 3 },
			{ text: "Title [with brackets]", level: 4, startLine: 4 },
		]);
	});

	test("handles complex document with mixed content", () => {
		const content = `# Main Document

This is some intro text.

## Section 1

Content here.

\`\`\`javascript
# This is not a heading
const code = "example";
## Neither is this
\`\`\`

## Section 2

More content.

### Subsection 2.1

Even more content.

## Section 3

Final section.`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "Main Document", level: 1, startLine: 1 },
			{ text: "Section 1", level: 2, startLine: 5 },
			{ text: "Section 2", level: 2, startLine: 15 },
			{ text: "Subsection 2.1", level: 3, startLine: 19 },
			{ text: "Section 3", level: 2, startLine: 23 },
		]);
	});

	test("handles headings with emoji", () => {
		const content = `# 🎯 Goals
## 📝 Notes
### ✅ Tasks`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "🎯 Goals", level: 1, startLine: 1 },
			{ text: "📝 Notes", level: 2, startLine: 2 },
			{ text: "✅ Tasks", level: 3, startLine: 3 },
		]);
	});

	test("handles headings with wikilinks", () => {
		const content = `# [[Project Name]]
## Related to [[Other Project]]`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "[[Project Name]]", level: 1, startLine: 1 },
			{ text: "Related to [[Other Project]]", level: 2, startLine: 2 },
		]);
	});

	test("handles real-world PARA note structure", () => {
		const content = `---
title: Garden Shed Project
status: active
tags: [project, home]
---

# Garden Shed Project

## Overview

Building a new shed for garden tools.

## Requirements

- 8x10 feet
- Weather resistant
- Tool organization

## Timeline

\`\`\`
# This is a timeline diagram
Week 1: Foundation
Week 2: Walls
\`\`\`

## Budget

Total: $2000

## Next Steps

- [ ] Order materials
- [ ] Schedule work`;

		const result = extractSourceHeadings(content);

		expect(result).toEqual([
			{ text: "Garden Shed Project", level: 1, startLine: 7 },
			{ text: "Overview", level: 2, startLine: 9 },
			{ text: "Requirements", level: 2, startLine: 13 },
			{ text: "Timeline", level: 2, startLine: 19 },
			{ text: "Budget", level: 2, startLine: 27 },
			{ text: "Next Steps", level: 2, startLine: 31 },
		]);
	});
});
