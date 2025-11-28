import { parseStringPromise } from "xml2js";
import type { SitemapXml } from "./types";

export class SitemapParser {
	constructor(private sitemapUrl: string) {}

	async parseSitemap(): Promise<string[]> {
		const response = await fetch(this.sitemapUrl);

		if (!response.ok) {
			throw new Error(
				`Failed to fetch sitemap: ${response.status} ${response.statusText}`,
			);
		}

		const xml = await response.text();
		const parsed = await this.parseXml(xml);

		const allUrls = this.extractUrls(parsed);

		if (allUrls.length === 0) {
			throw new Error("Empty sitemap: no URLs found");
		}

		return this.filterEnglishUrls(allUrls);
	}

	filterEnglishUrls(urls: string[]): string[] {
		// Filter for English Claude Code documentation URLs
		// Matches Eric Buess's pattern: /docs/en/ or /en/docs/claude-code/
		// Excludes: tool-use, examples, legacy, api, reference, agent-sdk
		const englishUrls = urls.filter((url) => {
			// Must match one of these patterns
			const hasValidPattern =
				url.includes("/docs/en/") || url.includes("/en/docs/claude-code/");

			// Must not include these exclusions
			const hasExclusions =
				url.includes("/tool-use/") ||
				url.includes("/examples/") ||
				url.includes("/legacy/") ||
				url.includes("/api/") ||
				url.includes("/reference/") ||
				url.includes("/agent-sdk/");

			return hasValidPattern && !hasExclusions;
		});
		return englishUrls.sort();
	}

	private async parseXml(xml: string): Promise<SitemapXml> {
		try {
			return await parseStringPromise(xml, {
				explicitArray: false,
			});
		} catch (error) {
			throw new Error(
				`Failed to parse sitemap XML: ${(error as Error).message}`,
			);
		}
	}

	private extractUrls(parsed: SitemapXml): string[] {
		const urls: string[] = [];

		if (!parsed.urlset || !parsed.urlset.url) {
			return urls;
		}

		// Handle both single URL and array of URLs
		const urlEntries = Array.isArray(parsed.urlset.url)
			? parsed.urlset.url
			: [parsed.urlset.url];

		for (const entry of urlEntries) {
			if (entry.loc) {
				urls.push(entry.loc);
			}
		}

		return urls;
	}
}
