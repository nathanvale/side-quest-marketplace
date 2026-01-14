/**
 * Firecrawl Enrichment Module
 *
 * Fetches content for non-YouTube clippings using the Firecrawl API.
 * Provides two methods based on clipping type:
 * - Articles/docs/generic: `scrape` for clean markdown (1 credit)
 * - Recipes: `extract` with schema for structured data (5-10 credits)
 *
 * @module inbox/enrich/firecrawl-enrichment
 */

import { createFirecrawlClient } from "@sidequest/firecrawl/client";
import type { FirecrawlResult } from "@sidequest/firecrawl/types";
import { enrichLogger } from "../../shared/logger";
import type { ClippingType } from "./strategies/clipping-types";

const log = enrichLogger;

/**
 * Recipe extraction schema for structured data.
 * Used with Firecrawl's extract endpoint to parse recipe pages.
 */
const RECIPE_SCHEMA = {
	type: "object",
	properties: {
		title: { type: "string", description: "Recipe title" },
		description: {
			type: "string",
			description: "Brief recipe description or summary",
		},
		prepTime: {
			type: "string",
			description: "Preparation time (e.g., '15 min')",
		},
		cookTime: { type: "string", description: "Cooking time (e.g., '30 min')" },
		servings: { type: "string", description: "Number of servings (e.g., '4')" },
		ingredients: {
			type: "array",
			items: { type: "string" },
			description: "List of ingredients",
		},
		instructions: {
			type: "array",
			items: { type: "string" },
			description: "Step-by-step instructions",
		},
	},
	required: ["title"],
} as const;

/**
 * Accommodation extraction schema for booking confirmations.
 * Used with Firecrawl's extract endpoint to parse hotel/rental bookings.
 * More token-efficient than scraping full page + LLM extraction.
 */
const ACCOMMODATION_SCHEMA = {
	type: "object",
	properties: {
		propertyName: {
			type: "string",
			description: "Name of the hotel, apartment, or rental property",
		},
		checkIn: {
			type: "string",
			description: "Check-in date in YYYY-MM-DD format",
		},
		checkOut: {
			type: "string",
			description: "Check-out date in YYYY-MM-DD format",
		},
		location: {
			type: "string",
			description:
				"City or area where property is located (e.g., 'Sydney', 'Melbourne CBD')",
		},
		totalPrice: {
			type: "string",
			description: "Total price with currency (e.g., '548.64 AUD', '€299')",
		},
		nights: {
			type: "number",
			description: "Number of nights",
		},
		guests: {
			type: "number",
			description: "Number of guests",
		},
		roomType: {
			type: "string",
			description: "Type of room booked (e.g., 'Standard King Room')",
		},
		address: {
			type: "string",
			description: "Full address of the property",
		},
		confirmationNumber: {
			type: "string",
			description: "Booking confirmation or reservation number",
		},
	},
	required: ["propertyName"],
} as const;

/**
 * Restaurant extraction schema for structured data.
 * Used with Firecrawl's extract endpoint to parse restaurant pages.
 */
const RESTAURANT_SCHEMA = {
	type: "object",
	properties: {
		name: {
			type: "string",
			description: "Restaurant name",
		},
		cuisine: {
			type: "string",
			description: "Cuisine type (e.g., 'Italian', 'Japanese', 'French')",
		},
		suburb: {
			type: "string",
			description: "Suburb or neighborhood where restaurant is located",
		},
		city: {
			type: "string",
			description: "City where restaurant is located",
		},
		priceRange: {
			type: "string",
			description: "Price range indicator ($ to $$$$)",
		},
		bookingUrl: {
			type: "string",
			description: "URL for making reservations",
		},
		menuUrl: {
			type: "string",
			description: "URL for viewing the menu",
		},
		phone: {
			type: "string",
			description: "Restaurant phone number",
		},
		address: {
			type: "string",
			description: "Full street address",
		},
		chef: {
			type: "string",
			description: "Head chef or notable chef name",
		},
		specialties: {
			type: "array",
			items: { type: "string" },
			description: "Signature dishes or specialties",
		},
		ambiance: {
			type: "string",
			description: "Description of the ambiance, vibe, or dining experience",
		},
	},
	required: ["name"],
} as const;

/**
 * Page metadata from Firecrawl scrape response.
 * Contains Open Graph tags, meta description, title, etc.
 */
export interface FirecrawlMetadata {
	/** Page title (from <title> or og:title) */
	title?: string;
	/** Meta description (from description or og:description) */
	description?: string;
	/** Open Graph title */
	ogTitle?: string;
	/** Open Graph description */
	ogDescription?: string;
	/** Open Graph site name */
	ogSiteName?: string;
	/** Allow additional OG/meta fields */
	[key: string]: unknown;
}

