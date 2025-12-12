/**
 * Markdown Extractor Tests
 *
 * Tests for the markdown content extractor.
 *
 * @module extractors/markdown.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MarkdownExtractionMetadata } from "./markdown";
import {
	createMarkdownInboxFile,
	extractFrontmatterOnly,
	isMarkdownExtension,
	MARKDOWN_EXTENSIONS,
	markdownExtractor,
} from "./markdown";
import type { ExtractedMetadata, InboxFile } from "./types";

/** Helper to get markdown-specific metadata with proper typing */
type MdMetadata = ExtractedMetadata & MarkdownExtractionMetadata;

/** Cast metadata to markdown-specific type */
function getMdMetadata(
	metadata: ExtractedMetadata | undefined,
): MdMetadata | undefined {
	return metadata as MdMetadata | undefined;
}

describe("markdownExtractor", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `markdown-extractor-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("metadata", () => {
		test("should have correct id", () => {
			expect(markdownExtractor.id).toBe("markdown");
		});

		test("should have correct display name", () => {
			expect(markdownExtractor.displayName).toBe("Markdown Extractor");
		});

		test("should support markdown extensions", () => {
			expect(markdownExtractor.extensions).toContain(".md");
			expect(markdownExtractor.extensions).toContain(".markdown");
			expect(markdownExtractor.extensions).toContain(".mdown");
			expect(markdownExtractor.extensions).toContain(".mkd");
		});
	});

	describe("canHandle", () => {
		test("should handle .md files", () => {
			const file: InboxFile = {
				path: "/vault/Inbox/note.md",
				extension: ".md",
				filename: "note.md",
			};
			expect(markdownExtractor.canHandle(file)).toBe(true);
		});

		test("should handle .markdown files", () => {
			const file: InboxFile = {
				path: "/vault/Inbox/note.markdown",
				extension: ".markdown",
				filename: "note.markdown",
			};
			expect(markdownExtractor.canHandle(file)).toBe(true);
		});

		test("should handle uppercase extensions", () => {
			const file: InboxFile = {
				path: "/vault/Inbox/NOTE.MD",
				extension: ".MD",
				filename: "NOTE.MD",
			};
			expect(markdownExtractor.canHandle(file)).toBe(true);
		});

		test("should not handle PDF files", () => {
			const file: InboxFile = {
				path: "/vault/Inbox/document.pdf",
				extension: ".pdf",
				filename: "document.pdf",
			};
			expect(markdownExtractor.canHandle(file)).toBe(false);
		});

		test("should not handle image files", () => {
			const file: InboxFile = {
				path: "/vault/Inbox/photo.png",
				extension: ".png",
				filename: "photo.png",
			};
			expect(markdownExtractor.canHandle(file)).toBe(false);
		});
	});

	describe("checkAvailability", () => {
		test("should always be available", async () => {
			const result = await markdownExtractor.checkAvailability!();
			expect(result.available).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});

	describe("extract", () => {
		test("should extract content from file with frontmatter", async () => {
			const mdPath = join(testDir, "with-frontmatter.md");
			writeFileSync(
				mdPath,
				`---
title: My Note
tags:
  - work
  - important
type: project
---
# Content

This is the body content.
`,
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "with-frontmatter.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");

			expect(result.source).toBe("markdown");
			expect(result.filePath).toBe(mdPath);
			expect(result.text).toContain("[Frontmatter]");
			expect(result.text).toContain("title: My Note");
			expect(result.text).toContain("tags: work, important");
			expect(result.text).toContain("[Content]");
			expect(result.text).toContain("# Content");
			expect(result.text).toContain("This is the body content.");
		});

		test("should extract content from file without frontmatter", async () => {
			const mdPath = join(testDir, "no-frontmatter.md");
			writeFileSync(
				mdPath,
				`# Simple Note

Just some content without frontmatter.
`,
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "no-frontmatter.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");

			expect(result.source).toBe("markdown");
			expect(result.text).not.toContain("[Frontmatter]");
			expect(result.text).toContain("# Simple Note");
			expect(result.text).toContain("Just some content without frontmatter.");
		});

		test("should extract title from frontmatter", async () => {
			const mdPath = join(testDir, "titled.md");
			writeFileSync(
				mdPath,
				`---
title: Custom Title
---
# Different Heading
`,
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "titled.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.title).toBe("Custom Title");
		});

		test("should extract title from H1 if no frontmatter title", async () => {
			const mdPath = join(testDir, "h1-title.md");
			writeFileSync(
				mdPath,
				`---
tags: [note]
---
# Heading Title

Content here.
`,
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "h1-title.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.title).toBe("Heading Title");
		});

		test("should extract tags from frontmatter array", async () => {
			const mdPath = join(testDir, "tags-array.md");
			writeFileSync(
				mdPath,
				`---
tags:
  - tag1
  - tag2
  - tag3
---
Content
`,
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "tags-array.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.tags).toEqual(["tag1", "tag2", "tag3"]);
		});

		test("should extract tags from comma-separated string", async () => {
			const mdPath = join(testDir, "tags-string.md");
			writeFileSync(
				mdPath,
				`---
tags: tag1, tag2, tag3
---
Content
`,
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "tags-string.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.tags).toEqual(["tag1", "tag2", "tag3"]);
		});

		test("should include word count in metadata", async () => {
			const mdPath = join(testDir, "word-count.md");
			writeFileSync(mdPath, "one two three four five");

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "word-count.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.wordCount).toBe(5);
		});

		test("should include line count in metadata", async () => {
			const mdPath = join(testDir, "line-count.md");
			writeFileSync(mdPath, "line 1\nline 2\nline 3");

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "line-count.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.lineCount).toBe(3);
		});

		test("should track hasFrontmatter metadata", async () => {
			const mdWithFm = join(testDir, "with-fm.md");
			writeFileSync(mdWithFm, "---\ntitle: Test\n---\nContent");

			const mdWithoutFm = join(testDir, "without-fm.md");
			writeFileSync(mdWithoutFm, "Just content");

			const fileWithFm: InboxFile = {
				path: mdWithFm,
				extension: ".md",
				filename: "with-fm.md",
			};

			const fileWithoutFm: InboxFile = {
				path: mdWithoutFm,
				extension: ".md",
				filename: "without-fm.md",
			};

			const resultWithFm = await markdownExtractor.extract(
				fileWithFm,
				"test-cid",
			);
			const resultWithoutFm = await markdownExtractor.extract(
				fileWithoutFm,
				"test-cid",
			);

			expect(getMdMetadata(resultWithFm.metadata)?.hasFrontmatter).toBe(true);
			expect(getMdMetadata(resultWithoutFm.metadata)?.hasFrontmatter).toBe(
				false,
			);
		});

		test("should track hasBody metadata", async () => {
			const mdWithBody = join(testDir, "with-body.md");
			writeFileSync(mdWithBody, "---\ntitle: Test\n---\nContent here");

			const mdWithoutBody = join(testDir, "without-body.md");
			writeFileSync(mdWithoutBody, "---\ntitle: Test\n---\n");

			const fileWithBody: InboxFile = {
				path: mdWithBody,
				extension: ".md",
				filename: "with-body.md",
			};

			const fileWithoutBody: InboxFile = {
				path: mdWithoutBody,
				extension: ".md",
				filename: "without-body.md",
			};

			const resultWithBody = await markdownExtractor.extract(
				fileWithBody,
				"test-cid",
			);
			const resultWithoutBody = await markdownExtractor.extract(
				fileWithoutBody,
				"test-cid",
			);

			expect(getMdMetadata(resultWithBody.metadata)?.hasBody).toBe(true);
			expect(getMdMetadata(resultWithoutBody.metadata)?.hasBody).toBe(false);
		});

		test("should track frontmatterFields in metadata", async () => {
			const mdPath = join(testDir, "fields.md");
			writeFileSync(
				mdPath,
				`---
title: Test
date: 2024-01-01
tags: [a, b]
custom_field: value
---
Content
`,
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "fields.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.frontmatterFields).toEqual([
				"title",
				"date",
				"tags",
				"custom_field",
			]);
		});

		test("should track extraction duration", async () => {
			const mdPath = join(testDir, "duration.md");
			writeFileSync(mdPath, "Content");

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "duration.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");

			expect(result.metadata?.durationMs).toBeDefined();
			expect(result.metadata!.durationMs).toBeGreaterThanOrEqual(0);
		});

		test("should handle empty file", async () => {
			const mdPath = join(testDir, "empty.md");
			writeFileSync(mdPath, "");

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "empty.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(result.source).toBe("markdown");
			expect(result.text).toBe("");
			expect(md?.wordCount).toBe(0);
			expect(md?.hasBody).toBe(false);
		});

		test("should extract noteType from frontmatter", async () => {
			const mdPath = join(testDir, "typed-note.md");
			writeFileSync(
				mdPath,
				`---
type: project
---
Project content
`,
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "typed-note.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.noteType).toBe("project");
		});
	});
});

describe("isMarkdownExtension", () => {
	test("should return true for supported extensions", () => {
		expect(isMarkdownExtension(".md")).toBe(true);
		expect(isMarkdownExtension(".markdown")).toBe(true);
		expect(isMarkdownExtension(".mdown")).toBe(true);
		expect(isMarkdownExtension(".mkd")).toBe(true);
	});

	test("should return true for uppercase extensions", () => {
		expect(isMarkdownExtension(".MD")).toBe(true);
		expect(isMarkdownExtension(".MARKDOWN")).toBe(true);
	});

	test("should return false for non-markdown extensions", () => {
		expect(isMarkdownExtension(".pdf")).toBe(false);
		expect(isMarkdownExtension(".png")).toBe(false);
		expect(isMarkdownExtension(".txt")).toBe(false);
		expect(isMarkdownExtension(".doc")).toBe(false);
	});
});

describe("MARKDOWN_EXTENSIONS", () => {
	test("should include common markdown formats", () => {
		expect(MARKDOWN_EXTENSIONS).toContain(".md");
		expect(MARKDOWN_EXTENSIONS).toContain(".markdown");
		expect(MARKDOWN_EXTENSIONS).toContain(".mdown");
		expect(MARKDOWN_EXTENSIONS).toContain(".mkd");
	});

	test("should have 4 extensions", () => {
		expect(MARKDOWN_EXTENSIONS.length).toBe(4);
	});
});

describe("createMarkdownInboxFile", () => {
	test("should create InboxFile from path", () => {
		const file = createMarkdownInboxFile("/vault/Inbox/note.md");

		expect(file.path).toBe("/vault/Inbox/note.md");
		expect(file.extension).toBe(".md");
		expect(file.filename).toBe("note.md");
	});

	test("should handle uppercase extensions", () => {
		const file = createMarkdownInboxFile("/vault/Inbox/NOTE.MD");

		expect(file.extension).toBe(".md");
		expect(file.filename).toBe("NOTE.MD");
	});

	test("should handle nested paths", () => {
		const file = createMarkdownInboxFile(
			"/vault/00 Inbox/2024/12/meeting-notes.md",
		);

		expect(file.path).toBe("/vault/00 Inbox/2024/12/meeting-notes.md");
		expect(file.extension).toBe(".md");
		expect(file.filename).toBe("meeting-notes.md");
	});
});

describe("extractFrontmatterOnly", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `frontmatter-only-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("should extract frontmatter from file", async () => {
		const mdPath = join(testDir, "test.md");
		writeFileSync(
			mdPath,
			`---
title: Test Title
tags:
  - a
  - b
---
Body content
`,
		);

		const attributes = await extractFrontmatterOnly(mdPath);

		expect(attributes.title).toBe("Test Title");
		expect(attributes.tags).toEqual(["a", "b"]);
	});

	test("should return empty object for file without frontmatter", async () => {
		const mdPath = join(testDir, "no-fm.md");
		writeFileSync(mdPath, "Just content");

		const attributes = await extractFrontmatterOnly(mdPath);

		expect(attributes).toEqual({});
	});
});

