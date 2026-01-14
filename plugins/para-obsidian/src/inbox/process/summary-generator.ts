/**
 * LLM-powered summary generation for clippings.
 *
 * Generates concise, searchable summaries for processed clippings.
 * Summaries are 1-2 sentences (50-150 chars) optimized for
 * frontmatter storage and Obsidian search.
 *
 * @module inbox/process/summary-generator
 */

import { inboxLogger } from "../../shared/logger.js";
import { callLLMWithMetadata } from "../core/llm/client.js";
import type { ClippingType } from "./types.js";

/**
 * Options for summary generation.
 */
export interface SummaryOptions {
	/** Type of clipping (affects prompt focus) */
	readonly clippingType: ClippingType;
	/** Main content to summarize (body text, scraped content) */
	readonly content: string;
	/** Optional transcript for YouTube videos */
	readonly transcript?: string;
	/** Optional video description for YouTube (provides context like chapters, links, topics) */
	readonly videoDescription?: string;
	/** Title of the clipping */
	readonly title: string;
	/** Whether content is user-curated highlights (not full page) */
	readonly isHighlightsOnly?: boolean;
}

/**
 * Accommodation-specific fields extracted by LLM.
 */
export interface AccommodationFields {
	/** Check-in date (YYYY-MM-DD) */
	readonly check_in?: string;
	/** Check-out date (YYYY-MM-DD) */
	readonly check_out?: string;
	/** Location (city or area) */
	readonly location?: string;
	/** Price with currency (e.g., "548.64 AUD") */
	readonly price?: string;
}

/**
 * Place-specific fields extracted by LLM.
 */
export interface PlaceFields {
	/** Place name */
	readonly name?: string;
	/** Full address */
	readonly address?: string;
	/** Suburb/neighborhood */
	readonly suburb?: string;
	/** Category (e.g., "park", "restaurant", "museum") */
	readonly category?: string;
	/** Google Maps URL */
	readonly google_maps?: string;
	/** Apple Maps URL */
	readonly apple_maps?: string;
}

/**
 * Result of summary generation.
 */
export interface SummaryResult {
	/** Generated summary text (1-2 sentences) */
	readonly summary: string;
	/** LLM-generated descriptive title (optional) */
	readonly generatedTitle?: string;
	/** LLM-cleaned content (removes web cruft, keeps only article-relevant content) */
	readonly cleanedContent?: string;
	/** Accommodation-specific fields (only for accommodation type) */
	readonly accommodationFields?: AccommodationFields;
	/** Place-specific fields (only for place type) */
	readonly placeFields?: PlaceFields;
	/** Generation status */
	readonly status: "success" | "failed" | "skipped";
	/** Error message if generation failed */
	readonly error?: string;
	/** Whether fallback model was used */
	readonly isFallback?: boolean;
	/** Which model was used */
	readonly modelUsed?: string;
}

/**
 * Title guidance by clipping type.
 * Each type has specific rules for generating descriptive titles.
 */
const TITLE_GUIDANCE: Record<ClippingType, string> = {
	youtube:
		"Channel name - Video topic (e.g., 'Fireship - React Server Components Explained')",
	article:
		"Publication/Author - Article topic (e.g., 'NYT - Climate Change Impact on Agriculture')",
	recipe:
		"Dish name with key descriptor (e.g., 'Thai Green Curry with Chicken')",
	product: "Brand - Product name (e.g., 'Sony WH-1000XM5 Headphones')",
	github:
		"Owner/Repo - Brief description (e.g., 'facebook/react - UI Component Library')",
	documentation: "Tool/API - Topic (e.g., 'TypeScript - Generics Guide')",
	social: "Author - Topic (e.g., 'Dan Abramov - React Hydration Explained')",
	podcast: "Show - Episode topic (e.g., 'Syntax FM - CSS Container Queries')",
	book: "Author - Book title (e.g., 'Cal Newport - Deep Work')",
	accommodation:
		"Property name - Location, Dates (e.g., 'The Hughenden Hotel - Sydney, Jan 24-26')",
	place:
		"Place name - Suburb (e.g., 'Paddington Reservoir Gardens - Paddington')",
	restaurant:
		"Restaurant name - Cuisine, Suburb (e.g., 'I Maccheroni - Italian, Woollahra')",
	generic: "Descriptive title capturing the main subject",
};

