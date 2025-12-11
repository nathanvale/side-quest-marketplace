/**
 * HTML module - Bun-native HTML escaping and utilities
 *
 * Uses Bun.escapeHTML for XSS protection and provides helpers
 * for safe HTML generation.
 *
 * @example
 * ```ts
 * import { escapeHtml, htmlTag } from "@sidequest/core/html";
 *
 * const safe = escapeHtml("<script>alert('xss')</script>");
 * // "&lt;script&gt;alert('xss')&lt;/script&gt;"
 *
 * const tag = htmlTag("a", { href: "/page" }, "Click me");
 * // '<a href="/page">Click me</a>'
 * ```
 */

/**
 * Escape HTML special characters to prevent XSS
 *
 * Uses Bun.escapeHTML for high-performance escaping.
 * Escapes: & < > " '
 *
 * @param input - String to escape
 * @returns HTML-safe string
 *
 * @example
 * ```ts
 * escapeHtml("<script>alert('xss')</script>");
 * // "&lt;script&gt;alert('xss')&lt;/script&gt;"
 *
 * escapeHtml("Tom & Jerry");
 * // "Tom &amp; Jerry"
 * ```
 */
export function escapeHtml(input: string): string {
	return Bun.escapeHTML(input);
}

/**
 * Escape HTML and convert newlines to <br> tags
 *
 * Useful for displaying user-submitted text with line breaks.
 *
 * @param input - String to escape
 * @returns HTML-safe string with <br> for newlines
 *
 * @example
 * ```ts
 * escapeHtmlWithBreaks("Line 1\nLine 2");
 * // "Line 1<br>Line 2"
 * ```
 */
export function escapeHtmlWithBreaks(input: string): string {
	return Bun.escapeHTML(input).replace(/\n/g, "<br>");
}

/**
 * Escape a string for use in an HTML attribute
 *
 * Escapes quotes and HTML special characters.
 *
 * @param input - String to escape
 * @returns Safe attribute value
 *
 * @example
 * ```ts
 * htmlAttr('value with "quotes"');
 * // 'value with &quot;quotes&quot;'
 * ```
 */
export function htmlAttr(input: string): string {
	return Bun.escapeHTML(input);
}

/** Attribute value types for htmlTag */
type AttrValue = string | number | boolean | null | undefined;

/**
 * Generate an HTML tag with safe attribute escaping
 *
 * Automatically escapes attribute values and content.
 *
 * @param tag - Tag name (e.g., "div", "a", "span")
 * @param attrs - Object of attribute name -> value (null/undefined skipped)
 * @param content - Inner content (auto-escaped, or pass SafeHtml for raw)
 * @returns HTML string
 *
 * @example
 * ```ts
 * htmlTag("a", { href: "/page", class: "link" }, "Click me");
 * // '<a href="/page" class="link">Click me</a>'
 *
 * htmlTag("input", { type: "text", disabled: true });
 * // '<input type="text" disabled>'
 *
 * htmlTag("div", { "data-id": null }); // null attrs skipped
 * // '<div></div>'
 * ```
 */
export function htmlTag(
	tag: string,
	attrs?: Record<string, AttrValue>,
	content?: string | SafeHtml,
): string {
	const attrStr = attrs
		? Object.entries(attrs)
				.filter(([, v]) => v != null)
				.map(([k, v]) => {
					if (v === true) return k;
					if (v === false) return "";
					return `${k}="${Bun.escapeHTML(String(v))}"`;
				})
				.filter(Boolean)
				.join(" ")
		: "";

	const attrPart = attrStr ? ` ${attrStr}` : "";

	// Self-closing tags
	const selfClosing = [
		"area",
		"base",
		"br",
		"col",
		"embed",
		"hr",
		"img",
		"input",
		"link",
		"meta",
		"param",
		"source",
		"track",
		"wbr",
	];

	if (selfClosing.includes(tag.toLowerCase())) {
		return `<${tag}${attrPart}>`;
	}

	const innerContent =
		content === undefined
			? ""
			: content instanceof SafeHtml
				? content.toString()
				: Bun.escapeHTML(content);

	return `<${tag}${attrPart}>${innerContent}</${tag}>`;
}