/**
 * Result of Firecrawl enrichment.
 * Contains either markdown content or structured data.
 */
export interface FirecrawlEnrichment {
	/** Markdown content (from scrape) */
	readonly markdown?: string;
	/** Structured data (from extract) */
	readonly structuredData?: Record<string, unknown>;
	/** Page metadata from scrape (Open Graph, meta tags) */
	readonly metadata?: FirecrawlMetadata;
	/** Which Firecrawl method was used */
	readonly method: "scrape" | "extract";
	/** ISO timestamp of when enrichment was performed */
	readonly enrichedAt: string;
	/** Whether API key was available */
	readonly apiKeyAvailable: boolean;
}

/**
 * Enrichment status indicating why enrichment was skipped or failed.
 */
export type EnrichmentStatus = "success" | "skipped" | "failed";

/**
 * Result wrapper with status.
 */
export interface EnrichmentResult {
	readonly status: EnrichmentStatus;
	readonly enrichment?: FirecrawlEnrichment;
	readonly reason?: string;
	readonly error?: string;
}

/**
 * Determine if this clipping type should use Firecrawl.
 * YouTube uses YouTube MCP, not Firecrawl.
 *
 * @param type - Clipping type
 * @returns True if Firecrawl should be used
 */
export function shouldUseFirecrawl(type: ClippingType): boolean {
	return type !== "youtube";
}

/**
 * Determine which Firecrawl method to use for this type.
 * Recipes and restaurants use extract for structured data, others use scrape.
 *
 * @param type - Clipping type
 * @returns Firecrawl method to use
 */
export function getFirecrawlMethod(type: ClippingType): "scrape" | "extract" {
	// Use extract for types where we need structured data
	// - Recipes: ingredients, instructions, times
	// - Restaurants: cuisine, booking URL, specialties
	// Accommodation pages often require auth, so scrape + LLM works better
	if (type === "recipe" || type === "restaurant") return "extract";
	return "scrape";
}

/**
 * Get the appropriate extraction schema for a clipping type.
 *
 * @param type - Clipping type
 * @returns Extraction schema or undefined if not applicable
 */
function getExtractionSchema(
	type: ClippingType,
):
	| typeof RECIPE_SCHEMA
	| typeof ACCOMMODATION_SCHEMA
	| typeof RESTAURANT_SCHEMA
	| undefined {
	if (type === "recipe") return RECIPE_SCHEMA;
	if (type === "accommodation") return ACCOMMODATION_SCHEMA;
	if (type === "restaurant") return RESTAURANT_SCHEMA;
	return undefined;
}

/**
 * Check if response is an error.
 * Firecrawl client returns union type T | FirecrawlError.
 *
 * @param result - Result from Firecrawl client
 * @returns True if result is an error
 */
function isFirecrawlError<T extends { success: boolean }>(
	result: FirecrawlResult<T>,
): result is { success: false; error: string; statusCode?: number } {
	return (
		typeof result === "object" &&
		result !== null &&
		"success" in result &&
		result.success === false
	);
}

/**
 * Enrich a clipping using Firecrawl.
 * Uses scrape for articles/docs, extract for recipes.
 *
 * @param url - URL to scrape/extract
 * @param type - Clipping type (determines method)
 * @returns Enrichment result with status
 *
 * @example
 * ```typescript
 * const result = await enrichWithFirecrawl("https://example.com/article", "article");
 * if (result.status === "success") {
 *   console.log(result.enrichment.markdown);
 * }
 * ```
 */
