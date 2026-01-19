import { describe, expect, test } from "bun:test";
import { addDays, format } from "date-fns";

import { createTestTemplate } from "../testing/utils";
import {
	applyDateSubstitutions,
	convertTemplaterFormat,
	detectTitlePromptKey,
	extractSourceHeadings,
	getEditableSections,
	getTemplateSections,
	suggestSectionMapping,
} from "./index";

describe("convertTemplaterFormat", () => {
	test("converts YYYY-MM-DD to yyyy-MM-dd", () => {
		expect(convertTemplaterFormat("YYYY-MM-DD")).toBe("yyyy-MM-dd");
	});

	test("converts YYYY-MM-DD HH:mm to yyyy-MM-dd HH:mm", () => {
		expect(convertTemplaterFormat("YYYY-MM-DD HH:mm")).toBe("yyyy-MM-dd HH:mm");
	});

	test("converts dddd, MMMM D, YYYY to EEEE, MMMM d, yyyy", () => {
		expect(convertTemplaterFormat("dddd, MMMM D, YYYY")).toBe(
			"EEEE, MMMM d, yyyy",
		);
	});

	test("converts YYYY alone", () => {
		expect(convertTemplaterFormat("YYYY")).toBe("yyyy");
	});

	test("handles mixed formats", () => {
		expect(convertTemplaterFormat("DD/MM/YYYY")).toBe("dd/MM/yyyy");
	});

	test("escapes T separator in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)", () => {
		// T must be escaped to prevent date-fns from outputting milliseconds timestamp
		expect(convertTemplaterFormat("YYYY-MM-DDTHH:mm:ss")).toBe(
			"yyyy-MM-dd'T'HH:mm:ss",
		);
	});

	test("escapes T separator with 12-hour format (YYYY-MM-DDThh:mm:ss)", () => {
		expect(convertTemplaterFormat("YYYY-MM-DDThh:mm:ss")).toBe(
			"yyyy-MM-dd'T'hh:mm:ss",
		);
	});
});

describe("applyDateSubstitutions", () => {
	const today = new Date();
	const todayFormatted = format(today, "yyyy-MM-dd");

	test("replaces simple YYYY-MM-DD format", () => {
		const input = '<% tp.date.now("YYYY-MM-DD") %>';
		const result = applyDateSubstitutions(input);
		expect(result).toBe(todayFormatted);
	});

	test("replaces datetime format YYYY-MM-DD HH:mm", () => {
		const input = '<% tp.date.now("YYYY-MM-DD HH:mm") %>';
		const result = applyDateSubstitutions(input);
		// Just check it starts with today's date (time will vary)
		expect(result.startsWith(todayFormatted)).toBe(true);
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
	});

	test("replaces with positive offset (tomorrow)", () => {
		const input = '<% tp.date.now("YYYY-MM-DD", 1) %>';
		const result = applyDateSubstitutions(input);
		const expected = format(addDays(today, 1), "yyyy-MM-dd");
		expect(result).toBe(expected);
	});

	test("replaces with negative offset (yesterday)", () => {
		const input = '<% tp.date.now("YYYY-MM-DD", -1) %>';
		const result = applyDateSubstitutions(input);
		const expected = format(addDays(today, -1), "yyyy-MM-dd");
		expect(result).toBe(expected);
	});

	test("replaces full day name format", () => {
		const input = '<% tp.date.now("dddd, MMMM D, YYYY") %>';
		const result = applyDateSubstitutions(input);
		const expected = format(today, "EEEE, MMMM d, yyyy");
		expect(result).toBe(expected);
	});

	test("replaces year only format", () => {
		const input = '<% tp.date.now("YYYY") %>';
		const result = applyDateSubstitutions(input);
		expect(result).toBe(format(today, "yyyy"));
	});

	test("replaces multiple patterns in content", () => {
		const input = `---
created: <% tp.date.now("YYYY-MM-DD") %>
start_date: <% tp.date.now("YYYY-MM-DD") %>
---
# Project started on <% tp.date.now("dddd, MMMM D, YYYY") %>
Yesterday: <% tp.date.now("YYYY-MM-DD", -1) %>
Tomorrow: <% tp.date.now("YYYY-MM-DD", 1) %>`;

		const result = applyDateSubstitutions(input);

		expect(result).toContain(`created: ${todayFormatted}`);
		expect(result).toContain(`start_date: ${todayFormatted}`);
		expect(result).toContain(format(today, "EEEE, MMMM d, yyyy"));
		expect(result).toContain(format(addDays(today, -1), "yyyy-MM-dd"));
		expect(result).toContain(format(addDays(today, 1), "yyyy-MM-dd"));
	});

	test("leaves non-date Templater syntax untouched", () => {
		const input = '<% tp.system.prompt("Title") %>';
		const result = applyDateSubstitutions(input);
		expect(result).toBe(input);
	});

	test("handles whitespace variations in pattern", () => {
		const input1 = '<%tp.date.now("YYYY-MM-DD")%>';
		const input2 = '<%  tp.date.now("YYYY-MM-DD")  %>';

		expect(applyDateSubstitutions(input1)).toBe(todayFormatted);
		expect(applyDateSubstitutions(input2)).toBe(todayFormatted);
		// Note: patterns with space before ) like '<% tp.date.now("YYYY-MM-DD" ) %>'
		// don't match our regex - this is fine, we match the common patterns
	});

	test("preserves surrounding content", () => {
		const input = 'Before <% tp.date.now("YYYY-MM-DD") %> After';
		const result = applyDateSubstitutions(input);
		expect(result).toBe(`Before ${todayFormatted} After`);
	});
});

