/**
 * Core clipping processor module - orchestrates conversion of web clippings to typed notes.
 *
 * This module coordinates the entire processing pipeline:
 * 1. Find clipping notes in inbox
 * 2. Detect clipping type (YouTube, article, recipe, etc.)
 * 3. Enrich with external data (YouTube transcripts, Firecrawl scraping)
 * 4. Apply templates with variable substitution
 * 5. Write converted notes (in-place conversion, same filename)
 * 6. Delete original clippings after successful conversion
 * 7. Auto-commit changes (when configured)
 *
 * @module inbox/process/clipping-processor
 */

import { readdir, readFile, rename } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { pathExists } from "@sidequest/core/fs";
import {
	extractCoordsFromGoogleMaps,
	generateAppleMapsSearchUrl,
	generateAppleMapsUrl,
	generateGoogleMapsSearchUrl,
} from "@sidequest/core/geo";
import { loadConfig } from "../../config/index.js";
import { parseFrontmatter } from "../../frontmatter/parse.js";
import { atomicWriteFile } from "../../shared/atomic-fs.js";
import { observe } from "../../shared/instrumentation.js";
import {
	createCorrelationId,
	inboxLogger as log,
} from "../../shared/logger.js";
import {
	enrichWithFirecrawl,
	shouldUseFirecrawl,
} from "../enrich/firecrawl-enrichment.js";
import { fetchTranscriptViaMcp } from "../enrich/mcp-youtube-client.js";
import {
	classifyClipping,
	classifyFromMetadata,
	extractYouTubeVideoId,
} from "../enrich/strategies/clipping-types.js";
import { fetchVideoInfo } from "../enrich/youtube-info.js";
import { generateSummary } from "./summary-generator.js";
import { applyTemplate } from "./template-applier.js";
import type {
	ClippingEnrichment,
	ClippingFrontmatter,
	ClippingProcessResult,
	ClippingType,
	ProcessBatchResult,
	ProcessOptions,
	TemplateVariables,
} from "./types.js";

/**
 * Emoji prefix for each clipping type.
 * Used to visually distinguish converted notes in the inbox.
 */
const CLIPPING_TYPE_EMOJI: Record<ClippingType, string> = {
	youtube: "✂️🎬",
	article: "✂️📖",
	recipe: "✂️🍳",
	product: "✂️🛒",
	github: "✂️💻",
	documentation: "✂️📚",
	social: "✂️💬",
	podcast: "✂️🎙️",
	book: "✂️📕",
	accommodation: "✂️🏨",
	place: "✂️📍",
	restaurant: "✂️🍽️",
	generic: "✂️📄",
};

/**
 * Get the emoji prefix for a clipping type.
 *
 * @param type - Clipping type
 * @returns Emoji prefix string
 *
 * @example
 * ```typescript
 * getEmojiPrefix("youtube") // "✂️🎬"
 * getEmojiPrefix("article") // "✂️📖"
 * ```
 */
function getEmojiPrefix(type: ClippingType): string {
	return CLIPPING_TYPE_EMOJI[type] || CLIPPING_TYPE_EMOJI.generic;
}

/**
 * Sanitize a string for use as a filename.
 * Removes/replaces characters that are invalid in filenames.
 *
 * @param title - Raw title string
 * @returns Sanitized filename-safe string
 */