/**
 * Summary guidance by clipping type.
 */
const SUMMARY_GUIDANCE: Record<ClippingType, string> = {
	youtube: "main topic and one key insight",
	article: "main argument and key takeaway",
	recipe: "dish type and cuisine/technique",
	product: "what it is and main use case",
	github: "what project does and technology used",
	documentation: "topic covered and why useful",
	social: "main point and why worth saving",
	podcast: "main theme and key guests/insights",
	book: "what book is about and genre/theme",
	accommodation: "property name, location, dates, and price",
	place: "what the place is and where it's located",
	restaurant: "cuisine type, location, and what makes it special",
	generic: "what content is about and why useful",
};

/**
 * Build prompt for highlights-only mode.
 * When user has curated specific highlights, we just clean them up
 * into readable paragraphs without summarizing the whole page.
 */
function buildHighlightsPrompt(options: SummaryOptions): string {
	return `You are processing user-curated highlights from a web page.

The user has specifically selected these passages as important. Your job is to:
1. Generate a descriptive title
2. Write a brief summary of what these highlights are about
3. Clean up the highlights into well-formatted, readable content

TITLE RULES:
- Create a descriptive title based on what the highlights are about
- Max 60 characters
- No emoji, no quotes

SUMMARY RULES:
- 1-2 sentences, 50-150 characters
- Describe what the highlights cover
- Plain text only (no markdown)

CLEANED CONTENT RULES:
- Format the highlights into clean, readable paragraphs
- Fix any broken sentences or formatting issues
- Remove: trailing ellipses, broken HTML, navigation artifacts
- Keep: all the substance of what the user highlighted
- Preserve the meaning and order of the highlights
- Use clean markdown formatting
- If highlights are bullet points or quotes, format them nicely

Original title: {{title}}

User's highlights:
{{content}}

Respond with ONLY valid JSON (no markdown code blocks):
{"title": "descriptive title", "summary": "what these highlights are about", "cleaned_content": "formatted highlights"}`
		.replace("{{title}}", options.title)
		.replace("{{content}}", options.content);
}

/**
 * Build the unified prompt for title and summary generation.
 */