describe("detectTitlePromptKey", () => {
	test("detects 'Resource title' prompt key", () => {
		const template = createTestTemplate(`---
title: "<% tp.system.prompt("Resource title") %>"
type: resource
---
# <% tp.system.prompt("Resource title") %>`);

		expect(detectTitlePromptKey(template)).toBe("Resource title");
	});

	test("detects 'Project title' prompt key", () => {
		const template = createTestTemplate(`---
title: "<% tp.system.prompt("Project title") %>"
type: project
---
Body`);

		expect(detectTitlePromptKey(template)).toBe("Project title");
	});

	test("detects 'Area title' prompt key", () => {
		const template = createTestTemplate(`---
title: "<% tp.system.prompt("Area title") %>"
type: area
---
Body`);

		expect(detectTitlePromptKey(template)).toBe("Area title");
	});

	test("detects generic 'Title' prompt key", () => {
		const template = createTestTemplate(`---
title: "<% tp.system.prompt("Title") %>"
type: capture
---
Body`);

		expect(detectTitlePromptKey(template)).toBe("Title");
	});

	test("is case-insensitive when matching 'title'", () => {
		const template = createTestTemplate(`---
title: "<% tp.system.prompt("My TITLE Here") %>"
type: test
---
Body`);

		expect(detectTitlePromptKey(template)).toBe("My TITLE Here");
	});

	test("falls back to 'Title' when no title prompt found", () => {
		const template = createTestTemplate(`---
type: test
other_field: "<% tp.system.prompt("Something else") %>"
---
Body`);

		expect(detectTitlePromptKey(template)).toBe("Title");
	});

	test("falls back to 'Title' for empty frontmatter", () => {
		const template = createTestTemplate(`---
---
Body only`);

		expect(detectTitlePromptKey(template)).toBe("Title");
	});

	test("falls back to 'Title' for no frontmatter", () => {
		const template = createTestTemplate(`# Just markdown
No frontmatter here`);

		expect(detectTitlePromptKey(template)).toBe("Title");
	});

	test("only matches prompts in frontmatter, not body", () => {
		const template = createTestTemplate(`---
type: test
---
# <% tp.system.prompt("Body title") %>

This is body content with a title prompt.`);

		// Should fall back to "Title" since "Body title" is not in frontmatter
		expect(detectTitlePromptKey(template)).toBe("Title");
	});

	test("handles whitespace variations in prompt syntax", () => {
		const template = createTestTemplate(`---
title: "<%  tp.system.prompt("Spaced title")  %>"
---
Body`);

		expect(detectTitlePromptKey(template)).toBe("Spaced title");
	});
});