function sanitizeFilename(title: string): string {
	return (
		title
			// Remove characters invalid in filenames
			.replace(/[<>:"/\\|?*]/g, "")
			// Replace multiple spaces with single space
			.replace(/\s+/g, " ")
			// Trim whitespace
			.trim()
			// Limit length (leaving room for emoji prefix)
			.slice(0, 80)
	);
}

/**
 * Add emoji prefix to filename if not already present.
 *
 * @param filename - Original filename (without .md extension)
 * @param type - Clipping type for emoji selection
 * @returns Filename with emoji prefix
 *
 * @example
 * ```typescript
 * addEmojiPrefix("My Video", "youtube") // "✂️🎬 My Video"
 * addEmojiPrefix("✂️🎬 My Video", "youtube") // "✂️🎬 My Video" (unchanged)
 * ```
 */
function addEmojiPrefix(filename: string, type: ClippingType): string {
	const prefix = getEmojiPrefix(type);

	// Check if already has the correct prefix
	if (filename.startsWith(prefix)) {
		return filename;
	}

	// Check if has any clipping emoji prefix (✂️) - replace it
	if (filename.startsWith("✂️")) {
		// Find where the actual title starts (after emoji prefix and space)
		const match = filename.match(/^✂️[^\s]*\s*/);
		if (match) {
			return `${prefix} ${filename.slice(match[0].length)}`;
		}
	}

	return `${prefix} ${filename}`;
}

/**
 * Parse clipping content to extract highlights and content sections.
 * Detects whether the clipping is a highlights-only clip based on section content.
 *
 * @param content - Raw markdown content (body without frontmatter)
 * @returns Parsed sections with isHighlightsClip flag
 *
 * @example
 * ```typescript
 * const parsed = parseClippingSections(content);
 * if (parsed.isHighlightsClip) {
 *   // User curated highlights - preserve them
 * }
 * ```
 */
export function parseClippingSections(content: string): {
	highlights: string;
	contentSection: string;
	isHighlightsClip: boolean;
} {
	// Find ## Highlights section
	// Use [ \t]* instead of \s* to avoid consuming newlines before content
	const highlightsMatch = content.match(
		/## Highlights[ \t]*\n([\s\S]*?)(?=\n+---\n|\n## |\n# |$)/,
	);
	const highlights = highlightsMatch?.[1]?.trim() || "";

	// Find ## Content section
	// Use [ \t]* instead of \s* to avoid consuming newlines before content
	const contentMatch = content.match(
		/## Content[ \t]*\n([\s\S]*?)(?=\n## |\n# |$)/,
	);
	const contentSection = contentMatch?.[1]?.trim() || "";

	// Normalize content for comparison by stripping bullet prefixes and extra whitespace
	// This handles Web Clipper quirks like double-dashes (- - item) or formatting differences
	const normalizeForComparison = (text: string): string =>
		text
			.split("\n")
			.map((line) => line.replace(/^[\s\-*•]+/, "").trim())
			.filter((line) => line.length > 0)
			.join("\n");

	const normalizedHighlights = normalizeForComparison(highlights);
	const normalizedContent = normalizeForComparison(contentSection);

	// It's a highlights clip if:
	// 1. Highlights section has actual content (not just whitespace)
	// 2. Content is either empty OR matches the highlights (Web Clipper sets content to highlights when highlighting)
	const hasHighlights = highlights.length > 0;
	const contentIsEmpty = contentSection.length === 0;
	const contentMatchesHighlights =
		normalizedContent === normalizedHighlights ||
		// Web Clipper sometimes wraps highlights in the content section too
		normalizedContent.includes(normalizedHighlights) ||
		normalizedHighlights.includes(normalizedContent);

	const isHighlightsClip =
		hasHighlights && (contentIsEmpty || contentMatchesHighlights);

	return {
		highlights,
		contentSection,
		isHighlightsClip,
	};
}

/**
 * Find all clipping notes in the inbox.
 * Looks for notes with type:clipping in frontmatter.
 *
 * @returns Array of absolute paths to clipping notes
 *
 * @example
 * ```typescript
 * const clippings = await findClippings();
 * // ["/vault/00 Inbox/article.md", "/vault/00 Inbox/video.md"]
 * ```
 */
export async function findClippings(): Promise<string[]> {
	return observe(
		log,
		"inbox:findClippings",
		async () => {
			const config = loadConfig();
			const inboxPath = join(config.vault, "00 Inbox");

			// Check if inbox exists
			if (!(await pathExists(inboxPath))) {
				if (log) {
					log.warn`inbox:findClippings:noInbox path=${inboxPath}`;
				}
				return [];
			}

			// Read all .md files
			const files = await readdir(inboxPath);
			const mdFiles = files.filter((f) => f.endsWith(".md"));

			const clippings: string[] = [];

			// Parse frontmatter and filter for type:clipping (unprocessed only)
			for (const file of mdFiles) {
				const filePath = join(inboxPath, file);
				try {
					const content = await readFile(filePath, "utf-8");
					const { attributes } = parseFrontmatter(content);

					// Raw clippings have type: clipping AND required fields
					// Processed clippings have clipping_type set - skip those
					if (
						attributes.type === "clipping" &&
						!attributes.clipping_type && // Not yet classified
						typeof attributes.domain === "string" && // Has required field
						typeof attributes.distill_status === "string" // Has required field
					) {
						clippings.push(filePath);
					}
				} catch (error) {
					// Skip files we can't parse
					if (log) {
						log.warn`inbox:findClippings:parseFailed file=${file} error=${error instanceof Error ? error.message : String(error)}`;
					}
				}
			}

			if (log) {
				log.info`inbox:findClippings:complete found=${clippings.length}`;
			}

			return clippings;
		},
		{ context: {} },
	);
}

/**
 * Read a clipping note and parse its frontmatter and content.
 *
 * @param filePath - Absolute path to clipping note
 * @returns Parsed clipping data
 * @throws Error if file doesn't exist or frontmatter is invalid
 *
 * @example
 * ```typescript
 * const { frontmatter, content, title } = await readClipping("/vault/00 Inbox/article.md");
 * console.log(frontmatter.source); // "https://example.com/article"
 * ```
 */
export async function readClipping(filePath: string): Promise<{
	frontmatter: ClippingFrontmatter;
	content: string;
	title: string;
}> {
	return observe(
		log,
		"inbox:readClipping",
		async () => {
			const raw = await readFile(filePath, "utf-8");
			const { attributes, body } = parseFrontmatter(raw);

			// Extract title from filename (without .md extension)
			const filename = basename(filePath, ".md");

			// Validate frontmatter has required clipping fields
			if (
				attributes.type !== "clipping" ||
				typeof attributes.source !== "string" ||
				typeof attributes.domain !== "string" ||
				typeof attributes.clipped !== "string" ||
				typeof attributes.distill_status !== "string"
			) {
				throw new Error(
					`Invalid clipping frontmatter in ${filePath}: missing required fields`,
				);
			}

			// TypeScript validated above, safe to construct ClippingFrontmatter
			const frontmatter: ClippingFrontmatter = {
				type: "clipping" as const,
				source: attributes.source,
				domain: attributes.domain,
				clipped: attributes.clipped,
				distill_status: attributes.distill_status,
				capture_reason:
					typeof attributes.capture_reason === "string"
						? attributes.capture_reason
						: undefined,
			};

			return {
				frontmatter,
				content: body,
				title: filename,
			};
		},
		{ context: { filePath } },
	);
}

/**
 * Fetch YouTube transcript using MCP client.
 *
 * @param videoId - YouTube video ID
 * @param cid - Correlation ID for logging
 * @returns Transcript result with status
 *
 * @example
 * ```typescript
 * const result = await getYouTubeTranscript("dQw4w9WgXcQ", "abc123");
 * if (result.status === "success") {
 *   console.log(result.transcript);
 * }
 * ```
 */
async function getYouTubeTranscript(
	videoId: string,
	cid: string,
): Promise<{
	transcript: string;
	status: "success" | "failed";
	error?: string;
}> {
	return observe(
		log,
		"inbox:fetchYouTubeTranscript",
		async () => {
			try {
				const result = await fetchTranscriptViaMcp(videoId);

				if (log) {
					log.info`inbox:fetchYouTubeTranscript:success videoId=${videoId} cid=${cid} length=${result.transcript.length}`;
				}

				return {
					transcript: result.transcript,
					status: "success",
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				if (log) {
					log.error`inbox:fetchYouTubeTranscript:error videoId=${videoId} cid=${cid} error=${errorMsg}`;
				}
				return {
					transcript: "",
					status: "failed",
					error: errorMsg,
				};
			}
		},
		{ context: { videoId, cid } },
	);
}

/**
 * Build enrichment data for a clipping.
 * Uses YouTube MCP for videos, Firecrawl for other types.
 *
 * @param frontmatter - Clipping frontmatter
 * @param content - Clipping content
 * @param type - Detected clipping type
 * @param cid - Correlation ID for logging
 * @returns Enrichment data
 *
 * @example
 * ```typescript
 * const enrichment = await enrichClipping(
 *   frontmatter,
 *   content,
 *   "youtube",
 *   "abc123"
 * );
 * if (enrichment.enrichmentStatus === "success") {
 *   console.log(enrichment.transcript);
 * }
 * ```
 */
async function enrichClipping(
	frontmatter: ClippingFrontmatter,
	_content: string,
	type: ClippingType,
	cid: string,
): Promise<ClippingEnrichment> {
	return observe(
		log,
		"inbox:enrichClipping",
		async () => {
			const url = frontmatter.source;

			// YouTube enrichment
			if (type === "youtube") {
				const videoId = extractYouTubeVideoId(url);
				if (!videoId) {
					if (log) {
						log.warn`inbox:enrichClipping:noVideoId url=${url} cid=${cid}`;
					}
					return {
						enrichmentSource: "youtube-mcp",
						enrichmentStatus: "failed",
						enrichmentError: "Could not extract video ID from URL",
					};
				}

				// Fetch transcript and video info in parallel
				const [transcriptResult, videoInfoResult] = await Promise.all([
					getYouTubeTranscript(videoId, cid),
					fetchVideoInfo(videoId),
				]);

				return {
					transcript: transcriptResult.transcript,
					videoId,
					channelName: videoInfoResult.info?.channel,
					duration: videoInfoResult.info?.duration,
					uploadDate: videoInfoResult.info?.uploadDate,
					videoDescription: videoInfoResult.info?.description,
					videoTitle: videoInfoResult.info?.title,
					enrichmentSource: "youtube-mcp",
					enrichmentStatus: transcriptResult.status,
					enrichmentError: transcriptResult.error,
				};
			}

			// Firecrawl enrichment for other types
			if (shouldUseFirecrawl(type)) {
				const result = await enrichWithFirecrawl(url, type);

				if (result.status === "skipped") {
					return {
						enrichmentSource: "none",
						enrichmentStatus: "skipped",
						enrichmentError: result.reason,
					};
				}

				if (result.status === "failed") {
					return {
						enrichmentSource: "none",
						enrichmentStatus: "failed",
						enrichmentError: result.error,
					};
				}

				// Success - extract data based on method
				const enrichment = result.enrichment;
				if (!enrichment) {
					return {
						enrichmentSource: "none",
						enrichmentStatus: "failed",
						enrichmentError: "No enrichment data returned",
					};
				}

				if (enrichment.method === "extract") {
					const data = enrichment.structuredData as Record<string, unknown>;

					// Accommodation extraction
					if (type === "accommodation") {
						return {
							// Map Firecrawl schema fields to our enrichment fields
							checkIn: data.checkIn as string | undefined,
							checkOut: data.checkOut as string | undefined,
							location: data.location as string | undefined,
							price: data.totalPrice as string | undefined,
							// Store additional fields for summary generation
							scrapedContent: JSON.stringify({
								propertyName: data.propertyName,
								nights: data.nights,
								guests: data.guests,
								roomType: data.roomType,
								address: data.address,
								confirmationNumber: data.confirmationNumber,
							}),
							enrichmentSource: "firecrawl-extract",
							enrichmentStatus: "success",
						};
					}

					// Restaurant extraction
					if (type === "restaurant") {
						return {
							restaurantName: data.name as string | undefined,
							cuisine: data.cuisine as string | undefined,
							suburb: data.suburb as string | undefined,
							city: data.city as string | undefined,
							priceRange: data.priceRange as string | undefined,
							bookingUrl: data.bookingUrl as string | undefined,
							menuUrl: data.menuUrl as string | undefined,
							phone: data.phone as string | undefined,
							address: data.address as string | undefined,
							chef: data.chef as string | undefined,
							specialties: data.specialties as string[] | undefined,
							ambiance: data.ambiance as string | undefined,
							enrichmentSource: "firecrawl-extract",
							enrichmentStatus: "success",
						};
					}

					// Recipe extraction
					return {
						ingredients: data.ingredients as string[] | undefined,
						instructions: data.instructions as string[] | undefined,
						prepTime: data.prepTime as string | undefined,
						cookTime: data.cookTime as string | undefined,
						servings: data.servings as string | undefined,
						enrichmentSource: "firecrawl-extract",
						enrichmentStatus: "success",
					};
				}

				// Scrape method - include metadata for re-classification
				return {
					scrapedContent: enrichment.markdown,
					firecrawlMetadata: enrichment.metadata,
					enrichmentSource: "firecrawl-scrape",
					enrichmentStatus: "success",
				};
			}

			// No enrichment needed
			return {
				enrichmentSource: "none",
				enrichmentStatus: "skipped",
			};
		},
		{ context: { type, url: frontmatter.source, cid } },
	);
}

/**
 * Build template variables from clipping data and enrichment.
 * Maps all available data to template substitution variables.
 *
 * @param title - Note title
 * @param frontmatter - Clipping frontmatter
 * @param content - Original clipped content
 * @param enrichment - Enrichment data
 * @param type - Clipping type
 * @returns Template variables for substitution
 *
 * @example
 * ```typescript
 * const vars = buildTemplateVariables(
 *   "My Video",
 *   frontmatter,
 *   content,
 *   enrichment,
 *   "youtube"
 * );
 * // vars.transcript = "Full transcript..."
 * // vars.video_id = "abc123"
 * ```
 */
function buildTemplateVariables(
	title: string,
	frontmatter: ClippingFrontmatter,
	content: string,
	enrichment: ClippingEnrichment,
	type: ClippingType,
): TemplateVariables {
	// Use AI-cleaned content when available, fall back to original
	// This removes web cruft (navigation, ads, tracking URLs) and keeps only relevant content
	const cleanContent = enrichment.cleanedContent || content;

	const base: TemplateVariables = {
		title,
		source: frontmatter.source,
		domain: frontmatter.domain,
		clipped: frontmatter.clipped,
		content: cleanContent,
		capture_reason: frontmatter.capture_reason,
		// LLM-generated summary for frontmatter
		summary: enrichment.summary,
	};

	// YouTube-specific fields
	if (type === "youtube" && enrichment.videoId) {
		return {
			...base,
			video_id: enrichment.videoId,
			transcript: enrichment.transcript,
			transcript_status:
				enrichment.enrichmentStatus === "success" ? "success" : "failed",
			channel_name: enrichment.channelName,
			duration: enrichment.duration,
			published: enrichment.uploadDate,
			description: enrichment.videoDescription,
		};
	}

	// Recipe-specific fields
	if (type === "recipe" && enrichment.ingredients) {
		return {
			...base,
			ingredients: enrichment.ingredients.join("\n"),
			instructions: enrichment.instructions?.join("\n"),
			prep_time: enrichment.prepTime,
			cook_time: enrichment.cookTime,
			servings: enrichment.servings,
		};
	}

	// Accommodation-specific fields
	if (type === "accommodation") {
		return {
			...base,
			check_in: enrichment.checkIn,
			check_out: enrichment.checkOut,
			location: enrichment.location,
			price: enrichment.price,
		};
	}

	// Place-specific fields
	if (type === "place") {
		return {
			...base,
			place_name: enrichment.placeName,
			address: enrichment.address,
			suburb: enrichment.suburb,
			category: enrichment.category,
			google_maps: enrichment.googleMaps,
			apple_maps: enrichment.appleMaps,
		};
	}

	// Restaurant-specific fields
	if (type === "restaurant" && enrichment.restaurantName) {
		// Build search query for maps - prefer address, fallback to name + suburb/city
		const mapQuery = enrichment.address
			? enrichment.address
			: [enrichment.restaurantName, enrichment.suburb, enrichment.city]
					.filter(Boolean)
					.join(", ");

		return {
			...base,
			restaurant_name: enrichment.restaurantName,
			cuisine: enrichment.cuisine,
			suburb: enrichment.suburb,
			city: enrichment.city,
			price_range: enrichment.priceRange,
			booking_url: enrichment.bookingUrl,
			menu_url: enrichment.menuUrl,
			phone: enrichment.phone,
			address: enrichment.address,
			chef: enrichment.chef,
			specialties: enrichment.specialties?.join(", "),
			ambiance: enrichment.ambiance,
			// Map URLs for navigation
			google_maps: mapQuery ? generateGoogleMapsSearchUrl(mapQuery) : undefined,
			apple_maps: mapQuery ? generateAppleMapsSearchUrl(mapQuery) : undefined,
		};
	}

	// Article/general fields
	if (enrichment.scrapedContent) {
		return {
			...base,
			scraped_content: enrichment.scrapedContent,
			author: enrichment.author,
			publish_date: enrichment.publishDate,
		};
	}

	return base;
}

/**
 * Process a single clipping note.
 * Converts a raw clipping to a typed note with enriched content.
 *
 * @param filePath - Absolute path to clipping note
 * @param options - Processing options
 * @returns Processing result
 *
 * @example
 * ```typescript
 * const result = await processClipping("/vault/00 Inbox/article.md", {
 *   dryRun: false,
 *   verbose: true
 * });
 * if (result.status === "success") {
 *   console.log(`Converted: ${result.convertedPath}`);
 * }
 * ```
 */
export async function processClipping(
	filePath: string,
	options: ProcessOptions = {},
): Promise<ClippingProcessResult> {
	const cid = createCorrelationId();

	return observe(
		log,
		"inbox:processClipping",
		async () => {
			try {
				// 1. Read clipping
				const { frontmatter, content, title } = await readClipping(filePath);

				if (options.verbose && log) {
					log.info`inbox:processClipping:start cid=${cid} file=${filePath} title=${title}`;
				}

				// 2. Parse content to detect highlights vs full page clip
				// This determines whether we use Firecrawl or preserve user's curated content
				const parsedSections = parseClippingSections(content);
				const isHighlightsClip = parsedSections.isHighlightsClip;

				if (options.verbose && log) {
					log.info`inbox:processClipping:parsed cid=${cid} file=${filePath} isHighlightsClip=${isHighlightsClip} highlightsLen=${parsedSections.highlights.length} contentLen=${parsedSections.contentSection.length}`;
				}

				// 3. Detect type - use explicit clipping_type if set, otherwise classify
				let type: ClippingType;
				const explicitType = frontmatter.clipping_type as
					| ClippingType
					| undefined;

				if (explicitType) {
					// User specified type in Web Clipper - use it directly
					type = explicitType;
					if (options.verbose && log) {
						log.info`inbox:processClipping:explicitType cid=${cid} file=${filePath} type=${type}`;
					}
				} else {
					// No explicit type - classify from URL + content
					type = classifyClipping(frontmatter.source, content);
					if (options.verbose && log) {
						log.info`inbox:processClipping:classified cid=${cid} file=${filePath} type=${type}`;
					}
				}

				// 4. Enrich (unless skipped OR this is a highlights clip)
				// For highlights clips, user's curated content is the source of truth - skip Firecrawl
				let enrichment: ClippingEnrichment = {
					enrichmentSource: "none",
					enrichmentStatus: "skipped",
				};

				if (isHighlightsClip) {
					// Highlights clip - skip external enrichment, preserve user content
					if (options.verbose && log) {
						log.info`inbox:processClipping:skipEnrichment cid=${cid} file=${filePath} reason=highlightsClip`;
					}
				} else if (!options.skipEnrichment) {
					enrichment = await enrichClipping(frontmatter, content, type, cid);

					if (options.verbose && log) {
						log.info`inbox:processClipping:enriched cid=${cid} file=${filePath} status=${enrichment.enrichmentStatus} source=${enrichment.enrichmentSource}`;
					}

					// 4a. Re-classify from metadata if initially generic
					// Firecrawl scrape returns OG/meta tags that may indicate restaurant, etc.
					if (
						type === "generic" &&
						enrichment.enrichmentStatus === "success" &&
						enrichment.firecrawlMetadata
					) {
						const metadataType = classifyFromMetadata(
							enrichment.firecrawlMetadata,
						);
						if (metadataType && metadataType !== "generic") {
							if (options.verbose && log) {
								log.info`inbox:processClipping:reclassified cid=${cid} file=${filePath} from=generic to=${metadataType} reason=metadata`;
							}
							type = metadataType;

							// Re-enrich with new type if needed (e.g., restaurant needs extract, not scrape)
							if (type === "restaurant") {
								if (options.verbose && log) {
									log.info`inbox:processClipping:reenrich cid=${cid} file=${filePath} type=${type} reason=metadata-reclassification`;
								}
								enrichment = await enrichClipping(
									frontmatter,
									content,
									type,
									cid,
								);
							}
						}
					}
				}

				// 5. Generate summary (LLM-powered)
				// For highlights clips: use the highlights as source of truth
				// For full page clips: use enriched content if available
				const contentForSummary = isHighlightsClip
					? parsedSections.highlights
					: enrichment.scrapedContent || enrichment.transcript || content;

				if (options.verbose && log && isHighlightsClip) {
					log.info`inbox:processClipping:highlightsMode cid=${cid} file=${filePath} usingHighlightsForSummary=true`;
				}

				const summaryResult = await generateSummary(
					{
						clippingType: type,
						title,
						content: contentForSummary,
						transcript: enrichment.transcript,
						videoDescription: enrichment.videoDescription,
						isHighlightsOnly: isHighlightsClip,
					},
					cid,
				);

				// Add summary and cleaned content to enrichment
				// For accommodation/place fields: prefer Firecrawl extract values, fall back to LLM extraction
				enrichment = {
					...enrichment,
					summary: summaryResult.summary || undefined,
					cleanedContent: summaryResult.cleanedContent,
					summaryStatus: summaryResult.status,
					summaryError: summaryResult.error,
					// Accommodation fields: Firecrawl extract takes precedence over LLM extraction
					checkIn:
						enrichment.checkIn || summaryResult.accommodationFields?.check_in,
					checkOut:
						enrichment.checkOut || summaryResult.accommodationFields?.check_out,
					location:
						enrichment.location || summaryResult.accommodationFields?.location,
					price: enrichment.price || summaryResult.accommodationFields?.price,
					// Place/Restaurant fields: Firecrawl extract takes precedence over LLM extraction
					placeName: enrichment.placeName || summaryResult.placeFields?.name,
					address: enrichment.address || summaryResult.placeFields?.address,
					suburb: enrichment.suburb || summaryResult.placeFields?.suburb,
					category: summaryResult.placeFields?.category,
					// Maps URLs: prefer frontmatter, fall back to source URL or generated URL
					googleMaps: (() => {
						// Check frontmatter first
						const fromFrontmatter = (
							frontmatter as unknown as Record<string, unknown>
						).google_maps as string | undefined;
						if (fromFrontmatter) return fromFrontmatter;
						// Use source URL if it's a Google Maps URL
						if (frontmatter.source.includes("google.com/maps")) {
							return frontmatter.source;
						}
						// Generate from Apple Maps source if we have coords
						if (frontmatter.source.includes("maps.apple.com")) {
							const coords = extractCoordsFromGoogleMaps(frontmatter.source);
							if (coords) {
								const placeName = summaryResult.placeFields?.name;
								const query = placeName
									? `&q=${encodeURIComponent(placeName)}`
									: "";
								return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}${query}`;
							}
						}
						return undefined;
					})(),
					appleMaps: (() => {
						// Check frontmatter first
						const fromFrontmatter = (
							frontmatter as unknown as Record<string, unknown>
						).apple_maps as string | undefined;
						if (fromFrontmatter) return fromFrontmatter;
						// Use source URL if it's an Apple Maps URL
						if (frontmatter.source.includes("maps.apple.com")) {
							return frontmatter.source;
						}
						// Generate Apple Maps URL from Google Maps source coords
						if (frontmatter.source.includes("google.com/maps")) {
							const coords = extractCoordsFromGoogleMaps(frontmatter.source);
							if (coords) {
								return generateAppleMapsUrl(
									coords.lat,
									coords.lng,
									summaryResult.placeFields?.name,
								);
							}
						}
						return undefined;
					})(),
				};

				if (options.verbose && log) {
					log.info`inbox:processClipping:summarized cid=${cid} file=${filePath} status=${summaryResult.status}`;
				}

				// 5. Build template variables (includes summary)
				const variables = buildTemplateVariables(
					title,
					frontmatter,
					content,
					enrichment,
					type,
				);

				// 6. Apply template
				let processedContent: string;
				try {
					processedContent = await applyTemplate(type, variables);
				} catch (error) {
					const errorMsg =
						error instanceof Error ? error.message : String(error);
					if (log) {
						log.error`inbox:processClipping:templateFailed cid=${cid} file=${filePath} type=${type} error=${errorMsg}`;
					}
					return {
						originalPath: filePath,
						clippingType: type,
						enrichment,
						status: "failed",
						error: `Template application failed: ${errorMsg}`,
						deleted: false,
					};
				}

				// 7. Write new note and rename with emoji prefix + generated title
				let finalPath = filePath;
				if (!options.dryRun) {
					// First write the converted content
					await atomicWriteFile(filePath, processedContent);

					// Then rename the file:
					// - Use LLM-generated title if available (better than generic page titles)
					// - Add emoji prefix based on clipping type
					const dir = dirname(filePath);
					const currentFilename = basename(filePath, ".md");

					// Use generated title if available, otherwise keep current filename
					const baseFilename = summaryResult.generatedTitle
						? sanitizeFilename(summaryResult.generatedTitle)
						: currentFilename;
					const newFilename = addEmojiPrefix(baseFilename, type);

					if (newFilename !== currentFilename) {
						finalPath = join(dir, `${newFilename}.md`);
						await rename(filePath, finalPath);

						if (options.verbose && log) {
							log.info`inbox:processClipping:renamed cid=${cid} from=${currentFilename} to=${newFilename}`;
						}
					}

					if (options.verbose && log) {
						log.info`inbox:processClipping:written cid=${cid} file=${finalPath}`;
					}
				} else {
					// For dry-run, compute the expected final path
					const dir = dirname(filePath);
					const currentFilename = basename(filePath, ".md");
					const baseFilename = summaryResult.generatedTitle
						? sanitizeFilename(summaryResult.generatedTitle)
						: currentFilename;
					const newFilename = addEmojiPrefix(baseFilename, type);
					finalPath = join(dir, `${newFilename}.md`);
				}

				if (options.verbose && log) {
					log.info`inbox:processClipping:success cid=${cid} file=${finalPath} dryRun=${options.dryRun || false}`;
				}

				return {
					originalPath: filePath,
					convertedPath: finalPath,
					clippingType: type,
					enrichment,
					status: "success",
					deleted: false, // Not deleted - replaced in-place
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				if (log) {
					log.error`inbox:processClipping:error cid=${cid} file=${filePath} error=${errorMsg}`;
				}
				return {
					originalPath: filePath,
					clippingType: "generic", // Unknown type on error
					enrichment: {
						enrichmentSource: "none",
						enrichmentStatus: "failed",
						enrichmentError: "Processing failed before enrichment",
					},
					status: "failed",
					error: errorMsg,
					deleted: false,
				};
			}
		},
		{ context: { filePath, cid } },
	);
}

/**
 * Process all clippings in inbox.
 * Converts all raw clippings to typed notes, aggregates results,
 * and auto-commits changes (when configured).
 *
 * @param options - Processing options
 * @returns Batch processing results
 *
 * @example
 * ```typescript
 * const results = await processAllClippings({
 *   dryRun: false,
 *   verbose: true
 * });
 * console.log(`Processed: ${results.processed}`);
 * console.log(`Failed: ${results.failed}`);
 * ```
 */
export async function processAllClippings(
	options: ProcessOptions = {},
): Promise<ProcessBatchResult> {
	const cid = createCorrelationId();

	return observe(
		log,
		"inbox:processAllClippings",
		async () => {
			if (log) {
				log.info`inbox:processAllClippings:start cid=${cid}`;
			}

			// 1. Find all clippings
			const clippings = await findClippings();

			if (clippings.length === 0) {
				if (log) {
					log.info`inbox:processAllClippings:noClippings cid=${cid}`;
				}
				return {
					processed: 0,
					failed: 0,
					skipped: 0,
					results: [],
					byType: {
						article: 0,
						youtube: 0,
						recipe: 0,
						product: 0,
						github: 0,
						documentation: 0,
						social: 0,
						podcast: 0,
						book: 0,
						accommodation: 0,
						place: 0,
						restaurant: 0,
						generic: 0,
					},
				};
			}

			if (log) {
				log.info`inbox:processAllClippings:found cid=${cid} count=${clippings.length}`;
			}

			// 2. Process each one
			const results: ClippingProcessResult[] = [];
			for (const clipping of clippings) {
				const result = await processClipping(clipping, options);
				results.push(result);
			}

			// 3. Aggregate results
			const processed = results.filter((r) => r.status === "success").length;
			const failed = results.filter((r) => r.status === "failed").length;
			const skipped = results.filter((r) => r.status === "skipped").length;

			const byType: Record<ClippingType, number> = {
				article: 0,
				youtube: 0,
				recipe: 0,
				product: 0,
				github: 0,
				documentation: 0,
				social: 0,
				podcast: 0,
				book: 0,
				accommodation: 0,
				place: 0,
				restaurant: 0,
				generic: 0,
			};

			for (const result of results) {
				if (result.status === "success") {
					byType[result.clippingType]++;
				}
			}

			// 4. Skip auto-commit - user should review processed clippings before committing
			// Use `git add . && git commit -m "chore(inbox): process clippings"` after review
			if (log && processed > 0) {
				log.info`inbox:processAllClippings:noAutoCommit cid=${cid} hint=review-then-commit`;
			}

			if (log) {
				log.info`inbox:processAllClippings:complete cid=${cid} processed=${processed} failed=${failed} skipped=${skipped}`;
			}

			return {
				processed,
				failed,
				skipped,
				results,
				byType,
			};
		},
		{ context: { cid } },
	);
}
