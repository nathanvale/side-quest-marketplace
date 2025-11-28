import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { ClaudeDocsFetcher } from "../fetcher";

describe("ClaudeDocsFetcher", () => {
	const testDir = "/tmp/claude-docs-test-fetcher";

	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true });
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("fetches and saves documentation on first run", async () => {
		const sampleSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://code.claude.com/docs/en/test1</loc></url>
  <url><loc>https://code.claude.com/docs/en/test2</loc></url>
</urlset>`;

		const sampleHtml = `
      <html>
        <body>
          <main>
            <h1>Test Doc</h1>
            <p>This is a test document with <a href="url">links</a> and code:</p>
            <pre><code>test</code></pre>
          </main>
        </body>
      </html>`;

		const mockFetch = mock((url: string) => {
			if (url.includes("sitemap.xml")) {
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve(sampleSitemap),
				});
			}
			return Promise.resolve({
				ok: true,
				text: () => Promise.resolve(sampleHtml),
			});
		});
		globalThis.fetch = mockFetch as never;

		const fetcher = new ClaudeDocsFetcher(testDir, {
			fetchOptions: {
				maxRetries: 1,
				baseDelay: 10,
				maxDelay: 100,
				rateLimit: 5,
			},
		});

		const result = await fetcher.fetch();

		expect(result.fetched).toBe(2);
		expect(result.skipped).toBe(0);
		expect(result.failed).toBe(0);
		expect(result.total).toBe(2);
		expect(result.errors).toHaveLength(0);

		// Verify manifest was created
		const manifestPath = join(testDir, "manifest.json");
		const manifestContent = await readFile(manifestPath, "utf-8");
		const manifest = JSON.parse(manifestContent);
		expect(manifest.files).toHaveLength(2);

		// Verify INDEX was created
		const indexPath = join(testDir, "INDEX.md");
		const indexContent = await readFile(indexPath, "utf-8");
		expect(indexContent).toContain("# Claude Code Documentation Index");
		expect(indexContent).toContain("[Test1](test1.md)");
		expect(indexContent).toContain("[Test2](test2.md)");

		// Verify docs were saved (should be converted to markdown)
		const doc1 = await readFile(join(testDir, "test1.md"), "utf-8");
		expect(doc1).toContain("Test Doc");
		expect(doc1).toContain("This is a test document with");
		expect(doc1).toContain("[links](url)");
		expect(doc1).not.toContain("<html>");
		expect(doc1).not.toContain("<body>");
	});

	test("skips unchanged files on second run", async () => {
		const sampleSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://code.claude.com/docs/en/test1</loc></url>
</urlset>`;

		const sampleHtml = `
      <html>
        <body>
          <main>
            <h1>Test Doc</h1>
            <p>This is a test document with <a href="url">links</a> and code:</p>
            <pre><code>test</code></pre>
          </main>
        </body>
      </html>`;

		const mockFetch = mock((url: string) => {
			if (url.includes("sitemap.xml")) {
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve(sampleSitemap),
				});
			}
			return Promise.resolve({
				ok: true,
				text: () => Promise.resolve(sampleHtml),
			});
		});
		globalThis.fetch = mockFetch as never;

		const fetcher = new ClaudeDocsFetcher(testDir, {
			fetchOptions: {
				maxRetries: 1,
				baseDelay: 10,
				maxDelay: 100,
				rateLimit: 5,
			},
		});

		// First run
		const result1 = await fetcher.fetch();
		expect(result1.fetched).toBe(1);

		// Second run (no changes)
		const result2 = await fetcher.fetch();
		expect(result2.fetched).toBe(0);
		expect(result2.skipped).toBe(1);
	});

	test("handles fetch failures gracefully", async () => {
		const sampleSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://code.claude.com/docs/en/test1</loc></url>
  <url><loc>https://code.claude.com/docs/en/test2</loc></url>
</urlset>`;

		const sampleHtml = `
      <html>
        <body>
          <main>
            <h1>Test Doc</h1>
            <p>This is a test document with <a href="url">links</a> and code:</p>
            <pre><code>test</code></pre>
          </main>
        </body>
      </html>`;

		const mockFetch = mock((url: string) => {
			if (url.includes("sitemap.xml")) {
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve(sampleSitemap),
				});
			}
			if (url.includes("test1")) {
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve(sampleHtml),
				});
			}
			// test2 fails
			return Promise.resolve({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			});
		});
		globalThis.fetch = mockFetch as never;

		const fetcher = new ClaudeDocsFetcher(testDir, {
			fetchOptions: {
				maxRetries: 1,
				baseDelay: 10,
				maxDelay: 100,
				rateLimit: 5,
			},
		});

		const result = await fetcher.fetch();

		expect(result.fetched).toBe(1);
		expect(result.failed).toBe(1);
		expect(result.total).toBe(2);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.url).toContain("test2");
	});

	test("validates markdown and skips invalid content", async () => {
		const sampleSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://code.claude.com/docs/en/valid</loc></url>
  <url><loc>https://code.claude.com/docs/en/invalid</loc></url>
</urlset>`;

		const validHtml = `
      <html>
        <body>
          <main>
            <h1>Valid Doc</h1>
            <p>This is valid with <a href="url">links</a> and code:</p>
            <pre><code>test</code></pre>
          </main>
        </body>
      </html>`;
		const invalidHtml = "Short";

		const mockFetch = mock((url: string) => {
			if (url.includes("sitemap.xml")) {
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve(sampleSitemap),
				});
			}
			if (url.includes("invalid")) {
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve(invalidHtml),
				});
			}
			if (url.includes("valid")) {
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve(validHtml),
				});
			}
			throw new Error(`Unexpected URL: ${url}`);
		});
		globalThis.fetch = mockFetch as never;

		const fetcher = new ClaudeDocsFetcher(testDir);

		const result = await fetcher.fetch();

		expect(result.fetched).toBe(1);
		expect(result.failed).toBe(1);
		expect(result.errors[0]?.error).toContain("Invalid markdown");
	});

	test("can skip validation if configured", async () => {
		const sampleSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://code.claude.com/docs/en/test</loc></url>
</urlset>`;

		const invalidHtml =
			"<html><body>Not markdown but saved anyway</body></html>";

		const mockFetch = mock((url: string) => {
			if (url.includes("sitemap.xml")) {
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve(sampleSitemap),
				});
			}
			return Promise.resolve({
				ok: true,
				text: () => Promise.resolve(invalidHtml),
			});
		});
		globalThis.fetch = mockFetch as never;

		const fetcher = new ClaudeDocsFetcher(testDir, {
			skipValidation: true,
		});

		const result = await fetcher.fetch();

		expect(result.fetched).toBe(1);
		expect(result.failed).toBe(0);
	});
});
