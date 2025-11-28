import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { DocumentProcessor } from "../lib/document-processor";

describe("DocumentProcessor", () => {
	const testDir = "/tmp/claude-docs-test-doc-processor";
	let processor: DocumentProcessor;

	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true });
		await mkdir(testDir, { recursive: true });
		processor = new DocumentProcessor(testDir);
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	describe("urlToFilename", () => {
		test("converts simple /docs/en/ URL to filename", () => {
			const url = "https://code.claude.com/docs/en/overview";
			expect(processor.urlToFilename(url)).toBe("overview.md");
		});

		test("converts /en/docs/claude-code/ URL to filename", () => {
			const url = "https://docs.anthropic.com/en/docs/claude-code/hooks";
			expect(processor.urlToFilename(url)).toBe("hooks.md");
		});

		test("handles trailing slashes", () => {
			const url = "https://code.claude.com/docs/en/plugins/";
			expect(processor.urlToFilename(url)).toBe("plugins.md");
		});

		test("returns unknown.md for non-matching URL", () => {
			const url = "https://example.com/something";
			expect(processor.urlToFilename(url)).toBe("unknown.md");
		});

		test("returns unknown.md for agent-sdk URLs", () => {
			const url = "https://docs.claude.com/en/docs/agent-sdk/overview";
			expect(processor.urlToFilename(url)).toBe("unknown.md");
		});
	});

	describe("isValidMarkdown", () => {
		test("returns true for valid markdown with headers and code blocks", () => {
			const content =
				"# Title\n\nSome content with [links](url) and:\n\n```js\ncode\n```";
			expect(processor.isValidMarkdown(content)).toBe(true);
		});

		test("returns true for markdown with lists and headers", () => {
			const content = "# Header\n\n- Item 1\n- Item 2\n\n## Subheader\n\nText";
			expect(processor.isValidMarkdown(content)).toBe(true);
		});

		test("returns false for HTML content", () => {
			const content = "<html><body>Not markdown</body></html>";
			expect(processor.isValidMarkdown(content)).toBe(false);
		});

		test("returns false for short content", () => {
			expect(processor.isValidMarkdown("# Hi")).toBe(false);
		});

		test("returns false for plain text without markdown indicators", () => {
			const content =
				"This is just plain text without any markdown formatting. ".repeat(10);
			expect(processor.isValidMarkdown(content)).toBe(false);
		});
	});

	describe("calculateSha256", () => {
		test("calculates correct SHA256 hash", () => {
			const content = "Hello, World!";
			const hash = processor.calculateSha256(content);
			expect(hash).toBe(
				"dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f",
			);
		});

		test("produces different hashes for different content", () => {
			const hash1 = processor.calculateSha256("content1");
			const hash2 = processor.calculateSha256("content2");
			expect(hash1).not.toBe(hash2);
		});

		test("produces same hash for identical content", () => {
			const content = "test content";
			const hash1 = processor.calculateSha256(content);
			const hash2 = processor.calculateSha256(content);
			expect(hash1).toBe(hash2);
		});
	});

	describe("saveDocument", () => {
		test("saves document to correct filename", async () => {
			const url = "https://code.claude.com/docs/en/hooks";
			const content = "# Hooks\n\nDocumentation content";
			const filename = "hooks.md";

			await processor.saveDocument(url, content, filename);

			const savedContent = await readFile(join(testDir, filename), "utf-8");
			expect(savedContent).toBe(content);
		});

		test("overwrites existing file", async () => {
			const url = "https://code.claude.com/docs/en/hooks";
			const filename = "hooks.md";

			await processor.saveDocument(url, "old content", filename);
			await processor.saveDocument(url, "new content", filename);

			const savedContent = await readFile(join(testDir, filename), "utf-8");
			expect(savedContent).toBe("new content");
		});

		test("throws error for path traversal attempts", async () => {
			const url = "https://code.claude.com/docs/en/../../etc/passwd";
			const content = "malicious";
			const filename = "../../etc/passwd";

			await expect(
				processor.saveDocument(url, content, filename),
			).rejects.toThrow(/path traversal/i);
		});

		test("handles filenames with subdirectories safely", async () => {
			const url = "https://code.claude.com/docs/en/sdk/guide";
			const content = "# SDK Guide";
			const filename = "sdk_guide.md"; // Not sdk/guide.md

			await processor.saveDocument(url, content, filename);

			const savedContent = await readFile(join(testDir, filename), "utf-8");
			expect(savedContent).toBe(content);
		});
	});

	describe("convertHtmlToMarkdown", () => {
		test("converts HTML to Markdown", () => {
			const html =
				"<html><body><h1>Test Title</h1><p>Some paragraph text.</p></body></html>";
			const markdown = processor.convertHtmlToMarkdown(html);

			// MarkdownConverter outputs setext-style headers (underlined with =) for h1/h2
			expect(markdown).toContain("Test Title");
			expect(markdown).toContain("Some paragraph text.");
			expect(markdown).not.toContain("<html>");
			expect(markdown).not.toContain("<body>");
			expect(markdown).not.toContain("<h1>");
			expect(markdown).not.toContain("<p>");
		});

		test("handles empty HTML input", () => {
			const markdown = processor.convertHtmlToMarkdown("");
			expect(markdown).toBe("");
		});

		test("extracts main content from HTML", () => {
			const html = `
        <html>
          <head><title>Page Title</title></head>
          <body>
            <nav>Navigation</nav>
            <header>Header content</header>
            <main>
              <h1>Main Content</h1>
              <p>This is the main content.</p>
            </main>
            <footer>Footer content</footer>
          </body>
        </html>
      `;
			const markdown = processor.convertHtmlToMarkdown(html);

			expect(markdown).toContain("Main Content");
			expect(markdown).toContain("This is the main content.");
			expect(markdown).not.toContain("Navigation");
			expect(markdown).not.toContain("Header content");
			expect(markdown).not.toContain("Footer content");
		});

		test("converts code blocks with language hints", () => {
			const html = `
        <html>
          <body>
            <main>
              <pre><code class="language-javascript">console.log("Hello");</code></pre>
            </main>
          </body>
        </html>
      `;
			const markdown = processor.convertHtmlToMarkdown(html);

			expect(markdown).toContain("```javascript");
			expect(markdown).toContain('console.log("Hello");');
			expect(markdown).toContain("```");
		});

		test("converts lists correctly", () => {
			const html = `
        <html>
          <body>
            <main>
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
            </main>
          </body>
        </html>
      `;
			const markdown = processor.convertHtmlToMarkdown(html);

			// MarkdownConverter uses - for bullet lists
			expect(markdown).toContain("- Item 1");
			expect(markdown).toContain("- Item 2");
		});

		test("converts links correctly", () => {
			const html = `
        <html>
          <body>
            <main>
              <p>Check out <a href="https://example.com">this link</a>.</p>
            </main>
          </body>
        </html>
      `;
			const markdown = processor.convertHtmlToMarkdown(html);

			expect(markdown).toContain("[this link](https://example.com)");
		});

		test("converted markdown is valid", () => {
			const html = `
        <html>
          <body>
            <main>
              <h1>Test Document</h1>
              <p>This is a paragraph with some content.</p>
              <ul>
                <li>List item 1</li>
                <li>List item 2</li>
              </ul>
              <pre><code>const x = 42;</code></pre>
            </main>
          </body>
        </html>
      `;
			const markdown = processor.convertHtmlToMarkdown(html);

			// The converted markdown should pass validation
			expect(processor.isValidMarkdown(markdown)).toBe(true);
		});
	});
});
