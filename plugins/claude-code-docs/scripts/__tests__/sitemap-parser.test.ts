import { describe, expect, mock, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SitemapParser } from "../lib/sitemap-parser";

describe("SitemapParser", () => {
	const fixturesDir = join(__dirname, "fixtures");

	describe("parseSitemap", () => {
		test("parses sitemap and filters English URLs", async () => {
			const sitemapXml = await readFile(
				join(fixturesDir, "sample-sitemap.xml"),
				"utf-8",
			);

			const mockFetch = mock(() =>
				Promise.resolve({
					ok: true,
					text: () => Promise.resolve(sitemapXml),
				}),
			);
			globalThis.fetch = mockFetch as never;

			const parser = new SitemapParser("https://code.claude.com/sitemap.xml");
			const urls = await parser.parseSitemap();

			expect(urls).toHaveLength(4); // Only English Claude Code docs
			expect(urls).toContain("https://code.claude.com/docs/en/overview");
			expect(urls).toContain("https://code.claude.com/docs/en/hooks");
			expect(urls).toContain("https://code.claude.com/docs/en/plugins");
			expect(urls).toContain("https://code.claude.com/docs/en/slash-commands");

			// Should not include French or non-doc URLs
			expect(urls).not.toContain("https://code.claude.com/docs/fr/overview");
			expect(urls).not.toContain("https://code.claude.com/about");
		});

		test("throws error on invalid XML", async () => {
			const mockFetch = mock(() =>
				Promise.resolve({
					ok: true,
					text: () => Promise.resolve("not valid xml"),
				}),
			);
			globalThis.fetch = mockFetch as never;

			const parser = new SitemapParser("https://code.claude.com/sitemap.xml");

			await expect(parser.parseSitemap()).rejects.toThrow();
		});

		test("throws error on empty sitemap", async () => {
			const emptySitemap =
				'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';

			const mockFetch = mock(() =>
				Promise.resolve({
					ok: true,
					text: () => Promise.resolve(emptySitemap),
				}),
			);
			globalThis.fetch = mockFetch as never;

			const parser = new SitemapParser("https://code.claude.com/sitemap.xml");

			await expect(parser.parseSitemap()).rejects.toThrow(/empty sitemap/i);
		});

		test("handles sitemap with no English URLs", async () => {
			const noEnglishSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://code.claude.com/docs/fr/overview</loc>
  </url>
  <url>
    <loc>https://code.claude.com/about</loc>
  </url>
</urlset>`;

			const mockFetch = mock(() =>
				Promise.resolve({
					ok: true,
					text: () => Promise.resolve(noEnglishSitemap),
				}),
			);
			globalThis.fetch = mockFetch as never;

			const parser = new SitemapParser("https://code.claude.com/sitemap.xml");
			const urls = await parser.parseSitemap();

			expect(urls).toEqual([]);
		});
	});

	describe("filterEnglishUrls", () => {
		test("filters URLs containing /docs/en/", () => {
			const parser = new SitemapParser("https://code.claude.com/sitemap.xml");

			const urls = [
				"https://code.claude.com/docs/en/overview",
				"https://code.claude.com/docs/fr/overview",
				"https://code.claude.com/docs/en/plugins",
				"https://code.claude.com/about",
			];

			const filtered = parser.filterEnglishUrls(urls);

			expect(filtered).toHaveLength(2);
			expect(filtered).toContain("https://code.claude.com/docs/en/overview");
			expect(filtered).toContain("https://code.claude.com/docs/en/plugins");
		});

		test("returns empty array when no English URLs", () => {
			const parser = new SitemapParser("https://code.claude.com/sitemap.xml");

			const urls = [
				"https://code.claude.com/docs/fr/overview",
				"https://code.claude.com/about",
			];

			const filtered = parser.filterEnglishUrls(urls);

			expect(filtered).toEqual([]);
		});

		test("returns sorted URLs", () => {
			const parser = new SitemapParser("https://code.claude.com/sitemap.xml");

			const urls = [
				"https://code.claude.com/docs/en/zebra",
				"https://code.claude.com/docs/en/apple",
				"https://code.claude.com/docs/en/banana",
			];

			const filtered = parser.filterEnglishUrls(urls);

			expect(filtered).toEqual([
				"https://code.claude.com/docs/en/apple",
				"https://code.claude.com/docs/en/banana",
				"https://code.claude.com/docs/en/zebra",
			]);
		});

		test("excludes agent-sdk, api, reference, and other excluded paths", () => {
			const parser = new SitemapParser("https://code.claude.com/sitemap.xml");

			const urls = [
				"https://code.claude.com/docs/en/overview",
				"https://code.claude.com/docs/en/agent-sdk/tools",
				"https://code.claude.com/docs/en/api/endpoints",
				"https://code.claude.com/docs/en/reference/types",
				"https://code.claude.com/docs/en/examples/basics",
				"https://code.claude.com/docs/en/legacy/old-api",
				"https://code.claude.com/docs/en/tool-use/basics",
			];

			const filtered = parser.filterEnglishUrls(urls);

			expect(filtered).toHaveLength(1);
			expect(filtered).toContain("https://code.claude.com/docs/en/overview");
		});
	});
});