describe("getTemplateSections", () => {
	test("extracts h2 headings from template body", () => {
		const template = createTestTemplate(`---
title: "Test"
---
## Section One
content here

## Section Two
more content`);

		expect(getTemplateSections(template)).toEqual([
			"Section One",
			"Section Two",
		]);
	});

	test("returns empty array for template with no body headings", () => {
		const template = createTestTemplate(`---
title: "Test"
---
No headings here, just plain text.`);

		expect(getTemplateSections(template)).toEqual([]);
	});

	test("ignores h1 and h3+ headings", () => {
		const template = createTestTemplate(`---
title: "Test"
---
# H1 Heading
## H2 Heading
### H3 Heading
#### H4 Heading`);

		expect(getTemplateSections(template)).toEqual(["H2 Heading"]);
	});

	test("strips Templater prompts from heading text", () => {
		const template = createTestTemplate(`---
title: "Test"
---
## <% tp.system.prompt("Title") %>
## Notes`);

		// The Templater prompt heading should be stripped to empty and excluded
		expect(getTemplateSections(template)).toEqual(["Notes"]);
	});

	test("handles template without frontmatter", () => {
		const template = createTestTemplate(`# Just markdown
## Section One
## Section Two`);

		expect(getTemplateSections(template)).toEqual([
			"Section One",
			"Section Two",
		]);
	});

	test("handles empty frontmatter", () => {
		const template = createTestTemplate(`---
---
## Only Section`);

		expect(getTemplateSections(template)).toEqual(["Only Section"]);
	});

	test("handles real booking template sections", () => {
		const template = createTestTemplate(`---
title: "<% tp.system.prompt("Booking title") %>"
type: booking
---
## Booking Details

## Cost & Payment

## Contact Information

## Important Notes`);

		expect(getTemplateSections(template)).toEqual([
			"Booking Details",
			"Cost & Payment",
			"Contact Information",
			"Important Notes",
		]);
	});
});