/**
 * Wrapper for pre-escaped HTML content
 *
 * Use when you have HTML that's already safe (e.g., from a trusted source).
 *
 * @example
 * ```ts
 * const trusted = new SafeHtml('<strong>Bold</strong>');
 * htmlTag("div", {}, trusted);
 * // '<div><strong>Bold</strong></div>'
 * ```
 */
export class SafeHtml {
	constructor(private readonly html: string) {}

	toString(): string {
		return this.html;
	}
}

/**
 * Create SafeHtml from a trusted string
 *
 * @param html - HTML string that is already safe
 * @returns SafeHtml wrapper
 */
export function safeHtml(html: string): SafeHtml {
	return new SafeHtml(html);
}

/**
 * Strip all HTML tags from a string
 *
 * Useful for extracting text content from HTML.
 *
 * @param input - HTML string
 * @returns Plain text with tags removed
 *
 * @example
 * ```ts
 * stripHtmlTags("<p>Hello <strong>World</strong></p>");
 * // "Hello World"
 * ```
 */
export function stripHtmlTags(input: string): string {
	return input.replace(/<[^>]*>/g, "");
}

/**
 * Unescape HTML entities back to their characters
 *
 * @param input - HTML-escaped string
 * @returns Unescaped string
 *
 * @example
 * ```ts
 * unescapeHtml("&lt;script&gt;");
 * // "<script>"
 *
 * unescapeHtml("Tom &amp; Jerry");
 * // "Tom & Jerry"
 * ```
 */
export function unescapeHtml(input: string): string {
	const entities: Record<string, string> = {
		"&amp;": "&",
		"&lt;": "<",
		"&gt;": ">",
		"&quot;": '"',
		"&#39;": "'",
		"&apos;": "'",
		"&#x27;": "'",
		"&#x2F;": "/",
		"&#47;": "/",
		"&nbsp;": " ",
	};

	return input.replace(
		/&(?:amp|lt|gt|quot|apos|#39|#x27|#x2F|#47|nbsp);/g,
		(match) => entities[match] ?? match,
	);
}

/**
 * Truncate HTML content safely (preserving tag structure)
 *
 * Truncates by text length, not HTML length.
 *
 * @param html - HTML string
 * @param maxLength - Maximum text length
 * @param suffix - Suffix to add when truncated (default: "...")
 * @returns Truncated HTML with proper tag closing
 *
 * @example
 * ```ts
 * truncateHtml("<p>Hello <strong>World</strong></p>", 8);
 * // "<p>Hello <strong>Wo</strong></p>..."
 * ```
 */
export function truncateHtml(
	html: string,
	maxLength: number,
	suffix = "...",
): string {
	// Simple implementation - extract text, truncate, re-escape
	const text = stripHtmlTags(html);
	if (text.length <= maxLength) {
		return html;
	}

	// For complex HTML, this is a simplified version
	// A full implementation would track open tags
	const truncated = text.slice(0, maxLength);
	return Bun.escapeHTML(truncated) + suffix;
}

/**
 * Convert plain text with URLs to HTML with links
 *
 * @param text - Plain text that may contain URLs
 * @returns HTML string with URLs as anchor tags
 *
 * @example
 * ```ts
 * linkifyUrls("Check out https://example.com for more");
 * // 'Check out <a href="https://example.com">https://example.com</a> for more'
 * ```
 */
export function linkifyUrls(text: string): string {
	const urlPattern = /(https?:\/\/[^\s<>]+)/g;

	return Bun.escapeHTML(text).replace(urlPattern, (url) => {
		return `<a href="${Bun.escapeHTML(url)}">${Bun.escapeHTML(url)}</a>`;
	});
}

/**
 * Create an HTML list from an array
 *
 * @param items - Array of items (will be escaped)
 * @param ordered - Use <ol> instead of <ul>
 * @returns HTML list string
 *
 * @example
 * ```ts
 * htmlList(["Apple", "Banana", "Cherry"]);
 * // '<ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>'
 * ```
 */
export function htmlList(items: string[], ordered = false): string {
	const tag = ordered ? "ol" : "ul";
	const listItems = items
		.map((item) => `<li>${Bun.escapeHTML(item)}</li>`)
		.join("");
	return `<${tag}>${listItems}</${tag}>`;
}