function buildUnifiedPrompt(options: SummaryOptions): string {
	const titleGuidance = TITLE_GUIDANCE[options.clippingType];
	const summaryGuidance = SUMMARY_GUIDANCE[options.clippingType];

	// For YouTube, prefer transcript over body content
	const contentToUse =
		options.clippingType === "youtube" && options.transcript
			? options.transcript
			: options.content;

	// For YouTube with description, build a combined prompt
	if (options.clippingType === "youtube" && options.videoDescription) {
		const descriptionContext = `VIDEO DESCRIPTION (contains chapter markers, links, and topic overview):
${truncateContent(options.videoDescription, "youtube")}

TRANSCRIPT:
${truncateContent(contentToUse, "youtube")}`;

		return `You are processing a YouTube video clipping for a personal knowledge base.

Generate a descriptive title, brief summary, and clean up the content.

IMPORTANT CONTEXT:
- The VIDEO DESCRIPTION often contains chapter markers, topic overview, and referenced links
- Use the description to understand the video's structure and main topics
- The transcript is the spoken content - use it for specific insights and quotes

TITLE RULES:
- Format: ${titleGuidance}
- Max 60 characters
- No emoji, no quotes
- Must be specific and searchable

SUMMARY RULES:
- 1-2 sentences, 50-150 characters
- Capture: ${summaryGuidance}
- Plain text only (no markdown, no **bold**, no links)
- Objective and factual

CLEANED CONTENT RULES:
- Create a well-structured summary of the video content
- Use the description's chapter markers to organize if available
- Extract key insights, techniques, or takeaways
- Remove: filler words, repetition, off-topic tangents
- Keep: main arguments, practical advice, quotable insights
- Format as clean markdown with headers for major sections
- Max 1000 words

Original title: {{title}}

${descriptionContext}

Respond with ONLY valid JSON (no markdown code blocks):
{"title": "your generated title", "summary": "your generated summary", "cleaned_content": "cleaned markdown content"}`.replace(
			"{{title}}",
			options.title,
		);
	}

	// Accommodation type needs extra fields extracted
	if (options.clippingType === "accommodation") {
		return `You are processing an accommodation booking for a personal knowledge base.

Extract booking details, generate a title and summary, and clean up the content.

TITLE RULES:
- Format: ${titleGuidance}
- Max 60 characters
- No emoji, no quotes

SUMMARY RULES:
- 1-2 sentences, 50-150 characters
- Capture: ${summaryGuidance}
- Plain text only (no markdown)

CLEANED CONTENT RULES:
- Extract ONLY the essential booking information
- Remove: tracking URLs, "Saving...", UI elements, navigation links, login prompts
- Remove: facilities lists (keep only noteworthy amenities), generic policies
- Keep: property name, room type, dates, price, address, cancellation deadline, confirmation number
- Format as clean markdown with headers
- Max 500 words

EXTRACT THESE FIELDS:
- check_in: Check-in date in YYYY-MM-DD format
- check_out: Check-out date in YYYY-MM-DD format
- location: City or area (e.g., "Sydney", "Melbourne CBD")
- price: Total price with currency (e.g., "548.64 AUD", "€299")

Original title: {{title}}

Booking content:
{{content}}

Respond with ONLY valid JSON (no markdown code blocks):
{"title": "...", "summary": "...", "cleaned_content": "...", "check_in": "YYYY-MM-DD", "check_out": "YYYY-MM-DD", "location": "...", "price": "..."}`
			.replace("{{title}}", options.title)
			.replace(
				"{{content}}",
				truncateContent(contentToUse, options.clippingType),
			);
	}

	// Place type needs location fields extracted
	if (options.clippingType === "place") {
		return `You are processing a place/location for a personal knowledge base.

Extract place details, generate a title and summary, and clean up the content.

TITLE RULES:
- Format: ${titleGuidance}
- Max 60 characters
- No emoji, no quotes

SUMMARY RULES:
- 1-2 sentences, 50-150 characters
- Capture: ${summaryGuidance}
- Plain text only (no markdown)

CLEANED CONTENT RULES:
- Write a brief, useful description of the place (2-4 sentences)
- Include: what type of place it is, what it's known for, location context
- Remove: Google Maps UI elements, navigation cruft, reviews, ratings
- Format as clean prose, not bullet points
- Max 200 words

EXTRACT THESE FIELDS:
- name: Place name (e.g., "Paddington Reservoir Gardens")
- address: Full street address if available
- suburb: Suburb or neighborhood (e.g., "Paddington")
- category: Type of place (e.g., "park", "restaurant", "museum", "cafe", "attraction")

Original title: {{title}}

Place content:
{{content}}

Respond with ONLY valid JSON (no markdown code blocks):
{"title": "...", "summary": "...", "cleaned_content": "...", "name": "...", "address": "...", "suburb": "...", "category": "..."}`
			.replace("{{title}}", options.title)
			.replace(
				"{{content}}",
				truncateContent(contentToUse, options.clippingType),
			);
	}

	return `You are processing a ${options.clippingType} clipping for a personal knowledge base.

Generate a descriptive title, brief summary, and clean up the content.

TITLE RULES:
- Format: ${titleGuidance}
- Max 60 characters
- No emoji, no quotes
- Must be specific and searchable

SUMMARY RULES:
- 1-2 sentences, 50-150 characters
- Capture: ${summaryGuidance}
- Plain text only (no markdown, no **bold**, no links)
- Objective and factual

CLEANED CONTENT RULES:
- Extract ONLY content directly relevant to the article/post topic
- Remove: cookie banners, navigation menus, ads, "Sign up", "Subscribe", sidebars
- Remove: social share buttons, related articles, comments sections, footers
- Remove: tracking parameters from URLs, login/signup prompts
- Keep: main article text, author byline, publication date, key quotes
- For social posts: keep the main thread, remove "Show replies", UI cruft
- Format as clean markdown
- If content is a thread/conversation, preserve the flow
- Max 1000 words

Original title: {{title}}

Content:
{{content}}

Respond with ONLY valid JSON (no markdown code blocks):
{"title": "your generated title", "summary": "your generated summary", "cleaned_content": "cleaned markdown content"}`
		.replace("{{title}}", options.title)
		.replace(
			"{{content}}",
			truncateContent(contentToUse, options.clippingType),
		);
}