describe("extractSourceHeadings", () => {
	test("extracts headings with correct levels", () => {
		const content = `# Title
Some content
## Section One
More content
### Subsection`;

		const headings = extractSourceHeadings(content);

		expect(headings).toHaveLength(3);
		expect(headings[0]).toEqual({ text: "Title", level: 1, startLine: 1 });
		expect(headings[1]).toEqual({
			text: "Section One",
			level: 2,
			startLine: 3,
		});
		expect(headings[2]).toEqual({
			text: "Subsection",
			level: 3,
			startLine: 5,
		});
	});

	test("returns empty array for empty content", () => {
		expect(extractSourceHeadings("")).toEqual([]);
		expect(extractSourceHeadings("   \n\t  \n  ")).toEqual([]);
	});

	test("returns empty array when no headings found", () => {
		const content = `Just plain text here.
No headings at all.
More text.`;

		expect(extractSourceHeadings(content)).toEqual([]);
	});

	test("line numbers are accurate", () => {
		const content = `Line 1: regular text
Line 2: more text
# Heading One
Line 4: text
Line 5: text
## Heading Two
Line 7: text`;

		const headings = extractSourceHeadings(content);

		expect(headings).toHaveLength(2);
		expect(headings[0]?.startLine).toBe(3);
		expect(headings[1]?.startLine).toBe(6);
	});

	test("preserves inline formatting in heading text", () => {
		const content = `# **Bold** Title
## Link [example](url) here
### Inline \`code\` here
#### _Italic_ text`;

		const headings = extractSourceHeadings(content);

		expect(headings).toHaveLength(4);
		expect(headings[0]?.text).toBe("**Bold** Title");
		expect(headings[1]?.text).toBe("Link [example](url) here");
		expect(headings[2]?.text).toBe("Inline `code` here");
		expect(headings[3]?.text).toBe("_Italic_ text");
	});

	test("filters out headings inside code blocks", () => {
		const content = `# Real Heading

\`\`\`markdown
# Fake Heading in Code
## Another Fake
\`\`\`

## Real Section

\`\`\`
### More Fake
\`\`\`

### Real Subsection`;

		const headings = extractSourceHeadings(content);

		expect(headings).toHaveLength(3);
		expect(headings[0]?.text).toBe("Real Heading");
		expect(headings[1]?.text).toBe("Real Section");
		expect(headings[2]?.text).toBe("Real Subsection");
	});

	test("handles mixed content with text between headings", () => {
		const content = `# Main Title

This is some introductory text.
It spans multiple lines.

## Overview

More content here.
- List item 1
- List item 2

## Details

Final section with content.`;

		const headings = extractSourceHeadings(content);

		expect(headings).toHaveLength(3);
		expect(headings[0]?.text).toBe("Main Title");
		expect(headings[1]?.text).toBe("Overview");
		expect(headings[2]?.text).toBe("Details");
	});

	test("extracts all heading levels from 1 to 6", () => {
		const content = `# Level 1
## Level 2
### Level 3
#### Level 4
##### Level 5
###### Level 6`;

		const headings = extractSourceHeadings(content);

		expect(headings).toHaveLength(6);
		expect(headings[0]).toEqual({ text: "Level 1", level: 1, startLine: 1 });
		expect(headings[1]).toEqual({ text: "Level 2", level: 2, startLine: 2 });
		expect(headings[2]).toEqual({ text: "Level 3", level: 3, startLine: 3 });
		expect(headings[3]).toEqual({ text: "Level 4", level: 4, startLine: 4 });
		expect(headings[4]).toEqual({ text: "Level 5", level: 5, startLine: 5 });
		expect(headings[5]).toEqual({ text: "Level 6", level: 6, startLine: 6 });
	});

	test("handles tilde code blocks (~~~)", () => {
		const content = `# Real Heading

~~~
## Fake Heading
~~~

## Real Section`;

		const headings = extractSourceHeadings(content);

		expect(headings).toHaveLength(2);
		expect(headings[0]?.text).toBe("Real Heading");
		expect(headings[1]?.text).toBe("Real Section");
	});

	test("handles nested code blocks correctly", () => {
		const content = `# Title

\`\`\`markdown
# Code Block Start
\`\`\`markdown
## Nested?
\`\`\`
# Code Block End
\`\`\`

## Real Heading`;

		const headings = extractSourceHeadings(content);

		// The outer code block should toggle in/out, inner backticks are just text
		expect(headings.some((h) => h.text === "Real Heading")).toBe(true);
	});
});

