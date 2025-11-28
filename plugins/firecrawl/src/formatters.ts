/**
 * Token-Efficient Output Formatters
 *
 * Formats Firecrawl API responses for minimal token consumption
 * while preserving essential information.
 */

import type {
	ExtractStatusResponse,
	MapLink,
	MapResponse,
	ScrapeData,
	ScrapeResponse,
	SearchData,
	SearchResponse,
	WebSearchResult,
} from "./types";

/**
 * Maximum characters for markdown content before truncation.
 */
const MAX_MARKDOWN_LENGTH = 8000;

/**
 * Maximum number of links to show in map results.
 */
const MAX_MAP_LINKS = 50;

/**
 * Maximum number of search results to show.
 */
const MAX_SEARCH_RESULTS = 10;

/**
 * Truncates text to a maximum length, adding ellipsis if truncated.
 */
function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength)}...[truncated]`;
}

/**
 * Formats a scrape response for token-efficient output.
 * @param response - Scrape API response
 * @returns Formatted string output
 */
export function formatScrapeResponse(response: ScrapeResponse): string {
	if (!response.success) {
		return `Error: ${(response as { error?: string }).error ?? "Scrape failed"}`;
	}

	const data = response.data as ScrapeData;
	if (!data) {
		return "No data returned";
	}

	const lines: string[] = [];

	// Title and source
	if (data.metadata?.title) {
		lines.push(`# ${data.metadata.title}`);
	}
	if (data.metadata?.sourceURL) {
		lines.push(`Source: ${data.metadata.sourceURL}`);
	}

	// Warning if present
	if (data.warning) {
		lines.push(`Warning: ${data.warning}`);
	}

	// Main content - prefer markdown, then summary
	if (data.markdown) {
		lines.push("");
		lines.push(truncate(data.markdown, MAX_MARKDOWN_LENGTH));
	} else if (data.summary) {
		lines.push("");
		lines.push(`Summary: ${data.summary}`);
	}

	// Links count
	if (data.links?.length) {
		lines.push("");
		lines.push(`Found ${data.links.length} links`);
	}

	return lines.join("\n");
}

/**
 * Formats a map response for token-efficient output.
 * @param response - Map API response
 * @returns Formatted string output
 */
export function formatMapResponse(response: MapResponse): string {
	if (!response.success) {
		return `Error: ${(response as { error?: string }).error ?? "Map failed"}`;
	}

	const links = response.links ?? [];
	if (links.length === 0) {
		return "No URLs found";
	}

	const lines: string[] = [];
	lines.push(`Found ${links.length} URLs`);
	lines.push("");

	// Show limited links with titles
	const displayLinks = links.slice(0, MAX_MAP_LINKS);
	for (const link of displayLinks) {
		const title = link.title ? ` - ${link.title}` : "";
		lines.push(`- ${link.url}${title}`);
	}

	if (links.length > MAX_MAP_LINKS) {
		lines.push(`... and ${links.length - MAX_MAP_LINKS} more`);
	}

	return lines.join("\n");
}

/**
 * Formats a search response for token-efficient output.
 * @param response - Search API response
 * @returns Formatted string output
 */
export function formatSearchResponse(response: SearchResponse): string {
	if (!response.success) {
		return `Error: ${(response as { error?: string }).error ?? "Search failed"}`;
	}

	const data = response.data as SearchData;
	if (!data) {
		return "No results found";
	}

	const lines: string[] = [];

	// Web results
	if (data.web?.length) {
		lines.push(`## Web Results (${data.web.length})`);
		lines.push("");

		const displayResults = data.web.slice(0, MAX_SEARCH_RESULTS);
		for (const result of displayResults) {
			lines.push(formatWebResult(result));
		}

		if (data.web.length > MAX_SEARCH_RESULTS) {
			lines.push(`... and ${data.web.length - MAX_SEARCH_RESULTS} more`);
		}
	}

	// Images count
	if (data.images?.length) {
		lines.push("");
		lines.push(`## Images: ${data.images.length} found`);
	}

	// News results
	if (data.news?.length) {
		lines.push("");
		lines.push(`## News Results (${data.news.length})`);
		for (const news of data.news.slice(0, 5)) {
			lines.push(`- ${news.title ?? "Untitled"} (${news.date ?? "no date"})`);
			lines.push(`  ${news.url}`);
		}
	}

	if (response.warning) {
		lines.push("");
		lines.push(`Warning: ${response.warning}`);
	}

	return lines.join("\n");
}

/**
 * Formats a single web search result.
 */
function formatWebResult(result: WebSearchResult): string {
	const lines: string[] = [];

	lines.push(`### ${result.title ?? "Untitled"}`);
	lines.push(result.url);

	if (result.description) {
		lines.push(result.description);
	}

	// Include markdown content if available (truncated)
	if (result.markdown) {
		lines.push("");
		lines.push(truncate(result.markdown, 2000));
	}

	lines.push("");
	return lines.join("\n");
}

/**
 * Formats an extract status response for token-efficient output.
 * @param response - Extract status API response
 * @returns Formatted string output
 */
export function formatExtractResponse(response: ExtractStatusResponse): string {
	if (!response.success) {
		return `Error: ${(response as { error?: string }).error ?? "Extract failed"}`;
	}

	const lines: string[] = [];

	lines.push(`Status: ${response.status ?? "unknown"}`);

	if (response.data) {
		lines.push("");
		lines.push("## Extracted Data");
		lines.push("```json");
		lines.push(JSON.stringify(response.data, null, 2));
		lines.push("```");
	}

	if (response.sources?.length) {
		lines.push("");
		lines.push(`Sources: ${response.sources.length} pages`);
	}

	return lines.join("\n");
}

/**
 * Formats map links as a simple URL list.
 * @param links - Array of map links
 * @returns Newline-separated URL list
 */
export function formatUrlList(links: MapLink[]): string {
	return links.map((link) => link.url).join("\n");
}
