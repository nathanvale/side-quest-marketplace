/**
 * Enrichment Pipeline
 *
 * Orchestrates the enrichment stage of inbox processing.
 * Uses Strategy Pattern to apply type-specific enrichments before classification.
 *
 * Pipeline position: Scan → **Enrich** → Classify → Suggest → Review → Execute
 *
 * The pipeline:
 * 1. Receives files from the scan stage
 * 2. Checks each registered strategy in priority order
 * 3. Applies the first matching strategy's enrichment
 * 4. Updates file frontmatter with enrichment data
 * 5. Passes enriched files to the classification stage
 *
 * @module inbox/enrich/pipeline
 */

import { parseFrontmatter, serializeFrontmatter } from "../../frontmatter";
import { atomicWriteFile } from "../../shared/atomic-fs";
import { enrichLogger } from "../../shared/logger";
import type { InboxFile } from "../scan/extractors";
import { applyBookmarkEnrichment } from "./strategies/bookmark-strategy";
import {
	applyYouTubeEnrichment,
	YouTubeEnrichmentError,
} from "./strategies/youtube-strategy";
import {
	BookmarkEnrichmentError,
	type EnrichmentContext,
	type EnrichmentOptions,
	type EnrichmentPipelineConfig,
	type EnrichmentPipelineResult,
	type EnrichmentResult,
	type EnrichmentStrategy,
} from "./types";

const log = enrichLogger;

// =============================================================================
// Default Strategies
// =============================================================================

// Import strategies
import { bookmarkEnrichmentStrategy } from "./strategies/bookmark-strategy";
import { youtubeEnrichmentStrategy } from "./strategies/youtube-strategy";

/**
 * Default enrichment strategies in priority order.
 * Higher priority strategies are checked first.
 */
export const DEFAULT_ENRICHMENT_STRATEGIES: readonly EnrichmentStrategy[] = [
	youtubeEnrichmentStrategy, // Priority 100
	bookmarkEnrichmentStrategy, // Priority 75 (disabled, but kept for reference)
	// Future strategies: PDFEnrichmentStrategy, ImageEnrichmentStrategy, etc.
];

// =============================================================================
// Pipeline Implementation
// =============================================================================

/**
 * Creates an enrichment pipeline with the given configuration.
 *
 * @param config - Pipeline configuration
 * @returns Pipeline functions for processing files
 *
 * @example
 * ```typescript
 * const pipeline = createEnrichmentPipeline({
 *   strategies: DEFAULT_ENRICHMENT_STRATEGIES,
 *   vaultPath: "/path/to/vault",
 * });
 *
 * const result = await pipeline.processFile(inboxFile);
 * if (result.enriched) {
 *   console.log(`Enriched with ${result.strategyId}`);
 * }
 * ```
 */