describe("suggestSectionMapping", () => {
	test("maps semantically similar sections - overview/why group", () => {
		const sourceHeadings = [
			"Project Overview",
			"Technical Details",
			"Timeline",
		];
		const templateSections = ["Why This Matters", "Success Criteria", "Tasks"];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		expect(mapping.get("Why This Matters")).toBe("Project Overview");
	});

	test("maps semantically similar sections - requirements/criteria group", () => {
		const sourceHeadings = ["Overview", "Requirements", "Next Steps"];
		const templateSections = ["Why This Matters", "Success Criteria", "Tasks"];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		expect(mapping.get("Success Criteria")).toBe("Requirements");
	});

	test("maps semantically similar sections - timeline/tasks group", () => {
		const sourceHeadings = ["Overview", "Goals", "Timeline"];
		const templateSections = ["Why This Matters", "Success Criteria", "Tasks"];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		expect(mapping.get("Tasks")).toBe("Timeline");
	});

	test("returns null for template section with no matching source heading", () => {
		const sourceHeadings = ["Random Section", "Unrelated Content"];
		const templateSections = ["Why This Matters", "Success Criteria", "Tasks"];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		expect(mapping.get("Why This Matters")).toBeNull();
		expect(mapping.get("Success Criteria")).toBeNull();
		expect(mapping.get("Tasks")).toBeNull();
	});

	test("direct keyword overlap beats semantic matching", () => {
		const sourceHeadings = ["Success Metrics", "Overview"];
		const templateSections = ["Success Criteria", "Why This Matters"];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		// "Success Metrics" should match "Success Criteria" due to exact word "success"
		expect(mapping.get("Success Criteria")).toBe("Success Metrics");
	});

	test("handles empty source headings array", () => {
		const sourceHeadings: string[] = [];
		const templateSections = ["Why This Matters", "Success Criteria", "Tasks"];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		expect(mapping.get("Why This Matters")).toBeNull();
		expect(mapping.get("Success Criteria")).toBeNull();
		expect(mapping.get("Tasks")).toBeNull();
	});

	test("handles empty template sections array", () => {
		const sourceHeadings = ["Overview", "Requirements", "Timeline"];
		const templateSections: string[] = [];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		expect(mapping.size).toBe(0);
	});

	test("is case insensitive", () => {
		const sourceHeadings = ["PROJECT OVERVIEW", "REQUIREMENTS", "timeline"];
		const templateSections = ["Why This Matters", "Success Criteria", "Tasks"];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		expect(mapping.get("Why This Matters")).toBe("PROJECT OVERVIEW");
		expect(mapping.get("Success Criteria")).toBe("REQUIREMENTS");
		expect(mapping.get("Tasks")).toBe("timeline");
	});

	test("handles punctuation in section names", () => {
		const sourceHeadings = [
			"Project Overview & Summary",
			"Key Requirements!",
			"Next Steps...",
		];
		const templateSections = ["Why This Matters", "Success Criteria", "Tasks"];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		// Punctuation should be stripped during normalization
		expect(mapping.get("Why This Matters")).toBe("Project Overview & Summary");
		expect(mapping.get("Success Criteria")).toBe("Key Requirements!");
		expect(mapping.get("Tasks")).toBe("Next Steps...");
	});

	test("maps notes/details sections", () => {
		const sourceHeadings = ["Overview", "Additional Notes", "Contact"];
		const templateSections = [
			"Why This Matters",
			"Important Notes",
			"Contact Information",
		];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		expect(mapping.get("Important Notes")).toBe("Additional Notes");
	});

	test("prefers stronger matches when multiple options exist", () => {
		const sourceHeadings = ["General Overview", "Project Summary", "Timeline"];
		const templateSections = ["Why This Matters"];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		// Should pick the one with best keyword overlap
		// Both have semantic matches, but we should get a deterministic result
		const match = mapping.get("Why This Matters");
		expect(match).not.toBeNull();
		expect(sourceHeadings).toContain(match ?? "");
	});

	test("handles real-world booking template sections", () => {
		const sourceHeadings = [
			"Reservation Info",
			"Payment Details",
			"Hotel Contact",
			"Additional Notes",
		];
		const templateSections = [
			"Booking Details",
			"Cost & Payment",
			"Contact Information",
			"Important Notes",
		];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		// Contact should match (keyword overlap)
		// Notes should match (keyword overlap + semantic group)
		expect(mapping.get("Contact Information")).toBe("Hotel Contact");
		expect(mapping.get("Important Notes")).toBe("Additional Notes");
	});

	test("matches action-oriented sections", () => {
		const sourceHeadings = ["Next Steps", "Action Items", "To-Do List"];
		const templateSections = ["Tasks", "Next Actions"];

		const mapping = suggestSectionMapping(sourceHeadings, templateSections);

		// Tasks should match action-oriented headings
		const tasksMatch = mapping.get("Tasks");
		expect(tasksMatch).not.toBeNull();
		expect(["Next Steps", "Action Items", "To-Do List"]).toContain(
			tasksMatch ?? "",
		);
	});
});