/**
 * Maximum content length to send to LLM (in characters).
 * Prevents token overflow while keeping enough context for good summaries.
 */
const MAX_CONTENT_LENGTH = 4000;

/**
 * Maximum content length for accommodation types.
 * Accommodation pages (booking.com, airbnb) often have price info
 * buried deep in the page, so we need more content.
 */
const MAX_ACCOMMODATION_CONTENT_LENGTH = 12000;

/**
 * Get the maximum content length for a clipping type.
 * Accommodation types need more content to capture price info.
 */
function getMaxContentLength(type: ClippingType): number {
	if (type === "accommodation") {
		return MAX_ACCOMMODATION_CONTENT_LENGTH;
	}
	return MAX_CONTENT_LENGTH;
}

/**
 * Truncate content to maximum length with ellipsis.
 */
function truncateContent(content: string, type: ClippingType): string {
	const maxLength = getMaxContentLength(type);
	if (content.length <= maxLength) {
		return content;
	}
	return `${content.slice(0, maxLength)}...`;
}

/**
 * Parse LLM JSON response to extract title, summary, cleaned content, and type-specific fields.
 */
function parseJsonResponse(response: string): {
	title?: string;
	summary?: string;
	cleaned_content?: string;
	// Accommodation fields
	check_in?: string;
	check_out?: string;
	location?: string;
	price?: string;
	// Place fields
	name?: string;
	address?: string;
	suburb?: string;
	category?: string;
} {
	// Remove markdown code blocks if present
	let cleaned = response.trim();
	if (cleaned.startsWith("```json")) {
		cleaned = cleaned.slice(7);
	} else if (cleaned.startsWith("```")) {
		cleaned = cleaned.slice(3);
	}
	if (cleaned.endsWith("```")) {
		cleaned = cleaned.slice(0, -3);
	}
	cleaned = cleaned.trim();

	try {
		const parsed = JSON.parse(cleaned);
		return {
			title: typeof parsed.title === "string" ? parsed.title : undefined,
			summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
			cleaned_content:
				typeof parsed.cleaned_content === "string"
					? parsed.cleaned_content
					: undefined,
			// Accommodation fields
			check_in:
				typeof parsed.check_in === "string" ? parsed.check_in : undefined,
			check_out:
				typeof parsed.check_out === "string" ? parsed.check_out : undefined,
			location:
				typeof parsed.location === "string" ? parsed.location : undefined,
			price: typeof parsed.price === "string" ? parsed.price : undefined,
			// Place fields
			name: typeof parsed.name === "string" ? parsed.name : undefined,
			address: typeof parsed.address === "string" ? parsed.address : undefined,
			suburb: typeof parsed.suburb === "string" ? parsed.suburb : undefined,
			category:
				typeof parsed.category === "string" ? parsed.category : undefined,
		};
	} catch {
		// If JSON parsing fails, try to extract summary from plain text
		return { summary: cleaned };
	}
}

/**
 * Clean up LLM response to extract just the summary.
 * Removes quotes, prefixes, markdown formatting, and escapes for YAML.
 */
