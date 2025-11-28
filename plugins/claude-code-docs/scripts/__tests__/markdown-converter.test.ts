import { describe, expect, test } from "bun:test";

import { MarkdownConverter } from "../lib/markdown-converter";

describe("MarkdownConverter", () => {
	describe("extractMainContent", () => {
		test("extracts content from main tag and removes navigation", () => {
			const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code Documentation</title>
    <script>
        // Analytics tracking
        window.analytics = { track: () => {} };
    </script>
    <style>
        .nav { display: flex; }
        .main { max-width: 1200px; }
    </style>
</head>
<body>
    <nav class="top-nav">
        <a href="/">Home</a>
        <a href="/docs">Docs</a>
        <a href="/api">API</a>
    </nav>
    <header class="site-header">
        <h1>Claude Code</h1>
        <div class="search-box"></div>
    </header>
    <main>
        <article>
            <h1>Getting Started with Claude Code</h1>
            <p>Claude Code is a powerful CLI tool for AI-assisted development.</p>
            <h2>Installation</h2>
            <p>Install Claude Code using npm:</p>
            <pre><code class="language-bash">npm install -g @anthropic-ai/claude-code</code></pre>
            <h2>Configuration</h2>
            <p>Configure your API key:</p>
            <pre><code class="language-bash">claude-code config set ANTHROPIC_API_KEY=your-key</code></pre>
        </article>
    </main>
    <footer class="site-footer">
        <p>&copy; 2024 Anthropic. All rights reserved.</p>
        <nav class="footer-nav">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
        </nav>
    </footer>
    <script src="/bundle.js"></script>
    <script>
        // Initialize app
        app.init();
    </script>
</body>
</html>
      `;

			const converter = new MarkdownConverter();
			const result = converter.extractMainContent(html);

			// Should include main content
			expect(result).toContain("Getting Started with Claude Code");
			expect(result).toContain("Claude Code is a powerful CLI tool");
			expect(result).toContain("npm install -g @anthropic-ai/claude-code");
			expect(result).toContain(
				"claude-code config set ANTHROPIC_API_KEY=your-key",
			);

			// Should NOT include navigation
			expect(result).not.toContain("<nav");
			expect(result).not.toContain("top-nav");

			// Should NOT include header
			expect(result).not.toContain("<header");
			expect(result).not.toContain("site-header");
			expect(result).not.toContain("search-box");

			// Should NOT include footer
			expect(result).not.toContain("<footer");
			expect(result).not.toContain("&copy; 2024 Anthropic");
			expect(result).not.toContain("footer-nav");

			// Should NOT include scripts or styles
			expect(result).not.toContain("<script");
			expect(result).not.toContain("window.analytics");
			expect(result).not.toContain("app.init()");
			expect(result).not.toContain("<style");
			expect(result).not.toContain(".nav { display: flex; }");
		});

		test("extracts content from article tag when main is not present", () => {
			const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Documentation Page</title>
</head>
<body>
    <nav>
        <ul>
            <li><a href="/docs">Docs</a></li>
            <li><a href="/guides">Guides</a></li>
        </ul>
    </nav>
    <article class="documentation">
        <h1>API Reference</h1>
        <p>This page describes the API endpoints.</p>
        <h2>Authentication</h2>
        <p>Use bearer token authentication:</p>
        <pre><code>Authorization: Bearer YOUR_TOKEN</code></pre>
    </article>
    <footer>
        <p>Contact us</p>
    </footer>
</body>
</html>
      `;

			const converter = new MarkdownConverter();
			const result = converter.extractMainContent(html);

			// Should include article content
			expect(result).toContain("API Reference");
			expect(result).toContain("This page describes the API endpoints");
			expect(result).toContain("Authorization: Bearer YOUR_TOKEN");

			// Should NOT include nav or footer
			expect(result).not.toContain("<nav");
			expect(result).not.toContain("Guides");
			expect(result).not.toContain("<footer");
			expect(result).not.toContain("Contact us");
		});

		test("preserves code blocks with proper formatting", () => {
			const html = `
<!DOCTYPE html>
<html>
<body>
    <nav><a href="/">Home</a></nav>
    <main>
        <h1>Code Examples</h1>
        <p>Here's how to use the API:</p>
        <pre><code class="language-typescript">import { Claude } from '@anthropic-ai/claude-code'

const client = new Claude({
  apiKey: process.env.ANTHROPIC_API_KEY
})

async function main() {
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Hello, Claude!' }
    ]
  })

  console.log(response.content)
}</code></pre>
        <p>You can also use the CLI:</p>
        <pre><code class="language-bash"># Start an interactive session
claude-code chat

# Run a single command
claude-code run "explain this code" --file app.ts</code></pre>
    </main>
    <footer>Footer content</footer>
</body>
</html>
      `;

			const converter = new MarkdownConverter();
			const result = converter.extractMainContent(html);

			// Should preserve code blocks
			expect(result).toContain("import { Claude } from");
			expect(result).toContain("const client = new Claude");
			expect(result).toContain("process.env.ANTHROPIC_API_KEY");
			expect(result).toContain("claude-code chat");
			expect(result).toContain("claude-code run");
			expect(result).toContain("--file app.ts");

			// Should preserve code structure (indentation matters)
			expect(result).toContain("async function main()");
			expect(result).toContain("console.log(response.content)");

			// Code block tags should be preserved
			expect(result).toContain("<pre>");
			expect(result).toContain("<code");
			expect(result).toContain("</code>");
			expect(result).toContain("</pre>");

			// Should NOT include nav or footer
			expect(result).not.toContain("<nav");
			expect(result).not.toContain("<footer");
		});

		test("handles complex nested structure with multiple nav and sidebar elements", () => {
			const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code Docs</title>
    <script src="/analytics.js"></script>
</head>
<body>
    <div class="app-container">
        <header class="top-header">
            <div class="logo">Claude Code</div>
            <nav class="top-nav">
                <a href="/docs">Documentation</a>
                <a href="/api">API</a>
            </nav>
        </header>
        <div class="content-wrapper">
            <aside class="sidebar">
                <nav class="sidebar-nav">
                    <ul>
                        <li><a href="/docs/intro">Introduction</a></li>
                        <li><a href="/docs/installation">Installation</a></li>
                        <li><a href="/docs/configuration">Configuration</a></li>
                        <li><a href="/docs/usage">Usage</a></li>
                    </ul>
                </nav>
            </aside>
            <main class="main-content">
                <article>
                    <h1>Introduction to Claude Code</h1>
                    <p>Claude Code is an AI-powered development assistant.</p>

                    <h2>Key Features</h2>
                    <ul>
                        <li>Intelligent code generation</li>
                        <li>Context-aware suggestions</li>
                        <li>Multi-file operations</li>
                    </ul>

                    <h2>Quick Start</h2>
                    <pre><code class="language-bash">npx @anthropic-ai/claude-code init</code></pre>

                    <nav class="page-nav">
                        <a href="#features">Features</a>
                        <a href="#quickstart">Quick Start</a>
                    </nav>
                </article>
            </main>
            <aside class="table-of-contents">
                <nav>
                    <h3>On this page</h3>
                    <ul>
                        <li><a href="#introduction">Introduction</a></li>
                        <li><a href="#features">Features</a></li>
                        <li><a href="#quickstart">Quick Start</a></li>
                    </ul>
                </nav>
            </aside>
        </div>
        <footer class="site-footer">
            <div class="footer-content">
                <p>&copy; 2024 Anthropic</p>
                <nav class="footer-links">
                    <a href="/privacy">Privacy Policy</a>
                    <a href="/terms">Terms of Service</a>
                </nav>
            </div>
        </footer>
    </div>
    <script>
        // Page initialization
        document.addEventListener('DOMContentLoaded', () => {
            initializeApp();
        });
    </script>
</body>
</html>
      `;

			const converter = new MarkdownConverter();
			const result = converter.extractMainContent(html);

			// Should include main content
			expect(result).toContain("Introduction to Claude Code");
			expect(result).toContain(
				"Claude Code is an AI-powered development assistant",
			);
			expect(result).toContain("Intelligent code generation");
			expect(result).toContain("Context-aware suggestions");
			expect(result).toContain("npx @anthropic-ai/claude-code init");

			// Should NOT include any navigation elements
			expect(result).not.toContain("top-nav");
			expect(result).not.toContain("sidebar-nav");
			expect(result).not.toContain("page-nav");
			expect(result).not.toContain("table-of-contents");
			expect(result).not.toContain("On this page");

			// Should NOT include header or footer
			expect(result).not.toContain("<header");
			expect(result).not.toContain("top-header");
			expect(result).not.toContain("<footer");
			expect(result).not.toContain("&copy; 2024 Anthropic");
			expect(result).not.toContain("Privacy Policy");

			// Should NOT include scripts
			expect(result).not.toContain("<script");
			expect(result).not.toContain("initializeApp()");
			expect(result).not.toContain("DOMContentLoaded");

			// Should NOT include aside elements
			expect(result).not.toContain("<aside");
		});

		test("handles missing main tag gracefully and falls back to body", () => {
			const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Simple Page</title>
</head>
<body>
    <h1>Welcome to Claude Code</h1>
    <p>This page has no main tag.</p>
    <p>But it should still extract content.</p>
    <pre><code>console.log('Hello, World!')</code></pre>
</body>
</html>
      `;

			const converter = new MarkdownConverter();
			const result = converter.extractMainContent(html);

			// Should still extract body content when no main/article tag exists
			expect(result).toContain("Welcome to Claude Code");
			expect(result).toContain("This page has no main tag");
			expect(result).toContain("But it should still extract content");
			expect(result).toContain("console.log('Hello, World!')");

			// Result should be a non-empty string
			expect(result.length).toBeGreaterThan(0);
		});

		test("removes inline scripts and styles within main content", () => {
			const html = `
<!DOCTYPE html>
<html>
<body>
    <main>
        <h1>Documentation with Inline Scripts</h1>
        <p>This is the first paragraph.</p>

        <script type="text/javascript">
            // This should be removed
            const tracking = {
                pageView: () => console.log('Page viewed'),
                event: (name) => console.log('Event:', name)
            };
            tracking.pageView();
        </script>

        <p>This is the second paragraph.</p>

        <style>
            .custom-style {
                color: red;
                font-size: 16px;
            }
            h1 { font-weight: bold; }
        </style>

        <h2>Code Example</h2>
        <pre><code class="language-js">// This code block should be preserved
function example() {
    return 'Hello, World!';
}</code></pre>

        <script>
            // Another inline script to remove
            window.addEventListener('load', () => {
                console.log('Page loaded');
            });
        </script>
    </main>
</body>
</html>
      `;

			const converter = new MarkdownConverter();
			const result = converter.extractMainContent(html);

			// Should include content paragraphs
			expect(result).toContain("Documentation with Inline Scripts");
			expect(result).toContain("This is the first paragraph");
			expect(result).toContain("This is the second paragraph");
			expect(result).toContain("Code Example");

			// Should preserve code blocks
			expect(result).toContain("function example()");
			expect(result).toContain("return 'Hello, World!'");

			// Should NOT include inline scripts
			expect(result).not.toContain("const tracking");
			expect(result).not.toContain("tracking.pageView()");
			expect(result).not.toContain("window.addEventListener");
			expect(result).not.toContain("Page loaded");

			// Should NOT include inline styles
			expect(result).not.toContain(".custom-style");
			expect(result).not.toContain("color: red");
			expect(result).not.toContain("font-size: 16px");
			expect(result).not.toContain("font-weight: bold");

			// Should not have script or style tags
			expect(result).not.toContain("<script");
			expect(result).not.toContain("</script>");
			expect(result).not.toContain("<style");
			expect(result).not.toContain("</style>");
		});

		test("preserves links, images, and formatting elements", () => {
			const html = `
<!DOCTYPE html>
<html>
<body>
    <nav>Navigation to remove</nav>
    <main>
        <article>
            <h1>Rich Content Example</h1>

            <p>Claude Code supports <strong>multiple file operations</strong> and
            <em>context-aware suggestions</em>.</p>

            <p>Learn more in our <a href="/docs/guides">comprehensive guides</a> or
            check out the <a href="https://github.com/anthropics/claude-code" target="_blank">GitHub repository</a>.</p>

            <img src="/images/architecture.png" alt="Claude Code Architecture" />

            <h2>Features</h2>
            <ul>
                <li><strong>Intelligent:</strong> Uses Claude 3.5 Sonnet</li>
                <li><strong>Fast:</strong> Optimized for performance</li>
                <li><strong>Safe:</strong> Sandboxed execution</li>
            </ul>

            <blockquote>
                <p>"Claude Code has transformed how I develop software." - Developer</p>
            </blockquote>

            <p>Visit <a href="https://claude.ai">claude.ai</a> to learn more.</p>
        </article>
    </main>
    <footer>Footer to remove</footer>
</body>
</html>
      `;

			const converter = new MarkdownConverter();
			const result = converter.extractMainContent(html);

			// Should preserve text formatting
			expect(result).toContain("<strong>multiple file operations</strong>");
			expect(result).toContain("<em>context-aware suggestions</em>");

			// Should preserve links
			expect(result).toContain('<a href="/docs/guides">');
			expect(result).toContain("comprehensive guides");
			expect(result).toContain("https://github.com/anthropics/claude-code");
			expect(result).toContain("https://claude.ai");

			// Should preserve images
			expect(result).toContain('<img src="/images/architecture.png"');
			expect(result).toContain('alt="Claude Code Architecture"');

			// Should preserve list structure
			expect(result).toContain("<ul>");
			expect(result).toContain("<li>");
			expect(result).toContain("Uses Claude 3.5 Sonnet");
			expect(result).toContain("Optimized for performance");

			// Should preserve blockquotes
			expect(result).toContain("<blockquote>");
			expect(result).toContain("Claude Code has transformed");

			// Should NOT include nav or footer
			expect(result).not.toContain("Navigation to remove");
			expect(result).not.toContain("Footer to remove");
		});

		test("returns empty string for completely empty or invalid HTML", () => {
			const converter = new MarkdownConverter();

			// Empty string
			expect(converter.extractMainContent("")).toBe("");

			// Whitespace only
			expect(converter.extractMainContent("   \n  \t  ")).toBe("");

			// Invalid HTML
			expect(converter.extractMainContent("<<>>")).toBe("");

			// HTML with no body
			expect(converter.extractMainContent("<html></html>")).toBe("");
		});
	});

	describe("cleanupMarkdown()", () => {
		test("rewrites internal /docs/en/ links to relative .md links", () => {
			const converter = new MarkdownConverter();

			const input = `# Plugins

Plugins let you extend Claude Code with custom functionality. Install plugins from [marketplaces](/docs/en/plugin-marketplaces) to add pre-built commands.

See [hooks](/docs/en/hooks) and [skills](/docs/en/skills) for more info.

Also check [hooks guide](/docs/en/hooks-guide#custom-hooks) with anchors.

External links like [GitHub](https://github.com) should not change.`;

			const expected = `# Plugins

Plugins let you extend Claude Code with custom functionality. Install plugins from [marketplaces](plugin-marketplaces.md) to add pre-built commands.

See [hooks](hooks.md) and [skills](skills.md) for more info.

Also check [hooks guide](hooks-guide.md#custom-hooks) with anchors.

External links like [GitHub](https://github.com) should not change.`;

			expect(converter.cleanupMarkdown(input)).toBe(expected);
		});

		test("removes excessive newlines (more than 2 consecutive → exactly 2)", () => {
			const converter = new MarkdownConverter();

			const input = `# Title



This has too many blank lines.




Between paragraphs.


Should be normalized.`;

			const expected = `# Title

This has too many blank lines.

Between paragraphs.

Should be normalized.`;

			expect(converter.cleanupMarkdown(input)).toBe(expected);
		});

		test("ensures proper spacing around headers (1 blank line before and after)", () => {
			const converter = new MarkdownConverter();

			const input = `# Main Title

Some content here.
## Section Header

This should have proper spacing.
### Subsection


Another paragraph.`;

			const expected = `# Main Title

Some content here.

## Section Header

This should have proper spacing.

### Subsection

Another paragraph.`;

			expect(converter.cleanupMarkdown(input)).toBe(expected);
		});

		test("normalizes consistent list formatting", () => {
			const converter = new MarkdownConverter();

			const input = `# List Examples

-Item without space
- Proper item
  -  Nested with extra spaces
  - Another nested

* Mixed bullet
  *  Bad spacing
  * Good spacing

1.Numbered without space
2. Proper numbered
   3.  Extra spaces`;

			const expected = `# List Examples

- Item without space
- Proper item
  - Nested with extra spaces
  - Another nested

* Mixed bullet
  * Bad spacing
  * Good spacing

1. Numbered without space
2. Proper numbered
   3. Extra spaces`;

			expect(converter.cleanupMarkdown(input).trim()).toBe(expected.trim());
		});

		test("removes HTML artifacts (comments and stray tags)", () => {
			const converter = new MarkdownConverter();

			const input = `# Documentation

<!-- This is a comment that should be removed -->

This is content with <!-- inline comment --> text.

<div class="wrapper">
Some markdown content here.
</div>

<!-- Multi-line
     comment
     to remove -->

More content with <span>inline tags</span> to clean.

<script>alert('bad')</script>

Final paragraph.`;

			const expected = `# Documentation

This is content with  text.

Some markdown content here.

More content with inline tags to clean.

Final paragraph.`;

			expect(converter.cleanupMarkdown(input).trim()).toBe(expected.trim());
		});

		test("normalizes line endings (CRLF → LF)", () => {
			const converter = new MarkdownConverter();

			const input =
				"# Title\r\n\r\nParagraph with CRLF.\r\n\r\n## Section\r\nMore content.\r\n";

			const expected =
				"# Title\n\nParagraph with CRLF.\n\n## Section\nMore content.";

			expect(converter.cleanupMarkdown(input).trim()).toBe(expected.trim());
		});

		test("trims trailing whitespace from each line", () => {
			const converter = new MarkdownConverter();

			const input = `# Title

This line has trailing spaces.

- List item with spaces
- Another item

Code example:
\`\`\`js
const x = 1;
\`\`\`

End paragraph.     `;

			const expected = `# Title

This line has trailing spaces.

- List item with spaces
- Another item

Code example:
\`\`\`js
const x = 1;
\`\`\`

End paragraph.`;

			expect(converter.cleanupMarkdown(input).trim()).toBe(expected.trim());
		});

		test("fixes broken markdown syntax", () => {
			const converter = new MarkdownConverter();

			const input = `#Title without space

##Another header

###Third level

[Link without closing paren(https://example.com

[Valid link](https://example.com)

\`\`\`
Code block without language
\`\`\`

\`\`\`javascript
Proper code block
\`\`\`

**Bold without closing

*Italic without closing

**Proper bold**

*Proper italic*`;

			const expected = `# Title without space

## Another header

### Third level

[Link without closing paren](https://example.com)

[Valid link](https://example.com)

\`\`\`
Code block without language
\`\`\`

\`\`\`javascript
Proper code block
\`\`\`

**Bold without closing**

*Italic without closing*

**Proper bold**

*Proper italic*`;

			expect(converter.cleanupMarkdown(input).trim()).toBe(expected.trim());
		});

		test("handles complex real-world messy markdown", () => {
			const converter = new MarkdownConverter();

			const input = `#Getting Started


<!-- Navigation breadcrumb -->


##Overview



The Claude Code agent is a powerful tool.



###Installation

-Install via npm
  -  Run the command
  -Copy configuration

<!-- TODO: Add more details -->


\`\`\`bash
npm install @claude/agent
\`\`\`




##Configuration


Edit your config file:


\`\`\`json
{
  "setting": "value"
}
\`\`\`



<!-- End of doc -->`;

			const expected = `# Getting Started

## Overview

The Claude Code agent is a powerful tool.

### Installation

- Install via npm
  - Run the command
  - Copy configuration

\`\`\`bash
npm install @claude/agent
\`\`\`

## Configuration

Edit your config file:

\`\`\`json
{
  "setting": "value"
}
\`\`\``;

			expect(converter.cleanupMarkdown(input).trim()).toBe(expected.trim());
		});

		test("preserves intentional spacing in code blocks", () => {
			const converter = new MarkdownConverter();

			const input = `# Code Example



\`\`\`python
def example():
    # Intentional indentation


    if True:
        pass
\`\`\`



Regular content.`;

			const expected = `# Code Example

\`\`\`python
def example():
    # Intentional indentation


    if True:
        pass
\`\`\`

Regular content.`;

			expect(converter.cleanupMarkdown(input).trim()).toBe(expected.trim());
		});

		test("handles empty input gracefully", () => {
			const converter = new MarkdownConverter();

			expect(converter.cleanupMarkdown("")).toBe("");
		});

		test("handles input with only whitespace", () => {
			const converter = new MarkdownConverter();

			const input = "   \n\n   \n   \n\n\n   ";

			expect(converter.cleanupMarkdown(input).trim()).toBe("");
		});
	});

	describe("convertToMarkdown()", () => {
		test("converts h1-h6 headings to markdown headers", () => {
			const html = `
        <h1>Main Title</h1>
        <h2>Subtitle</h2>
        <h3>Section</h3>
        <h4>Subsection</h4>
        <h5>Minor Heading</h5>
        <h6>Smallest Heading</h6>
      `;

			const expected = `Main Title
==========

Subtitle
--------

### Section

#### Subsection

##### Minor Heading

###### Smallest Heading`;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("converts anchor links to markdown links", () => {
			const html = `
        <p>Check out the <a href="https://docs.claude.com/guide">documentation guide</a> for more info.</p>
        <p>Visit <a href="/docs/api">API docs</a> or <a href="#section">jump to section</a>.</p>
      `;

			const expected = `Check out the [documentation guide](https://docs.claude.com/guide) for more info.

Visit [API docs](/docs/api) or [jump to section](#section).`;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("converts code blocks with language syntax", () => {
			const html = `
        <pre><code class="language-javascript">function hello() {
  console.log("Hello, world!");
}</code></pre>
        <pre><code class="language-python">def greet():
    print("Hello, world!")
</code></pre>
      `;

			const expected = `\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`

\`\`\`python
def greet():
    print("Hello, world!")
\`\`\``;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("converts code blocks without language class", () => {
			const html = `
        <pre><code>npm install turndown
bun add turndown</code></pre>
      `;

			const expected = `\`\`\`
npm install turndown
bun add turndown
\`\`\``;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("converts inline code to backticks", () => {
			const html = `
        <p>Use the <code>convertToMarkdown()</code> method to convert HTML.</p>
        <p>Set <code>skipValidation: true</code> in the config object.</p>
      `;

			const expected = `Use the \`convertToMarkdown()\` method to convert HTML.

Set \`skipValidation: true\` in the config object.`;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("converts ordered lists to numbered markdown", () => {
			const html = `
        <ol>
          <li>First step</li>
          <li>Second step</li>
          <li>Third step</li>
        </ol>
      `;

			const expected = `1.  First step
2.  Second step
3.  Third step`;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("converts unordered lists to dash markdown", () => {
			const html = `
        <ul>
          <li>First item</li>
          <li>Second item</li>
          <li>Third item</li>
        </ul>
      `;

			const expected = `-   First item
-   Second item
-   Third item`;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("converts nested lists correctly", () => {
			const html = `
        <ul>
          <li>Parent item
            <ul>
              <li>Child item 1</li>
              <li>Child item 2</li>
            </ul>
          </li>
          <li>Another parent</li>
        </ul>
      `;

			const expected = `-   Parent item
    -   Child item 1
    -   Child item 2
-   Another parent`;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("converts bold and italic text", () => {
			const html = `
        <p>This is <strong>bold text</strong> and this is <em>italic text</em>.</p>
        <p>You can also use <b>b tags</b> and <i>i tags</i>.</p>
        <p>Even <strong><em>bold and italic</em></strong> together.</p>
      `;

			const expected = `This is **bold text** and this is *italic text*.

You can also use **b tags** and *i tags*.

Even ***bold and italic*** together.`;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("converts tables to markdown tables", () => {
			const html = `
        <table>
          <thead>
            <tr>
              <th>Command</th>
              <th>Description</th>
              <th>Example</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>fetch()</code></td>
              <td>Fetches documentation</td>
              <td><code>await fetcher.fetch()</code></td>
            </tr>
            <tr>
              <td><code>convert()</code></td>
              <td>Converts HTML to Markdown</td>
              <td><code>converter.convert(html)</code></td>
            </tr>
          </tbody>
        </table>
      `;

			const expected = `| Command | Description | Example |
| --- | --- | --- |
| \`fetch()\` | Fetches documentation | \`await fetcher.fetch()\` |
| \`convert()\` | Converts HTML to Markdown | \`converter.convert(html)\` |`;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("handles complex nested HTML structures", () => {
			const html = `
        <div class="documentation">
          <h1>Getting Started</h1>
          <p>Welcome to the <strong>Claude Code</strong> documentation.</p>
          <h2>Installation</h2>
          <p>Install using your preferred package manager:</p>
          <pre><code class="language-bash">npm install @claude/code
# or
bun add @claude/code</code></pre>
          <h2>Quick Start</h2>
          <ol>
            <li>Import the library</li>
            <li>Create an instance</li>
            <li>Start coding!</li>
          </ol>
          <p>See the <a href="/docs/api">API documentation</a> for details.</p>
        </div>
      `;

			const expected = `Getting Started
===============

Welcome to the **Claude Code** documentation.

Installation
------------

Install using your preferred package manager:

\`\`\`bash
npm install @claude/code
# or
bun add @claude/code
\`\`\`

Quick Start
-----------

1.  Import the library
2.  Create an instance
3.  Start coding!

See the [API documentation](/docs/api) for details.`;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("handles blockquotes", () => {
			const html = `
        <blockquote>
          <p>This is a quote from the documentation.</p>
          <p>It can span multiple paragraphs.</p>
        </blockquote>
      `;

			const expected = `> This is a quote from the documentation.
>
> It can span multiple paragraphs.`;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("handles horizontal rules", () => {
			const html = `
        <p>Section 1</p>
        <hr>
        <p>Section 2</p>
      `;

			const expected = `Section 1

* * *

Section 2`;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("preserves line breaks in code blocks", () => {
			const html = `
        <pre><code class="language-typescript">interface Config {
  baseUrl: string;
  timeout?: number;
}

const config: Config = {
  baseUrl: "https://api.example.com",
  timeout: 5000
};</code></pre>
      `;

			const expected = `\`\`\`typescript
interface Config {
  baseUrl: string;
  timeout?: number;
}

const config: Config = {
  baseUrl: "https://api.example.com",
  timeout: 5000
};
\`\`\``;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("strips unwanted HTML attributes and classes", () => {
			const html = `
        <div class="container" id="main" data-test="value">
          <p class="text-lg font-bold" style="color: red;">Hello</p>
          <a href="/docs" class="link-primary" target="_blank">Link</a>
        </div>
      `;

			const expected = `Hello

[Link](/docs)`;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});

		test("handles empty or whitespace-only content", () => {
			const converter = new MarkdownConverter();

			expect(converter.convertToMarkdown("")).toBe("");
			expect(converter.convertToMarkdown("   ")).toBe("");
			expect(converter.convertToMarkdown("\n\n\n")).toBe("");
		});

		test("handles real-world documentation structure", () => {
			const html = `
        <article>
          <h1>API Reference</h1>
          <p>The <code>ClaudeDocsFetcher</code> class provides methods for fetching documentation.</p>

          <h2>Constructor</h2>
          <pre><code class="language-typescript">new ClaudeDocsFetcher(outputDir: string, options?: FetcherOptions)</code></pre>

          <h3>Parameters</h3>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>outputDir</code></td>
                <td>string</td>
                <td>Directory to save documentation files</td>
              </tr>
              <tr>
                <td><code>options</code></td>
                <td>FetcherOptions</td>
                <td>Optional configuration object</td>
              </tr>
            </tbody>
          </table>

          <h2>Methods</h2>
          <h3>fetch()</h3>
          <p>Fetches all documentation pages from the sitemap.</p>

          <p><strong>Returns:</strong> <code>Promise&lt;FetchResult&gt;</code></p>

          <p>Example usage:</p>
          <pre><code class="language-typescript">const fetcher = new ClaudeDocsFetcher('./docs');
const result = await fetcher.fetch();
console.log(\`Fetched \${result.fetched} documents\`);</code></pre>
        </article>
      `;

			const expected = `API Reference
=============

The \`ClaudeDocsFetcher\` class provides methods for fetching documentation.

Constructor
-----------

\`\`\`typescript
new ClaudeDocsFetcher(outputDir: string, options?: FetcherOptions)
\`\`\`

### Parameters

| Name | Type | Description |
| --- | --- | --- |
| \`outputDir\` | string | Directory to save documentation files |
| \`options\` | FetcherOptions | Optional configuration object |

Methods
-------

### fetch()

Fetches all documentation pages from the sitemap.

**Returns:** \`Promise<FetchResult>\`

Example usage:

\`\`\`typescript
const fetcher = new ClaudeDocsFetcher('./docs');
const result = await fetcher.fetch();
console.log(\`Fetched \${result.fetched} documents\`);
\`\`\``;

			const converter = new MarkdownConverter();
			const result = converter.convertToMarkdown(html);
			expect(result.trim()).toBe(expected);
		});
	});

	describe("convert() - Full Pipeline Integration", () => {
		test("converts simple documentation page with headers, paragraphs, and links", () => {
			const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code - Getting Started</title>
    <script src="/analytics.js"></script>
    <style>
        body { font-family: sans-serif; }
        .container { max-width: 1200px; }
    </style>
</head>
<body>
    <nav class="top-nav">
        <a href="/">Home</a>
        <a href="/docs">Docs</a>
        <a href="/api">API Reference</a>
    </nav>
    <header class="site-header">
        <h1>Claude Code Documentation</h1>
        <div class="search-box"></div>
    </header>
    <main>
        <article>
            <h1>Getting Started with Claude Code</h1>
            <p>Claude Code is a powerful AI-assisted development tool that helps you write, refactor, and debug code efficiently.</p>

            <h2>Why Use Claude Code?</h2>
            <p>Claude Code offers several key benefits:</p>
            <ul>
                <li>Intelligent code generation powered by Claude 3.5 Sonnet</li>
                <li>Context-aware suggestions that understand your codebase</li>
                <li>Multi-file operations for large-scale refactoring</li>
            </ul>

            <h2>Next Steps</h2>
            <p>Ready to get started? Check out our <a href="/docs/installation">installation guide</a> or explore the <a href="/docs/tutorials">tutorials</a>.</p>
        </article>
    </main>
    <footer class="site-footer">
        <p>&copy; 2024 Anthropic. All rights reserved.</p>
        <nav class="footer-nav">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
        </nav>
    </footer>
    <script>
        // Initialize app
        window.app.init();
    </script>
</body>
</html>
      `;

			const expected = `# Getting Started with Claude Code

Claude Code is a powerful AI-assisted development tool that helps you write, refactor, and debug code efficiently.

## Why Use Claude Code?

Claude Code offers several key benefits:

- Intelligent code generation powered by Claude 3.5 Sonnet
- Context-aware suggestions that understand your codebase
- Multi-file operations for large-scale refactoring

## Next Steps

Ready to get started? Check out our [installation guide](/docs/installation) or explore the [tutorials](/docs/tutorials).`;

			const converter = new MarkdownConverter();
			const result = converter.convert(html);

			// Verify clean markdown output
			expect(result.trim()).toBe(expected);

			// Should NOT contain any HTML tags, scripts, or navigation
			expect(result).not.toContain("<nav");
			expect(result).not.toContain("<footer");
			expect(result).not.toContain("<script");
			expect(result).not.toContain("<style");
			expect(result).not.toContain("site-header");
			expect(result).not.toContain("&copy;");
		});

		test("converts documentation with code examples and proper formatting", () => {
			const html = `
<!DOCTYPE html>
<html>
<head>
    <title>API Reference - Claude Code</title>
    <script>
        // Analytics
        window.analytics = { track: () => {} };
    </script>
</head>
<body>
    <nav>
        <ul>
            <li><a href="/docs">Documentation</a></li>
            <li><a href="/api">API</a></li>
        </ul>
    </nav>
    <main>
        <article>
            <h1>API Reference</h1>
            <p>The <code>ClaudeCodeClient</code> class provides the main interface for interacting with Claude Code.</p>

            <h2>Installation</h2>
            <p>Install Claude Code using npm or bun:</p>
            <pre><code class="language-bash">npm install -g @anthropic-ai/claude-code
# or
bun add -g @anthropic-ai/claude-code</code></pre>

            <h2>Basic Usage</h2>
            <p>Here's a simple example to get started:</p>
            <pre><code class="language-typescript">import { ClaudeCodeClient } from '@anthropic-ai/claude-code';

const client = new ClaudeCodeClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022'
});

async function generateCode() {
  const response = await client.generate({
    prompt: 'Create a React component for a todo list',
    context: ['./src/App.tsx', './src/types.ts']
  });

  console.log(response.code);
}</code></pre>

            <h2>Configuration</h2>
            <p>Configure your environment with the following options:</p>
            <ul>
                <li><strong>apiKey</strong> - Your Anthropic API key (required)</li>
                <li><strong>model</strong> - The Claude model to use (optional, defaults to claude-3-5-sonnet)</li>
                <li><strong>maxTokens</strong> - Maximum tokens for responses (optional)</li>
            </ul>

            <p>For more details, see the <a href="/docs/configuration">configuration guide</a>.</p>
        </article>
    </main>
    <footer>
        <p>Anthropic &copy; 2024</p>
    </footer>
    <script>window.init();</script>
</body>
</html>
      `;

			const expected = `# API Reference

The \`ClaudeCodeClient\` class provides the main interface for interacting with Claude Code.

## Installation

Install Claude Code using npm or bun:

\`\`\`bash
npm install -g @anthropic-ai/claude-code
# or
bun add -g @anthropic-ai/claude-code
\`\`\`

## Basic Usage

Here's a simple example to get started:

\`\`\`typescript
import { ClaudeCodeClient } from '@anthropic-ai/claude-code';

const client = new ClaudeCodeClient({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022'
});

async function generateCode() {
  const response = await client.generate({
    prompt: 'Create a React component for a todo list',
    context: ['./src/App.tsx', './src/types.ts']
  });

  console.log(response.code);
}
\`\`\`

## Configuration

Configure your environment with the following options:

- **apiKey** - Your Anthropic API key (required)
- **model** - The Claude model to use (optional, defaults to claude-3-5-sonnet)
- **maxTokens** - Maximum tokens for responses (optional)

For more details, see the [configuration guide](/docs/configuration).`;

			const converter = new MarkdownConverter();
			const result = converter.convert(html);

			// Verify structure
			expect(result.trim()).toBe(expected);

			// Should preserve code blocks with proper language tags
			expect(result).toContain("```bash");
			expect(result).toContain("```typescript");
			expect(result).toContain("npm install -g @anthropic-ai/claude-code");
			expect(result).toContain("import { ClaudeCodeClient }");
			expect(result).toContain("async function generateCode()");

			// Should preserve inline code
			expect(result).toContain("`ClaudeCodeClient`");
			expect(result).toContain("**apiKey**");
			expect(result).toContain("**model**");

			// Should NOT contain navigation or scripts
			expect(result).not.toContain("<nav");
			expect(result).not.toContain("<footer");
			expect(result).not.toContain("window.analytics");
			expect(result).not.toContain("window.init()");
		});

		test("converts documentation with tables and lists", () => {
			const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Command Reference</title>
</head>
<body>
    <nav class="sidebar">
        <a href="/commands">Commands</a>
        <a href="/api">API</a>
    </nav>
    <main>
        <article>
            <h1>Command Reference</h1>
            <p>Claude Code provides several commands for different tasks.</p>

            <h2>Available Commands</h2>
            <table>
                <thead>
                    <tr>
                        <th>Command</th>
                        <th>Description</th>
                        <th>Usage</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>init</code></td>
                        <td>Initialize a new project</td>
                        <td><code>claude-code init</code></td>
                    </tr>
                    <tr>
                        <td><code>generate</code></td>
                        <td>Generate code from prompt</td>
                        <td><code>claude-code generate &lt;prompt&gt;</code></td>
                    </tr>
                    <tr>
                        <td><code>refactor</code></td>
                        <td>Refactor existing code</td>
                        <td><code>claude-code refactor &lt;file&gt;</code></td>
                    </tr>
                    <tr>
                        <td><code>config</code></td>
                        <td>Manage configuration</td>
                        <td><code>claude-code config &lt;key&gt; &lt;value&gt;</code></td>
                    </tr>
                </tbody>
            </table>

            <h2>Common Options</h2>
            <p>All commands support the following options:</p>
            <ul>
                <li><code>--help</code> - Show help information</li>
                <li><code>--version</code> - Display version number</li>
                <li><code>--verbose</code> - Enable verbose output</li>
                <li><code>--quiet</code> - Suppress non-essential output</li>
            </ul>

            <h2>Examples</h2>
            <p>Here are some common usage patterns:</p>
            <ol>
                <li>Initialize a new TypeScript project</li>
                <li>Generate a React component</li>
                <li>Refactor a function with better error handling</li>
                <li>Update configuration settings</li>
            </ol>
        </article>
    </main>
    <footer>
        <nav>
            <a href="/help">Help</a>
            <a href="/support">Support</a>
        </nav>
    </footer>
</body>
</html>
      `;

			const expected = `# Command Reference

Claude Code provides several commands for different tasks.

## Available Commands

| Command | Description | Usage |
| --- | --- | --- |
| \`init\` | Initialize a new project | \`claude-code init\` |
| \`generate\` | Generate code from prompt | \`claude-code generate <prompt>\` |
| \`refactor\` | Refactor existing code | \`claude-code refactor <file>\` |
| \`config\` | Manage configuration | \`claude-code config <key> <value>\` |

## Common Options

All commands support the following options:

- \`--help\` - Show help information
- \`--version\` - Display version number
- \`--verbose\` - Enable verbose output
- \`--quiet\` - Suppress non-essential output

## Examples

Here are some common usage patterns:

1. Initialize a new TypeScript project
2. Generate a React component
3. Refactor a function with better error handling
4. Update configuration settings`;

			const converter = new MarkdownConverter();
			const result = converter.convert(html);

			// Verify structure
			expect(result.trim()).toBe(expected);

			// Should have properly formatted tables
			expect(result).toContain("| Command | Description | Usage |");
			expect(result).toContain("| --- | --- | --- |");
			expect(result).toContain("`init`");
			expect(result).toContain("`generate`");

			// Should have properly formatted lists
			expect(result).toContain("- `--help`");
			expect(result).toContain("1. Initialize a new TypeScript project");

			// Should NOT contain navigation
			expect(result).not.toContain("<nav");
			expect(result).not.toContain("<footer");
			expect(result).not.toContain("sidebar");
		});

		test("converts complex page with all elements combined", () => {
			const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complete Guide - Claude Code Documentation</title>
    <link rel="stylesheet" href="/styles/main.css">
    <script async src="https://www.googletagmanager.com/gtag/js"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'GA-TRACKING-ID');
    </script>
    <style>
        .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { max-width: 1200px; margin: 0 auto; }
    </style>
</head>
<body class="documentation-page">
    <div id="app">
        <header class="site-header">
            <div class="logo">
                <img src="/logo.svg" alt="Claude Code">
                <span>Claude Code</span>
            </div>
            <nav class="top-nav">
                <a href="/">Home</a>
                <a href="/docs" class="active">Documentation</a>
                <a href="/api">API</a>
                <a href="/community">Community</a>
            </nav>
            <div class="search">
                <input type="text" placeholder="Search documentation...">
            </div>
        </header>

        <div class="content-wrapper">
            <aside class="sidebar">
                <nav class="sidebar-nav">
                    <h3>Getting Started</h3>
                    <ul>
                        <li><a href="/docs/intro">Introduction</a></li>
                        <li><a href="/docs/installation">Installation</a></li>
                        <li><a href="/docs/quickstart" class="active">Quick Start</a></li>
                    </ul>
                    <h3>Guides</h3>
                    <ul>
                        <li><a href="/docs/guides/basics">Basics</a></li>
                        <li><a href="/docs/guides/advanced">Advanced Usage</a></li>
                    </ul>
                </nav>
            </aside>

            <main class="main-content">
                <article class="documentation">
                    <h1>Complete Guide to Claude Code</h1>
                    <p class="lead">A comprehensive guide to using Claude Code for AI-assisted development. Learn everything from basic setup to advanced techniques.</p>

                    <blockquote>
                        <p><strong>Note:</strong> This guide assumes you have <a href="/docs/installation">installed Claude Code</a> and have an active API key.</p>
                    </blockquote>

                    <h2>Table of Contents</h2>
                    <nav class="page-toc">
                        <ul>
                            <li><a href="#overview">Overview</a></li>
                            <li><a href="#installation">Installation</a></li>
                            <li><a href="#usage">Basic Usage</a></li>
                            <li><a href="#features">Key Features</a></li>
                        </ul>
                    </nav>

                    <h2 id="overview">Overview</h2>
                    <p>Claude Code is an <em>intelligent development assistant</em> powered by <strong>Claude 3.5 Sonnet</strong>. It helps developers:</p>
                    <ul>
                        <li>Write clean, maintainable code</li>
                        <li>Refactor legacy codebases</li>
                        <li>Debug complex issues</li>
                        <li>Generate comprehensive tests</li>
                    </ul>

                    <h2 id="installation">Installation</h2>
                    <p>Install Claude Code globally using your preferred package manager:</p>

                    <h3>Using npm</h3>
                    <pre><code class="language-bash">npm install -g @anthropic-ai/claude-code</code></pre>

                    <h3>Using bun</h3>
                    <pre><code class="language-bash">bun add -g @anthropic-ai/claude-code</code></pre>

                    <h2 id="usage">Basic Usage</h2>
                    <p>After installation, configure your API key:</p>
                    <pre><code class="language-bash">export ANTHROPIC_API_KEY="your-api-key-here"
claude-code init</code></pre>

                    <h3>Example: Generating a Component</h3>
                    <p>Generate a React component using the CLI:</p>
                    <pre><code class="language-typescript">import { ClaudeCode } from '@anthropic-ai/claude-code';

const client = new ClaudeCode({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function createComponent() {
  const result = await client.generate({
    prompt: 'Create a reusable Button component with TypeScript',
    outputPath: './src/components/Button.tsx'
  });

  console.log(\`Generated: \${result.filePath}\`);
}</code></pre>

                    <h2 id="features">Key Features</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Feature</th>
                                <th>Description</th>
                                <th>Availability</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Code Generation</td>
                                <td>Generate entire files or code snippets</td>
                                <td>All plans</td>
                            </tr>
                            <tr>
                                <td>Refactoring</td>
                                <td>Intelligent code restructuring</td>
                                <td>All plans</td>
                            </tr>
                            <tr>
                                <td>Multi-file Operations</td>
                                <td>Work across multiple files simultaneously</td>
                                <td>Pro & Enterprise</td>
                            </tr>
                            <tr>
                                <td>Custom Models</td>
                                <td>Fine-tune models for your codebase</td>
                                <td>Enterprise only</td>
                            </tr>
                        </tbody>
                    </table>

                    <hr>

                    <h2>Best Practices</h2>
                    <ol>
                        <li><strong>Provide Context</strong> - Include relevant files for better results</li>
                        <li><strong>Iterate</strong> - Refine prompts based on initial outputs</li>
                        <li><strong>Review</strong> - Always review generated code before committing</li>
                        <li><strong>Test</strong> - Run tests to verify generated code works correctly</li>
                    </ol>

                    <blockquote>
                        <p><em>"Claude Code has transformed our development workflow, reducing boilerplate time by 60%."</em></p>
                        <p>- Engineering Team at TechCorp</p>
                    </blockquote>

                    <h2>Next Steps</h2>
                    <p>Now that you understand the basics, explore these advanced topics:</p>
                    <ul>
                        <li><a href="/docs/guides/advanced">Advanced Usage Patterns</a></li>
                        <li><a href="/docs/api">Complete API Reference</a></li>
                        <li><a href="/docs/examples">Real-World Examples</a></li>
                        <li><a href="/docs/troubleshooting">Troubleshooting Guide</a></li>
                    </ul>
                </article>
            </main>

            <aside class="table-of-contents">
                <nav>
                    <h4>On this page</h4>
                    <ul>
                        <li><a href="#overview">Overview</a></li>
                        <li><a href="#installation">Installation</a></li>
                        <li><a href="#usage">Basic Usage</a></li>
                        <li><a href="#features">Key Features</a></li>
                    </ul>
                </nav>
            </aside>
        </div>

        <footer class="site-footer">
            <div class="footer-content">
                <div class="footer-section">
                    <h4>Documentation</h4>
                    <nav>
                        <a href="/docs">Getting Started</a>
                        <a href="/docs/api">API Reference</a>
                        <a href="/docs/guides">Guides</a>
                    </nav>
                </div>
                <div class="footer-section">
                    <h4>Community</h4>
                    <nav>
                        <a href="/community">Forum</a>
                        <a href="/discord">Discord</a>
                        <a href="https://github.com/anthropics/claude-code">GitHub</a>
                    </nav>
                </div>
                <div class="footer-section">
                    <h4>Legal</h4>
                    <nav>
                        <a href="/privacy">Privacy Policy</a>
                        <a href="/terms">Terms of Service</a>
                    </nav>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2024 Anthropic PBC. All rights reserved.</p>
            </div>
        </footer>
    </div>

    <script src="/bundle.js"></script>
    <script>
        // Initialize application
        document.addEventListener('DOMContentLoaded', function() {
            app.init();
            analytics.track('page_view', { page: 'documentation' });
        });
    </script>
</body>
</html>
      `;

			const expected = `# Complete Guide to Claude Code

A comprehensive guide to using Claude Code for AI-assisted development. Learn everything from basic setup to advanced techniques.

> **Note:** This guide assumes you have [installed Claude Code](/docs/installation) and have an active API key.

## Table of Contents

- Overview
- Installation
- Basic Usage
- Key Features

## Overview

Claude Code is an *intelligent development assistant* powered by **Claude 3.5 Sonnet**. It helps developers:

- Write clean, maintainable code
- Refactor legacy codebases
- Debug complex issues
- Generate comprehensive tests

## Installation

Install Claude Code globally using your preferred package manager:

### Using npm

\`\`\`bash
npm install -g @anthropic-ai/claude-code
\`\`\`

### Using bun

\`\`\`bash
bun add -g @anthropic-ai/claude-code
\`\`\`

## Basic Usage

After installation, configure your API key:

\`\`\`bash
export ANTHROPIC_API_KEY="your-api-key-here"
claude-code init
\`\`\`

### Example: Generating a Component

Generate a React component using the CLI:

\`\`\`typescript
import { ClaudeCode } from '@anthropic-ai/claude-code';

const client = new ClaudeCode({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function createComponent() {
  const result = await client.generate({
    prompt: 'Create a reusable Button component with TypeScript',
    outputPath: './src/components/Button.tsx'
  });

  console.log(\`Generated: \${result.filePath}\`);
}
\`\`\`

## Key Features

| Feature | Description | Availability |
| --- | --- | --- |
| Code Generation | Generate entire files or code snippets | All plans |
| Refactoring | Intelligent code restructuring | All plans |
| Multi-file Operations | Work across multiple files simultaneously | Pro & Enterprise |
| Custom Models | Fine-tune models for your codebase | Enterprise only |

* * *

## Best Practices

1. **Provide Context** - Include relevant files for better results
2. **Iterate** - Refine prompts based on initial outputs
3. **Review** - Always review generated code before committing
4. **Test** - Run tests to verify generated code works correctly

> *"Claude Code has transformed our development workflow, reducing boilerplate time by 60%."*
>
> - Engineering Team at TechCorp

## Next Steps

Now that you understand the basics, explore these advanced topics:

- [Advanced Usage Patterns](/docs/guides/advanced)
- [Complete API Reference](/docs/api)
- [Real-World Examples](/docs/examples)
- [Troubleshooting Guide](/docs/troubleshooting)`;

			const converter = new MarkdownConverter();
			const result = converter.convert(html);

			// Verify clean structure
			expect(result.trim()).toBe(expected);

			// Should have all markdown elements properly formatted
			expect(result).toContain("# Complete Guide to Claude Code");
			expect(result).toContain("## Overview");
			expect(result).toContain("### Using npm");
			expect(result).toContain("```bash");
			expect(result).toContain("```typescript");
			expect(result).toContain("| Feature | Description | Availability |");
			expect(result).toContain("> **Note:**");
			expect(result).toContain("* * *"); // Horizontal rule

			// Should preserve formatting
			expect(result).toContain("*intelligent development assistant*");
			expect(result).toContain("**Claude 3.5 Sonnet**");
			expect(result).toContain("**Provide Context**");

			// Should have working links
			expect(result).toContain("[installed Claude Code](/docs/installation)");
			expect(result).toContain(
				"[Advanced Usage Patterns](/docs/guides/advanced)",
			);

			// Should have lists
			expect(result).toContain("- Write clean, maintainable code");
			expect(result).toContain("1. **Provide Context**");

			// Should NOT contain any navigation, sidebars, headers, footers
			expect(result).not.toContain("<nav");
			expect(result).not.toContain("<aside");
			expect(result).not.toContain("<header");
			expect(result).not.toContain("<footer");
			expect(result).not.toContain("sidebar");
			expect(result).not.toContain("table-of-contents");
			expect(result).not.toContain("site-header");
			expect(result).not.toContain("site-footer");

			// Should NOT contain scripts, styles, or metadata
			expect(result).not.toContain("<script");
			expect(result).not.toContain("<style");
			expect(result).not.toContain("<meta");
			expect(result).not.toContain("<link");
			expect(result).not.toContain("gtag");
			expect(result).not.toContain("dataLayer");
			expect(result).not.toContain("bundle.js");

			// Should NOT contain HTML classes or IDs
			expect(result).not.toContain("class=");
			expect(result).not.toContain('id="app"');
			expect(result).not.toContain("&copy;");
		});
	});
});