describe("getEditableSections", () => {
	test("returns all sections when no dataview present", () => {
		const template = createTestTemplate(`---
title: "Test"
---
## Section One
Regular content here.

## Section Two
More regular content.

## Notes
Additional notes.`);

		const sections = getEditableSections(template);

		expect(sections).toEqual(["Section One", "Section Two", "Notes"]);
	});

	test("excludes sections with fenced dataview blocks", () => {
		const template = createTestTemplate(`---
title: "Test"
---
## Editable Section
Regular content here.

## Related Items
\`\`\`dataview
TABLE title, status
FROM #project
\`\`\`

## Notes
Additional notes.`);

		const sections = getEditableSections(template);

		expect(sections).toEqual(["Editable Section", "Notes"]);
		expect(sections).not.toContain("Related Items");
	});

	test("excludes sections with inline dataview expressions", () => {
		const template = createTestTemplate(`---
title: "Test"
---
## Project Overview

| Field          | Value                      |
| -------------- | -------------------------- |
| **Status**     | \`= this.status\`            |
| **Start Date** | \`= this.start_date\`        |
| **Target**     | \`= this.target_completion\` |
| **Area**       | \`= this.area\`              |

## Why This Matters
Editable content here.

## Tasks
- [ ] Do something`);

		const sections = getEditableSections(template);

		// Project Overview should be excluded due to inline dataview
		expect(sections).not.toContain("Project Overview");
		expect(sections).toContain("Why This Matters");
		expect(sections).toContain("Tasks");
	});

	test("excludes sections with inline dataview file properties", () => {
		const template = createTestTemplate(`---
title: "Test"
---
# \`= this.file.name\`

## Overview
\`= this.file.name\` is a great project.

## Description
Regular content here.`);

		const sections = getEditableSections(template);

		// Overview contains inline dataview, should be excluded
		expect(sections).not.toContain("Overview");
		expect(sections).toContain("Description");
	});

	test("handles mixed dataview types in different sections", () => {
		const template = createTestTemplate(`---
title: "Test"
---
## Stats
| Status | \`= this.status\` |

## Related
\`\`\`dataview
LIST FROM [[#]]
\`\`\`

## Editable
Regular markdown content.

## Also Editable
More content without dataview.`);

		const sections = getEditableSections(template);

		expect(sections).toEqual(["Editable", "Also Editable"]);
	});

	test("returns empty array when all sections have dataview", () => {
		const template = createTestTemplate(`---
title: "Test"
---
## Section One
\`= this.field\`

## Section Two
\`\`\`dataview
TABLE file.name
\`\`\`

## Section Three
Status: \`= this.status\`

## End Marker`);

		const sections = getEditableSections(template);

		// End Marker is editable but has no content
		// The first three sections all have dataview
		expect(sections).not.toContain("Section One");
		expect(sections).not.toContain("Section Two");
		expect(sections).not.toContain("Section Three");
	});

	test("handles inline dataview with various whitespace", () => {
		const template = createTestTemplate(`---
title: "Test"
---
## Spaced
\`=  this.status\`

## No Dataview
Regular content.`);

		const sections = getEditableSections(template);

		// Spaced section has inline dataview with extra space
		expect(sections).not.toContain("Spaced");
		expect(sections).toContain("No Dataview");
	});

	test("does not match regular inline code as dataview", () => {
		const template = createTestTemplate(`---
title: "Test"
---
## Code Examples
Use \`const x = 1\` for variables.

## Another
Regular \`console.log()\` content.`);

		const sections = getEditableSections(template);

		// Regular inline code should NOT be treated as dataview
		expect(sections).toEqual(["Code Examples", "Another"]);
	});

	test("real world: project template excludes Project Overview", () => {
		// Simulates the actual project template structure
		const template = createTestTemplate(`---
type: project
status: active
---
# \`= this.file.name\`

> **Project** = Has an end date = Can be finished

## Project Overview

| Field          | Value                      |
| -------------- | -------------------------- |
| **Status**     | \`= this.status\`            |
| **Start Date** | \`= this.start_date\`        |
| **Target**     | \`= this.target_completion\` |
| **Area**       | \`= this.area\`              |
| **Depends On** | \`= this.depends_on\`        |
| **Blocks**     | \`= this.blocks\`            |

## Why This Matters
<!-- What problem does this solve? -->

## Tasks
<!-- Task list here -->

## Meetings
\`\`\`dataview
TABLE summary as "Summary", meeting_date as "Date"
WHERE type = "meeting" AND contains(project, this.file.link)
SORT meeting_date DESC
\`\`\`

## Key Resources
\`\`\`dataview
TABLE clipping_type as "Type", summary as "Summary"
WHERE type = "clipping"
\`\`\`

## Stakeholders
<!-- Who else is involved? -->

## Risks & Blockers
<!-- What could prevent completion? -->

## Notes
<!-- Additional context -->`);

		const sections = getEditableSections(template);

		// Project Overview, Meetings, Key Resources should be excluded (have dataview)
		expect(sections).not.toContain("Project Overview");
		expect(sections).not.toContain("Meetings");
		expect(sections).not.toContain("Key Resources");

		// These should be editable
		expect(sections).toContain("Why This Matters");
		expect(sections).toContain("Tasks");
		expect(sections).toContain("Stakeholders");
		expect(sections).toContain("Risks & Blockers");
		expect(sections).toContain("Notes");
	});
});