export function createEnrichmentPipeline(config: EnrichmentPipelineConfig) {
	// Sort strategies by priority (highest first)
	const sortedStrategies = [...config.strategies].sort(
		(a, b) => b.priority - a.priority,
	);

	/**
	 * Find the first strategy that can enrich this file.
	 */
	function findMatchingStrategy(
		ctx: EnrichmentContext,
	): EnrichmentStrategy | null {
		const strategyIds = sortedStrategies.map((s) => s.id);
		if (log) {
			log.debug`Strategy evaluation file=${ctx.file.filename} strategies=${JSON.stringify(strategyIds)}`;
		}

		for (const strategy of sortedStrategies) {
			const eligibility = strategy.canEnrich(ctx);
			if (eligibility.eligible) {
				if (log) {
					log.debug`Strategy matched file=${ctx.file.filename} strategy=${strategy.id}`;
				}
				return strategy;
			}
			if (log) {
				log.debug`Strategy rejected file=${ctx.file.filename} strategy=${strategy.id} reason=${eligibility.reason}`;
			}
		}
		if (log) {
			log.debug`No strategy matched file=${ctx.file.filename}`;
		}
		return null;
	}

	/**
	 * Process a single file through the enrichment pipeline.
	 *
	 * @param file - The inbox file to process
	 * @param options - Optional enrichment options (includes cid for logging)
	 * @returns Pipeline result with enrichment status and data
	 */
	async function processFile(
		file: InboxFile,
		options?: EnrichmentOptions,
	): Promise<EnrichmentPipelineResult> {
		const startTime = Date.now();
		const cid = options?.cid ?? "no-cid";
		if (log) {
			log.info`Enrichment starting file=${file.filename} cid=${cid}`;
		}

		// Read and parse file content
		const content = await Bun.file(file.path).text();
		const { attributes: frontmatter, body } = parseFrontmatter(content);

		// Build context for strategies
		const ctx: EnrichmentContext = {
			file,
			frontmatter,
			body,
			vaultPath: config.vaultPath,
		};

		// Find matching strategy
		const strategy = findMatchingStrategy(ctx);

		if (!strategy) {
			// No strategy matched - return unchanged
			if (log) {
				log.debug`Enrichment skipped file=${file.filename} reason="No matching strategy" cid=${cid}`;
			}
			return {
				file,
				frontmatter,
				enriched: false,
				result: { type: "none", reason: "No matching enrichment strategy" },
			};
		}

		// Apply enrichment
		try {
			const mergedOptions: EnrichmentOptions = {
				...config.defaultOptions,
				...options,
				cid, // Ensure cid is always present
			};
			const result = await strategy.enrich(ctx, mergedOptions);

			// Apply enrichment to frontmatter and body based on result type
			let updatedFrontmatter = frontmatter;
			let updatedBody = body;

			if (result.type === "bookmark") {
				updatedFrontmatter = applyBookmarkEnrichment(frontmatter, result.data);
			} else if (result.type === "youtube") {
				updatedFrontmatter = applyYouTubeEnrichment(frontmatter, result.data);

				// Update body: replace placeholder or append transcript
				if (body.includes("<!-- transcript:pending -->")) {
					updatedBody = body.replace(
						"<!-- transcript:pending -->",
						result.data.transcript,
					);
				} else {
					updatedBody = `${body}\n\n## Transcript\n\n${result.data.transcript}`;
				}
			}

			// Write updated content back to file
			const updatedContent = serializeFrontmatter(
				updatedFrontmatter,
				updatedBody,
			);
			await atomicWriteFile(file.path, updatedContent);

			const duration = ((Date.now() - startTime) / 1000).toFixed(2);
			if (log) {
				log.info`Enrichment complete file=${file.filename} strategy=${strategy.id} duration=${duration}s cid=${cid}`;
			}

			return {
				file,
				frontmatter: updatedFrontmatter,
				enriched: true,
				strategyId: strategy.id,
				result,
			};
		} catch (error) {
			// Handle enrichment failures with graceful degradation
			const duration = ((Date.now() - startTime) / 1000).toFixed(2);

			// Preserve original error type for proper categorization
			let enrichmentError: BookmarkEnrichmentError | YouTubeEnrichmentError;

			if (error instanceof BookmarkEnrichmentError) {
				enrichmentError = error;
			} else if (error instanceof YouTubeEnrichmentError) {
				enrichmentError = error;
			} else {
				// Unknown error - categorize based on strategy type
				if (strategy.id === "youtube-transcript") {
					enrichmentError = new YouTubeEnrichmentError(
						error instanceof Error ? error.message : "Unknown error",
						"YOUTUBE_NETWORK_ERROR",
						(frontmatter.video_id as string) || "unknown",
						true,
					);
				} else {
					enrichmentError = new BookmarkEnrichmentError(
						error instanceof Error ? error.message : "Unknown error",
						"FIRECRAWL_ERROR",
						(frontmatter.url as string) || "unknown",
						false,
					);
				}
			}

			if (log) {
				log.warn`Enrichment failed file=${file.filename} strategy=${strategy.id} error=${enrichmentError.message} duration=${duration}s cid=${cid}`;
			}

			// Graceful degradation: Mark file as failed so we don't retry forever
			let updatedFrontmatter = frontmatter;

			if (strategy.id === "youtube-transcript") {
				// Mark YouTube transcript as failed (not pending)
				updatedFrontmatter = {
					...frontmatter,
					transcript_status: "failed",
					transcript_error: enrichmentError.message,
					transcript_error_code:
						enrichmentError instanceof YouTubeEnrichmentError
							? enrichmentError.code
							: "UNKNOWN",
					transcript_failed_at: new Date().toISOString(),
				};

				// Write updated frontmatter to file
				const updatedContent = serializeFrontmatter(updatedFrontmatter, body);
				await atomicWriteFile(file.path, updatedContent);

				if (log) {
					log.info`Marked transcript as failed file=${file.filename} error_code=${updatedFrontmatter.transcript_error_code} cid=${cid}`;
				}
			} else if (strategy.id === "bookmark-content") {
				// Mark bookmark as failed (not pending)
				updatedFrontmatter = {
					...frontmatter,
					enrichment_status: "failed",
					enrichment_error: enrichmentError.message,
					enrichment_error_code:
						enrichmentError instanceof BookmarkEnrichmentError
							? enrichmentError.code
							: "UNKNOWN",
					enrichment_failed_at: new Date().toISOString(),
				};

				// Write updated frontmatter to file
				const updatedContent = serializeFrontmatter(updatedFrontmatter, body);
				await atomicWriteFile(file.path, updatedContent);

				if (log) {
					log.info`Marked bookmark as failed file=${file.filename} error_code=${updatedFrontmatter.enrichment_error_code} cid=${cid}`;
				}
			}

			// Return non-blocking error result
			return {
				file,
				frontmatter: updatedFrontmatter,
				enriched: false,
				strategyId: strategy.id,
				error: enrichmentError,
			};
		}
	}

	/**
	 * Check if a file needs enrichment (without performing it).
	 *
	 * @param file - The inbox file to check
	 * @returns True if a strategy can enrich this file
	 */
	async function needsEnrichment(file: InboxFile): Promise<boolean> {
		const content = await Bun.file(file.path).text();
		const { attributes: frontmatter, body } = parseFrontmatter(content);

		const ctx: EnrichmentContext = {
			file,
			frontmatter,
			body,
			vaultPath: config.vaultPath,
		};

		return findMatchingStrategy(ctx) !== null;
	}

	/**
	 * Get the strategy that would be used for a file (without enriching).
	 *
	 * @param file - The inbox file to check
	 * @returns Strategy ID or null if none matches
	 */
	async function getMatchingStrategyId(
		file: InboxFile,
	): Promise<string | null> {
		const content = await Bun.file(file.path).text();
		const { attributes: frontmatter, body } = parseFrontmatter(content);

		const ctx: EnrichmentContext = {
			file,
			frontmatter,
			body,
			vaultPath: config.vaultPath,
		};

		const strategy = findMatchingStrategy(ctx);
		return strategy?.id ?? null;
	}

	return {
		processFile,
		needsEnrichment,
		getMatchingStrategyId,
		strategies: sortedStrategies,
	};
}

/**
 * Type for the enrichment pipeline instance.
 */
export type EnrichmentPipeline = ReturnType<typeof createEnrichmentPipeline>;

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Creates a default enrichment pipeline with all built-in strategies.
 *
 * @param vaultPath - Path to the vault
 * @param options - Default options for all strategies
 * @returns Configured enrichment pipeline
 */
export function createDefaultEnrichmentPipeline(
	vaultPath: string,
	options?: EnrichmentOptions,
): EnrichmentPipeline {
	return createEnrichmentPipeline({
		strategies: DEFAULT_ENRICHMENT_STRATEGIES,
		vaultPath,
		defaultOptions: options,
	});
}

/**
 * Checks if an enrichment result indicates success.
 */
export function isEnrichmentSuccess(
	result: EnrichmentResult,
): result is Exclude<EnrichmentResult, { type: "none" }> {
	return result.type !== "none";
}