describe("bug fixes", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `markdown-bugfix-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("Windows line endings (CRLF)", () => {
		test("should handle Windows line endings in frontmatter", async () => {
			const mdPath = join(testDir, "windows-crlf.md");
			// Write file with explicit \r\n line endings
			writeFileSync(
				mdPath,
				"---\r\ntitle: Windows Note\r\ntags:\r\n  - test\r\n---\r\n# Content\r\n\r\nBody text.\r\n",
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "windows-crlf.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.title).toBe("Windows Note");
			expect(md?.tags).toEqual(["test"]);
			expect(result.text).toContain("Body text.");
		});

		test("should handle mixed line endings", async () => {
			const mdPath = join(testDir, "mixed-endings.md");
			// Mix of \r\n and \n
			writeFileSync(
				mdPath,
				"---\r\ntitle: Mixed\n---\nContent\r\nMore content\n",
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "mixed-endings.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.title).toBe("Mixed");
			expect(result.text).toContain("Content");
			expect(result.text).toContain("More content");
		});
	});

	describe("H1 extraction from code blocks", () => {
		test("should NOT extract H1 from inside fenced code block", async () => {
			const mdPath = join(testDir, "h1-in-code.md");
			writeFileSync(
				mdPath,
				`---
tags: [test]
---
Some intro text.

\`\`\`markdown
# This is NOT a title
It's example code.
\`\`\`

# Real Title

More content.
`,
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "h1-in-code.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			// Should extract "Real Title", not "This is NOT a title"
			expect(md?.title).toBe("Real Title");
		});

		test("should extract H1 when no code blocks present", async () => {
			const mdPath = join(testDir, "no-code-blocks.md");
			writeFileSync(mdPath, "# First Title\n\nContent here.");

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "no-code-blocks.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.title).toBe("First Title");
		});

		test("should handle multiple code blocks", async () => {
			const mdPath = join(testDir, "multiple-code-blocks.md");
			writeFileSync(
				mdPath,
				`\`\`\`
# Fake Title 1
\`\`\`

\`\`\`python
# Fake Title 2
\`\`\`

# Actual Title

\`\`\`
# Another fake
\`\`\`
`,
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "multiple-code-blocks.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.title).toBe("Actual Title");
		});
	});

	describe("tag extraction", () => {
		test("should NOT split tags on spaces (only commas)", async () => {
			const mdPath = join(testDir, "spaced-tags.md");
			writeFileSync(
				mdPath,
				`---
tags: multi word tag, another tag
---
Content
`,
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "spaced-tags.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			// Should preserve "multi word tag" as a single tag
			expect(md?.tags).toEqual(["multi word tag", "another tag"]);
		});

		test("should handle tags with leading/trailing whitespace", async () => {
			const mdPath = join(testDir, "whitespace-tags.md");
			writeFileSync(
				mdPath,
				`---
tags: "  tag1  ,  tag2  ,  tag3  "
---
Content
`,
			);

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "whitespace-tags.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			// Should trim whitespace from each tag
			expect(md?.tags).toEqual(["tag1", "tag2", "tag3"]);
		});
	});

	describe("file read validation", () => {
		test("should throw descriptive error for non-existent file", async () => {
			const file: InboxFile = {
				path: join(testDir, "does-not-exist.md"),
				extension: ".md",
				filename: "does-not-exist.md",
			};

			await expect(markdownExtractor.extract(file, "test-cid")).rejects.toThrow(
				/Failed to read markdown file/,
			);
		});

		test("should include file path in error message", async () => {
			const nonExistentPath = join(testDir, "missing-file.md");
			const file: InboxFile = {
				path: nonExistentPath,
				extension: ".md",
				filename: "missing-file.md",
			};

			try {
				await markdownExtractor.extract(file, "test-cid");
				throw new Error("Should have thrown");
			} catch (error) {
				expect((error as Error).message).toContain(nonExistentPath);
			}
		});
	});

	describe("word count edge cases", () => {
		test("should handle text starting with whitespace", async () => {
			const mdPath = join(testDir, "leading-whitespace.md");
			writeFileSync(mdPath, "   one two three");

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "leading-whitespace.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			// Should correctly count 3 words, not 4 (with empty string from leading space)
			expect(md?.wordCount).toBe(3);
		});

		test("should handle text with multiple consecutive spaces", async () => {
			const mdPath = join(testDir, "multi-space.md");
			writeFileSync(mdPath, "one    two     three");

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "multi-space.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.wordCount).toBe(3);
		});

		test("should handle empty file", async () => {
			const mdPath = join(testDir, "empty.md");
			writeFileSync(mdPath, "");

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "empty.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.wordCount).toBe(0);
			expect(md?.hasBody).toBe(false);
		});

		test("should handle whitespace-only file", async () => {
			const mdPath = join(testDir, "whitespace-only.md");
			writeFileSync(mdPath, "   \n\n   \t   ");

			const file: InboxFile = {
				path: mdPath,
				extension: ".md",
				filename: "whitespace-only.md",
			};

			const result = await markdownExtractor.extract(file, "test-cid");
			const md = getMdMetadata(result.metadata);

			expect(md?.wordCount).toBe(0);
			expect(md?.hasBody).toBe(false);
		});
	});
});