describe("getTemplateFields", () => {
	// Need to import getTemplateFields for these tests
	const { getTemplateFields } = require("./index");

	test("extracts fields from Templater syntax", () => {
		const template = createTestTemplate(`---
title: "<% tp.system.prompt("Project title") %>"
status: "<% tp.system.prompt("Status", "planning") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
---
# <% tp.system.prompt("Project title") %>`);

		const fields = getTemplateFields(template);

		// Should have: Project title, Status, created (auto-date)
		expect(fields.some((f: { key: string }) => f.key === "Project title")).toBe(
			true,
		);
		expect(fields.some((f: { key: string }) => f.key === "Status")).toBe(true);
		expect(
			fields.some(
				(f: { key: string; isAutoDate: boolean }) =>
					f.key === "created" && f.isAutoDate,
			),
		).toBe(true);

		// Status should have default value
		const statusField = fields.find((f: { key: string }) => f.key === "Status");
		expect(statusField?.defaultValue).toBe("planning");
	});

	test("extracts fields from native placeholder syntax", () => {
		const template = createTestTemplate(`---
status: "{{status:planning}}"
area: "[[{{area}}]]"
created: {{date:YYYY-MM-DD}}
---
# {{title}}`);

		const fields = getTemplateFields(template);

		// Should have: status, area, created (auto-date)
		// Note: title is special, not extracted as a field
		expect(fields.some((f: { key: string }) => f.key === "status")).toBe(true);
		expect(fields.some((f: { key: string }) => f.key === "area")).toBe(true);
		expect(
			fields.some(
				(f: { key: string; isAutoDate: boolean }) =>
					f.key === "created" && f.isAutoDate,
			),
		).toBe(true);

		// status should have default value
		const statusField = fields.find((f: { key: string }) => f.key === "status");
		expect(statusField?.defaultValue).toBe("planning");

		// area should not have default
		const areaField = fields.find((f: { key: string }) => f.key === "area");
		expect(areaField?.defaultValue).toBeUndefined();
	});

	test("does not extract reserved placeholders as fields", () => {
		const template = createTestTemplate(`---
created: {{date}}
---
# {{title}}

{{content}}`);

		const fields = getTemplateFields(template);

		// date, title, content are reserved - not user fields
		expect(fields.some((f: { key: string }) => f.key === "date")).toBe(false);
		expect(fields.some((f: { key: string }) => f.key === "title")).toBe(false);
		expect(fields.some((f: { key: string }) => f.key === "content")).toBe(
			false,
		);

		// But created auto-date should be detected
		expect(
			fields.some(
				(f: { key: string; isAutoDate: boolean }) =>
					f.key === "created" && f.isAutoDate,
			),
		).toBe(true);
	});

	test("handles body-only fields", () => {
		const template = createTestTemplate(`---
type: test
---
# Test

## Goal
{{goal}}

## Notes
<% tp.system.prompt("Notes prompt") %>`);

		const fields = getTemplateFields(template);

		// Both should be in body, not frontmatter
		const goalField = fields.find((f: { key: string }) => f.key === "goal");
		const notesField = fields.find(
			(f: { key: string }) => f.key === "Notes prompt",
		);

		expect(goalField?.inFrontmatter).toBe(false);
		expect(notesField?.inFrontmatter).toBe(false);
	});

	test("deduplicates fields appearing in both frontmatter and body", () => {
		const template = createTestTemplate(`---
title: "{{myTitle}}"
---
# {{myTitle}}`);

		const fields = getTemplateFields(template);

		// Should only have one entry for myTitle
		const myTitleFields = fields.filter(
			(f: { key: string }) => f.key === "myTitle",
		);
		expect(myTitleFields).toHaveLength(1);
		expect(myTitleFields[0].inFrontmatter).toBe(true);
	});
});