function cleanSummary(response: string): string {
	let summary = response.trim();

	// Remove common prefixes
	const prefixes = ["Summary:", "Here is the summary:", "Here's the summary:"];
	for (const prefix of prefixes) {
		if (summary.toLowerCase().startsWith(prefix.toLowerCase())) {
			summary = summary.slice(prefix.length).trim();
		}
	}

	// Remove surrounding quotes
	if (
		(summary.startsWith('"') && summary.endsWith('"')) ||
		(summary.startsWith("'") && summary.endsWith("'"))
	) {
		summary = summary.slice(1, -1);
	}

	// Remove newlines (summary should be single line for frontmatter)
	summary = summary.replace(/\n+/g, " ").trim();

	// Strip markdown formatting (frontmatter should be plain text)
	// Bold: **text** or __text__
	summary = summary.replace(/\*\*([^*]+)\*\*/g, "$1");
	summary = summary.replace(/__([^_]+)__/g, "$1");
	// Italic: *text* or _text_
	summary = summary.replace(/\*([^*]+)\*/g, "$1");
	summary = summary.replace(/_([^_]+)_/g, "$1");
	// Inline code: `text`
	summary = summary.replace(/`([^`]+)`/g, "$1");
	// Links: [text](url) -> text
	summary = summary.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

	// Escape for YAML: replace double quotes with single quotes
	// This prevents YAML parsing errors when summary contains quotes
	summary = summary.replace(/"/g, "'");

	return summary;
}

/**
 * Generate a summary for a clipping using LLM.
 *
 * Produces a 1-2 sentence summary optimized for:
 * - Frontmatter storage (no special characters that break YAML)
 * - Obsidian search (keyword-rich, objective language)
 * - Quick scanning (captures main topic + value)
 *
 * @param options - Summary generation options
 * @param cid - Optional correlation ID for logging
 * @returns Summary result with text and status
 *
 * @example
 * ```typescript
 * const result = await generateSummary({
 *   clippingType: "youtube",
 *   title: "React Server Components Tutorial",
 *   content: "This video covers...",
 *   transcript: "Welcome to this tutorial on RSC..."
 * });
 *
 * if (result.status === "success") {
 *   console.log(result.summary);
 *   // "Tutorial on React Server Components covering data fetching patterns and streaming"
 * }
 * ```
 */
export async function generateSummary(
	options: SummaryOptions,
	cid?: string,
): Promise<SummaryResult> {
	const log = inboxLogger;

	// Skip if no content to summarize
	if (!options.content && !options.transcript) {
		if (log) {
			log.info`process:summary:skip cid=${cid ?? "unknown"} reason=no-content`;
		}
		return {
			summary: "",
			status: "skipped",
			error: "No content available to summarize",
		};
	}

	try {
		if (log) {
			log.info`process:summary:start cid=${cid ?? "unknown"} type=${options.clippingType} title=${options.title} isHighlightsOnly=${options.isHighlightsOnly ?? false}`;
		}

		// Use different prompt for highlights-only mode
		const prompt = options.isHighlightsOnly
			? buildHighlightsPrompt(options)
			: buildUnifiedPrompt(options);

		const result = await callLLMWithMetadata(prompt, "haiku", undefined, {
			sessionCid: cid,
		});

		// Parse JSON response for title, summary, cleaned content, and type-specific fields
		const parsed = parseJsonResponse(result.response);
		const summary = cleanSummary(parsed.summary || "");
		const generatedTitle = parsed.title
			? cleanSummary(parsed.title)
			: undefined;
		// Keep cleaned content as-is (it's already markdown, don't strip formatting)
		const cleanedContent = parsed.cleaned_content;

		// Extract accommodation fields if present
		const accommodationFields: AccommodationFields | undefined =
			parsed.check_in || parsed.check_out || parsed.location || parsed.price
				? {
						check_in: parsed.check_in,
						check_out: parsed.check_out,
						location: parsed.location,
						price: parsed.price,
					}
				: undefined;

		// Extract place fields if present
		const placeFields: PlaceFields | undefined =
			parsed.name || parsed.address || parsed.suburb || parsed.category
				? {
						name: parsed.name,
						address: parsed.address,
						suburb: parsed.suburb,
						category: parsed.category,
					}
				: undefined;

		// Validate summary length (sanity check)
		if (summary.length < 10) {
			if (log) {
				log.warn`process:summary:tooShort cid=${cid ?? "unknown"} length=${summary.length}`;
			}
			return {
				summary: "",
				generatedTitle,
				cleanedContent,
				accommodationFields,
				placeFields,
				status: "failed",
				error: "Generated summary too short",
				isFallback: result.isFallback,
				modelUsed: result.modelUsed,
			};
		}

		if (log) {
			log.info`process:summary:success cid=${cid ?? "unknown"} length=${summary.length} titleGenerated=${!!generatedTitle} hasCleanedContent=${!!cleanedContent} model=${result.modelUsed}`;
		}

		return {
			summary,
			generatedTitle,
			cleanedContent,
			accommodationFields,
			placeFields,
			status: "success",
			isFallback: result.isFallback,
			modelUsed: result.modelUsed,
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);

		if (log) {
			log.error`process:summary:error cid=${cid ?? "unknown"} error=${errorMsg}`;
		}

		return {
			summary: "",
			status: "failed",
			error: errorMsg,
		};
	}
}