export async function enrichWithFirecrawl(
	url: string,
	type: ClippingType,
): Promise<EnrichmentResult> {
	// Check if API key is available
	const apiKey = process.env.FIRECRAWL_API_KEY;
	if (!apiKey) {
		if (log) {
			log.warn`Firecrawl enrichment skipped url=${url} reason="No API key"`;
		}
		return {
			status: "skipped",
			reason: "FIRECRAWL_API_KEY not set",
		};
	}

	// Create client
	const client = createFirecrawlClient({ apiKey });
	const method = getFirecrawlMethod(type);

	if (log) {
		log.info`Firecrawl enrichment starting url=${url} method=${method} type=${type}`;
	}

	try {
		if (method === "scrape") {
			// Scrape for markdown content
			const response = await client.scrape({
				url,
				formats: ["markdown"],
				onlyMainContent: true,
			});

			if (isFirecrawlError(response)) {
				if (log) {
					log.error`Firecrawl scrape failed url=${url} error=${response.error}`;
				}
				return {
					status: "failed",
					error: response.error,
				};
			}

			const markdown = response.data?.markdown;
			const metadata = response.data?.metadata as FirecrawlMetadata | undefined;

			if (!markdown) {
				if (log) {
					log.warn`Firecrawl scrape returned no content url=${url}`;
				}
				return {
					status: "failed",
					error: "No markdown content returned",
				};
			}

			if (log) {
				log.info`Firecrawl scrape success url=${url} contentLength=${markdown.length} hasMetadata=${!!metadata}`;
			}

			return {
				status: "success",
				enrichment: {
					markdown,
					metadata,
					method: "scrape",
					enrichedAt: new Date().toISOString(),
					apiKeyAvailable: true,
				},
			};
		}

		// Extract for structured data (recipes, restaurants)
		const schema = getExtractionSchema(type);
		if (!schema) {
			if (log) {
				log.error`Firecrawl extract called without schema url=${url} type=${type}`;
			}
			return {
				status: "failed",
				error: `No extraction schema defined for type: ${type}`,
			};
		}

		// Prompt guides LLM extraction - important for better results
		const promptByType: Record<string, string> = {
			recipe:
				"Extract recipe details including title, ingredients, instructions, prep time, cook time, and servings.",
			restaurant:
				"Extract restaurant details including name, cuisine type, location (suburb/city), price range, booking URL, menu URL, phone, address, chef name, specialties, and ambiance description.",
			accommodation:
				"Extract booking details including property name, check-in date, check-out date, location, total price, number of nights, guests, room type, address, and confirmation number.",
		};

		const extractResponse = await client.extract({
			urls: [url],
			schema,
			prompt: promptByType[type] ?? `Extract ${type} details from the page.`,
		});

		if (isFirecrawlError(extractResponse)) {
			if (log) {
				log.error`Firecrawl extract failed url=${url} error=${extractResponse.error}`;
			}
			return {
				status: "failed",
				error: extractResponse.error,
			};
		}

		// Extract returns a job ID - need to poll for status
		const jobId = extractResponse.id;
		if (!jobId) {
			if (log) {
				log.error`Firecrawl extract returned no job ID url=${url}`;
			}
			return {
				status: "failed",
				error: "No job ID returned from extract",
			};
		}

		// Poll for completion (max 60s, check every 2s)
		// Firecrawl uses "pending" initially, then "processing" while working
		let statusResponse = await client.getExtractStatus(jobId);
		let attempts = 0;
		const maxAttempts = 30;

		while (
			!isFirecrawlError(statusResponse) &&
			(statusResponse.status === "pending" ||
				statusResponse.status === "processing") &&
			attempts < maxAttempts
		) {
			await sleep(2000);
			statusResponse = await client.getExtractStatus(jobId);
			attempts++;
			if (log && attempts % 5 === 0) {
				const currentStatus = isFirecrawlError(statusResponse)
					? "error"
					: statusResponse.status;
				log.debug`Firecrawl extract polling url=${url} jobId=${jobId} attempt=${attempts} status=${currentStatus}`;
			}
		}

		if (isFirecrawlError(statusResponse)) {
			if (log) {
				log.error`Firecrawl extract status check failed url=${url} jobId=${jobId} error=${statusResponse.error}`;
			}
			return {
				status: "failed",
				error: statusResponse.error,
			};
		}

		if (
			statusResponse.status === "pending" ||
			statusResponse.status === "processing"
		) {
			if (log) {
				log.error`Firecrawl extract timeout url=${url} jobId=${jobId} status=${statusResponse.status}`;
			}
			return {
				status: "failed",
				error: "Extract job timed out after 30s",
			};
		}

		if (statusResponse.status === "failed") {
			if (log) {
				log.error`Firecrawl extract job failed url=${url} jobId=${jobId} error=${statusResponse.error}`;
			}
			return {
				status: "failed",
				error: statusResponse.error ?? "Extract job failed",
			};
		}

		const structuredData = statusResponse.data;
		if (!structuredData) {
			if (log) {
				log.warn`Firecrawl extract returned no data url=${url} jobId=${jobId}`;
			}
			return {
				status: "failed",
				error: "No structured data returned",
			};
		}

		if (log) {
			log.info`Firecrawl extract success url=${url} jobId=${jobId}`;
			log.debug`Firecrawl extract statusResponse url=${url} fullResponse=${JSON.stringify(statusResponse).slice(0, 1000)}`;
			log.debug`Firecrawl extract data url=${url} dataType=${typeof structuredData} isArray=${Array.isArray(structuredData)} keys=${Object.keys(structuredData).join(",")} data=${JSON.stringify(structuredData).slice(0, 500)}`;
		}

		return {
			status: "success",
			enrichment: {
				structuredData,
				method: "extract",
				enrichedAt: new Date().toISOString(),
				apiKeyAvailable: true,
			},
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (log) {
			log.error`Firecrawl enrichment error url=${url} method=${method} error=${errorMessage}`;
		}
		return {
			status: "failed",
			error: errorMessage,
		};
	}
}

/**
 * Sleep for specified milliseconds.
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
