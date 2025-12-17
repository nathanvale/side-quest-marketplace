/**
 * Inbox Processing Engine
 *
 * Factory function and implementation for the inbox processing engine.
 * This is the main entry point for scan/execute/edit operations.
 *
 * @module inbox/engine
 */

import { basename, join } from "node:path";
import { readDir } from "@sidequest/core/fs";
import pLimit from "p-limit";
import { loadConfig } from "../../config/index";
import { ensureGitGuard } from "../../git/index";
import {
	createCorrelationId,
	executeLogger,
	inboxLogger,
	initLoggerWithNotice,
} from "../../shared/logger";
import { buildSuggestion, DEFAULT_CLASSIFIERS } from "../classify/classifiers";
import {
	checkPdfToText,
	combineHeuristics,
} from "../classify/detection/pdf-processor";
import {
	buildInboxPrompt,
	type DocumentTypeResult,
	parseDetectionResponse,
} from "../classify/llm-classifier";
import { createRegistry, hashFile } from "../registry/processed-registry";
import {
	createInboxFile,
	type ExtractorRegistry,
	getDefaultRegistry,
	type InboxFile,
} from "../scan/extractors";
import {
	extractFrontmatterOnly,
	type MarkdownExtractionMetadata,
} from "../scan/extractors/markdown";
import { createInboxError } from "../shared/errors";
import {
	type ChallengeSuggestion,
	type CreateNoteSuggestion,
	createSuggestionId,
	type ExecuteOptions,
	type ExecutionResult,
	type InboxEngine,
	type InboxEngineConfig,
	type InboxSuggestion,
	isCreateNoteSuggestion,
	type ScanOptions,
	type SuggestionId,
	validateInboxEngineConfig,
} from "../types";
import { generateTitle, parseWikilink } from "./engine-utils";
import { callLLM, callLLMWithMetadata } from "./llm";
import { executeSuggestion } from "./operations";
import { generateReport } from "./operations/report";
import { cleanupOrphanedStaging } from "./staging";
import { getVaultAreas, getVaultProjects, type VaultContext } from "./vault";

// =============================================================================
// Engine Factory
// =============================================================================

/**
 * Creates a new inbox processing engine.
 *
 * The engine provides methods to:
 * - Scan the inbox for items and generate suggestions
 * - Execute approved suggestions (create notes, move attachments)
 * - Edit suggestions with additional prompts
 * - Generate markdown reports
 *
 * @param config - Engine configuration including vault path and options
 * @returns InboxEngine instance
 * @throws Error if configuration is invalid
 *
 * @example
 * ```typescript
 * const engine = createInboxEngine({
 *   vaultPath: "/path/to/vault",
 *   inboxFolder: "00 Inbox",
 * });
 *
 * const suggestions = await engine.scan();
 * const results = await engine.execute(suggestions.map(s => s.id));
 * ```
 */
export function createInboxEngine(config: InboxEngineConfig): InboxEngine {
	// Validate configuration before proceeding
	validateInboxEngineConfig(config);
	// Apply defaults to config
	// Note: fileIO concurrency is defined but execution is sequential by design
	// to ensure registry saves are atomic and don't conflict. The config option
	// is preserved for future parallel execution support.
	const resolvedConfig: Required<
		Omit<InboxEngineConfig, "llmModel" | "concurrency" | "llmClient">
	> &
		Pick<InboxEngineConfig, "llmModel" | "concurrency" | "llmClient"> = {
		vaultPath: config.vaultPath,
		inboxFolder: config.inboxFolder ?? "00 Inbox",
		attachmentsFolder: config.attachmentsFolder ?? "Attachments",
		templatesFolder: config.templatesFolder ?? "Templates",
		llmProvider: config.llmProvider ?? "haiku",
		llmModel: config.llmModel,
		llmClient: config.llmClient,
		concurrency: config.concurrency ?? {
			pdfExtraction: 5,
			llmCalls: 3,
			fileIO: 10,
		},
	};

	// Use injected LLM client if provided, otherwise use real callLLM
	const llmClient = resolvedConfig.llmClient ?? callLLM;

	// In-memory cache of suggestions from last scan
	// Used by execute() to look up suggestions by ID
	const suggestionCache = new Map<string, InboxSuggestion>();

	if (inboxLogger) {
		inboxLogger.debug`Engine created vault=${resolvedConfig.vaultPath}`;
	}

	return {
		scan,
		execute,
		editWithPrompt,
		challenge,
		generateReport: generateReportMethod,
	};

	// =========================================================================
	// Method Implementations
	// =========================================================================

	/**
	 * Load registry and clean up orphaned staging files.
	 * @internal
	 */
	async function loadAndCleanRegistry(
		cid: string,
	): Promise<ReturnType<typeof createRegistry>> {
		const registry = createRegistry(resolvedConfig.vaultPath);
		await registry.load();
		await cleanupOrphanedStaging(resolvedConfig.vaultPath, registry, cid);
		return registry;
	}

	/**
	 * Find and filter supported files in the inbox.
	 * @internal
	 */
	async function findSupportedFiles(cid: string): Promise<{
		files: InboxFile[];
		extractorRegistry: ExtractorRegistry;
	} | null> {
		const inboxPath = join(
			resolvedConfig.vaultPath,
			resolvedConfig.inboxFolder,
		);

		// List files in inbox
		let files: string[];
		try {
			files = readDir(inboxPath);
		} catch (_error) {
			if (inboxLogger) {
				inboxLogger.warn`Inbox folder not found: ${inboxPath} cid=${cid}`;
			}
			return null;
		}

		// Get extractor registry and filter to supported files
		const extractorRegistry = await getDefaultRegistry();
		const supportedExtensions = new Set(
			extractorRegistry.getSupportedExtensions(),
		);

		// Convert to InboxFile and filter to supported formats
		const supportedFiles: InboxFile[] = files
			.map((f) => createInboxFile(join(inboxPath, f)))
			.filter((f) => supportedExtensions.has(f.extension));

		if (supportedFiles.length === 0) {
			if (inboxLogger) {
				inboxLogger.info`No supported files found in inbox cid=${cid}`;
			}
			return null;
		}

		return { files: supportedFiles, extractorRegistry };
	}

	/**
	 * Validate PDF extraction dependencies are available.
	 * @internal
	 */
	async function validateDependencies(cid: string): Promise<void> {
		const pdfCheck = await checkPdfToText();
		if (!pdfCheck.available) {
			if (inboxLogger) {
				inboxLogger.error`pdftotext not available: ${pdfCheck.error} cid=${cid}`;
			}
			throw createInboxError("DEP_PDFTOTEXT_MISSING", {
				cid,
				operation: "scan",
			});
		}
	}

	/**
	 * Build vault context for LLM prompts.
	 * @internal
	 */
	function buildVaultContext(): VaultContext {
		const paraConfig = loadConfig();
		return {
			areas: getVaultAreas(resolvedConfig.vaultPath, paraConfig.paraFolders),
			projects: getVaultProjects(
				resolvedConfig.vaultPath,
				paraConfig.paraFolders,
			),
		};
	}

	/**
	 * Context for processing a single inbox file.
	 * Groups related parameters for cleaner function signatures.
	 */
	interface ProcessFileContext {
		/** The inbox file to process */
		file: InboxFile;
		/** 0-based index in the file list */
		index: number;
		/** Total number of files being processed */
		total: number;
		/** Registry for tracking processed files */
		registry: ReturnType<typeof createRegistry>;
		/** Registry of available content extractors */
		extractorRegistry: ExtractorRegistry;
		/** Vault context for LLM prompts (areas, projects) */
		vaultContext: VaultContext;
		/** Concurrency limiter for extraction operations */
		extractionLimit: ReturnType<typeof pLimit>;
		/** Concurrency limiter for LLM calls */
		llmLimit: ReturnType<typeof pLimit>;
		/** Optional progress callback */
		onProgress?: ScanOptions["onProgress"];
		/** Correlation ID for logging */
		cid: string;
		/** Running statistics for LLM calls */
		llmStats: {
			successes: number;
			failures: number;
			fallbacks: number;
			lastError: string | undefined;
			lastFallbackReason: string | undefined;
			lastModelUsed: string | undefined;
		};
	}

	/**
	 * Resolve destination path from frontmatter fields.
	 * Returns undefined if routing fields are missing or invalid.
	 *
	 * @param frontmatter - Extracted frontmatter fields
	 * @param vaultContext - Vault context with areas and projects
	 * @returns Resolved destination path or undefined
	 * @internal
	 */
	function resolveDestinationFromFrontmatter(
		frontmatter: Record<string, unknown>,
		vaultContext: VaultContext,
	): string | undefined {
		const area = parseWikilink(frontmatter.area);
		const project = parseWikilink(frontmatter.project);

		// Project takes precedence over area if both are set
		if (project && vaultContext.projects.includes(project)) {
			return `01 Projects/${project}`;
		}
		if (area && vaultContext.areas.includes(area)) {
			return `02 Areas/${area}`;
		}

		// No valid routing fields found
		return undefined;
	}

	/**
	 * Process a single inbox file: hash check, extraction, LLM detection, suggestion building.
	 * @internal
	 */
	async function processSingleFile(
		ctx: ProcessFileContext,
	): Promise<InboxSuggestion | null> {
		const {
			file,
			index,
			total,
			registry,
			extractorRegistry,
			vaultContext,
			extractionLimit,
			llmLimit,
			onProgress,
			cid,
			llmStats,
		} = ctx;

		return extractionLimit(async () => {
			const { path: filePath, filename } = file;
			const progressBase = {
				index: index + 1,
				total,
				filename,
			} as const;

			// Calculate hash for dedup check and linking note title to attachment
			let fileHash: string;
			try {
				if (onProgress) {
					await onProgress({ ...progressBase, stage: "hash" });
				}
				fileHash = await hashFile(filePath);
				if (registry.isProcessed(fileHash)) {
					if (inboxLogger) {
						inboxLogger.debug`Skipping already processed: ${filename} cid=${cid}`;
					}
					if (onProgress) {
						await onProgress({ ...progressBase, stage: "skip" });
					}
					return null;
				}
			} catch (_error) {
				if (inboxLogger) {
					inboxLogger.warn`Failed to hash file: ${filename} cid=${cid}`;
				}
				if (onProgress) {
					await onProgress({
						...progressBase,
						stage: "error",
						error: "hash failed",
					});
				}
				return null;
			}

			// Find the right extractor for this file type
			const extractorMatch = extractorRegistry.findExtractor(file);
			if (!extractorMatch) {
				if (inboxLogger) {
					inboxLogger.warn`No extractor found for: ${filename} cid=${cid}`;
				}
				if (onProgress) {
					await onProgress({
						...progressBase,
						stage: "error",
						error: "no extractor available",
					});
				}
				return null;
			}

			// Extract text using the appropriate extractor
			let text: string;
			let extractedMetadata: unknown;
			try {
				if (onProgress) {
					await onProgress({ ...progressBase, stage: "extract" });
				}
				const extracted = await extractorMatch.extractor.extract(file, cid);
				text = extracted.text;
				extractedMetadata = extracted.metadata;
			} catch (error) {
				if (inboxLogger) {
					inboxLogger.warn`Failed to extract content: ${filename} cid=${cid}`;
				}
				if (onProgress) {
					await onProgress({
						...progressBase,
						stage: "error",
						error: error instanceof Error ? error.message : "extraction failed",
					});
				}
				// Return error suggestion
				const errorSuggestion: InboxSuggestion = {
					id: createSuggestionId(),
					source: join(resolvedConfig.inboxFolder, filename),
					processor: "attachments",
					confidence: "low",
					action: "skip",
					detectionSource: "none",
					reason: `Content extraction failed: ${error instanceof Error ? error.message : "unknown error"}`,
				};
				suggestionCache.set(errorSuggestion.id, errorSuggestion);
				return errorSuggestion;
			}

			// Two-path routing strategy for markdown notes with valid frontmatter:
			// - FAST PATH: type in classifier registry + has area/project → auto-route (skip LLM)
			// - LLM PATH: everything else → LLM suggests, user must confirm
			// Note: We extract frontmatter here and preserve it for later merging with LLM results
			let preservedFrontmatter: Record<string, unknown> | undefined;

			if (file.extension === ".md" && extractedMetadata) {
				const mdMetadata = extractedMetadata as MarkdownExtractionMetadata;
				if (mdMetadata.noteType && mdMetadata.hasFrontmatter) {
					// Check if noteType matches a known classifier
					const matchingClassifier = DEFAULT_CLASSIFIERS.find(
						(c) => c.id === mdMetadata.noteType && c.enabled,
					);

					if (matchingClassifier) {
						// Extract all fields from frontmatter for the suggestion
						const frontmatter = await extractFrontmatterOnly(file.path);

						// Preserve frontmatter for potential merge with LLM results
						preservedFrontmatter = frontmatter;

						// Try to resolve destination from frontmatter (fast-path check)
						const destination = resolveDestinationFromFrontmatter(
							frontmatter,
							vaultContext,
						);

						// FAST PATH: Has valid routing fields (area/project) → auto-route without LLM
						if (destination) {
							const area = parseWikilink(frontmatter.area);
							const project = parseWikilink(frontmatter.project);

							const suggestion: CreateNoteSuggestion = {
								id: createSuggestionId(),
								source: join(resolvedConfig.inboxFolder, filename),
								processor: "notes",
								confidence: "high", // Fast-path with valid routing = high confidence
								detectionSource: "frontmatter",
								action: "create-note",
								suggestedNoteType: mdMetadata.noteType,
								suggestedTitle:
									(frontmatter.title as string) ||
									generateTitle(filename, mdMetadata.noteType),
								suggestedArea: area,
								suggestedProject: project,
								suggestedDestination: destination,
								extractedFields: frontmatter,
								autoRoute: true, // Flag for auto-routing (skip user review)
								reason: `Pre-routed via frontmatter (${project ? "project" : "area"})`,
							};

							suggestionCache.set(suggestion.id, suggestion);
							if (onProgress) {
								await onProgress({
									...progressBase,
									stage: "done",
								});
							}
							if (inboxLogger) {
								inboxLogger.info`Fast-path file=${filename} type=${mdMetadata.noteType} destination=${destination} autoRoute=true cid=${cid}`;
							}
							return suggestion;
						}

						// LLM PATH: No valid routing fields OR routing fields don't exist in vault
						// Fall through to LLM classification to suggest destination
						if (inboxLogger) {
							inboxLogger.debug`LLM-path triggered: no valid routing fields file=${filename} type=${mdMetadata.noteType} cid=${cid}`;
						}
					}
				}
			}

			// Run heuristic detection
			const heuristicResult = combineHeuristics(filename, text);
			if (inboxLogger) {
				inboxLogger.debug`Heuristic result file=${filename} detected=${heuristicResult.detected} type=${heuristicResult.suggestedType ?? "none"} confidence=${heuristicResult.confidence.toFixed(2)} cid=${cid}`;
			}

			// Run LLM detection (with its own rate limit)
			const llmModel = resolvedConfig.llmModel ?? resolvedConfig.llmProvider;
			let llmResult: DocumentTypeResult | null = null;
			let llmFallbackUsed = false;
			let llmFallbackReason: string | undefined;
			let llmModelUsed: string | undefined;
			let llmErrorMessage: string | undefined;
			try {
				if (onProgress) {
					await onProgress({
						...progressBase,
						stage: "llm",
						model: llmModel,
					});
				}
				if (inboxLogger) {
					inboxLogger.debug`LLM starting file=${filename} model=${llmModel} cid=${cid}`;
				}
				llmResult = await llmLimit(async () => {
					const prompt = buildInboxPrompt(
						{
							content: text,
							filename,
							vaultContext,
						},
						DEFAULT_CLASSIFIERS,
					);
					// Use callLLMWithMetadata when no custom client is injected
					// This gives us fallback visibility in production
					if (!resolvedConfig.llmClient) {
						const llmCallResult = await callLLMWithMetadata(
							prompt,
							resolvedConfig.llmProvider,
							resolvedConfig.llmModel,
						);
						llmFallbackUsed = llmCallResult.isFallback;
						llmFallbackReason = llmCallResult.fallbackReason;
						llmModelUsed = llmCallResult.modelUsed;

						// Emit fallback progress update if fallback occurred
						if (llmFallbackUsed && onProgress) {
							await onProgress({
								...progressBase,
								stage: "llm",
								model: llmCallResult.modelUsed,
								isFallback: true,
								fallbackReason: llmCallResult.fallbackReason,
							});
						}

						if (inboxLogger) {
							inboxLogger.debug`LLM raw response file=${filename} length=${llmCallResult.response.length} preview=${llmCallResult.response.slice(0, 200).replace(/\n/g, " ")} cid=${cid}`;
						}
						const result = parseDetectionResponse(llmCallResult.response);
						if (inboxLogger) {
							inboxLogger.info`LLM success file=${filename} type=${result.documentType} confidence=${result.confidence.toFixed(2)} area=${result.suggestedArea ?? "none"} fallback=${llmFallbackUsed} cid=${cid}`;
						}
						return result;
					}

					// Custom llmClient provided (e.g., tests) - use as-is
					const response = await llmClient(
						prompt,
						resolvedConfig.llmProvider,
						resolvedConfig.llmModel,
					);
					if (inboxLogger) {
						inboxLogger.debug`LLM raw response file=${filename} length=${response.length} preview=${response.slice(0, 200).replace(/\n/g, " ")} cid=${cid}`;
					}
					const result = parseDetectionResponse(response);
					if (inboxLogger) {
						inboxLogger.info`LLM success file=${filename} type=${result.documentType} confidence=${result.confidence.toFixed(2)} area=${result.suggestedArea ?? "none"} cid=${cid}`;
					}
					return result;
				});
				llmStats.successes += 1;
				if (llmFallbackUsed) {
					llmStats.fallbacks += 1;
					llmStats.lastFallbackReason = llmFallbackReason;
				}
				llmStats.lastModelUsed = llmModelUsed ?? llmModel;
			} catch (error) {
				const errorMsg =
					error instanceof Error ? error.message : "unknown error";
				if (inboxLogger) {
					inboxLogger.warn`LLM detection failed: ${filename} - ${errorMsg} cid=${cid}`;
				}
				llmStats.failures += 1;
				llmStats.lastError = errorMsg;
				llmResult = null;
				llmErrorMessage = errorMsg;
			}

			// If LLM failed and we have a markdown file, extract frontmatter for fallback data
			let fallbackExtractedFields: Record<string, unknown> | undefined;
			if (llmErrorMessage && file.extension === ".md") {
				try {
					fallbackExtractedFields = await extractFrontmatterOnly(file.path);
					if (inboxLogger) {
						inboxLogger.debug`Extracted fallback frontmatter fields=${Object.keys(fallbackExtractedFields).join(", ")} file=${filename} cid=${cid}`;
					}
				} catch (err) {
					if (inboxLogger) {
						inboxLogger.warn`Failed to extract fallback frontmatter file=${filename} error=${err instanceof Error ? err.message : "unknown"} cid=${cid}`;
					}
				}
			}

			// Inject LLM error into llmResult for buildSuggestion to handle
			if (llmErrorMessage) {
				// Create a synthetic llmResult with error warnings
				llmResult = {
					documentType: heuristicResult.suggestedType || "generic",
					confidence: 0, // Low confidence since LLM failed
					extractionWarnings: [
						// Map error messages to user-friendly warnings
						llmErrorMessage.includes("timeout") ||
						llmErrorMessage.includes("ETIMEDOUT")
							? "LLM service timeout - using heuristic classification"
							: llmErrorMessage.includes("429") ||
									llmErrorMessage.toLowerCase().includes("rate limit")
								? "LLM rate limit exceeded - using heuristic classification"
								: llmErrorMessage.includes("ECONNREFUSED") ||
										llmErrorMessage.toLowerCase().includes("unavailable")
									? "LLM service unavailable - using heuristic classification"
									: `LLM error: ${llmErrorMessage}`,
					],
					extractedFields: fallbackExtractedFields,
				};
			}

			// Merge preserved frontmatter with LLM extracted fields
			// Original frontmatter values take precedence (they're already validated)
			// LLM fills in gaps for missing fields only
			if (preservedFrontmatter && llmResult?.extractedFields) {
				const mergedFields = {
					...llmResult.extractedFields,
					...preservedFrontmatter, // Frontmatter overrides LLM values
				};
				llmResult = {
					...llmResult,
					extractedFields: mergedFields,
				};
				if (inboxLogger) {
					inboxLogger.debug`Merged frontmatter with LLM fields file=${filename} frontmatterKeys=${Object.keys(preservedFrontmatter).join(", ")} mergedKeys=${Object.keys(mergedFields).join(", ")} cid=${cid}`;
				}
			} else if (
				preservedFrontmatter &&
				!llmResult?.extractedFields &&
				llmResult
			) {
				// LLM didn't extract any fields, use frontmatter as the extracted fields
				llmResult = {
					...llmResult,
					extractedFields: preservedFrontmatter,
				};
				if (inboxLogger) {
					inboxLogger.debug`Using frontmatter as extracted fields (LLM had none) file=${filename} cid=${cid}`;
				}
			}

			// Build suggestion
			const suggestion = buildSuggestion({
				filename,
				inboxFolder: resolvedConfig.inboxFolder,
				heuristicResult,
				llmResult,
				hash: fileHash,
			});

			// Log the final suggestion source
			if (inboxLogger) {
				const llmConfidence = llmResult?.confidence ?? 0;
				const llmType = llmResult?.documentType ?? "none";
				const source =
					llmResult !== null && llmConfidence >= 0.7
						? heuristicResult.detected &&
							heuristicResult.suggestedType === llmType
							? "llm+heuristic"
							: "llm"
						: heuristicResult.detected
							? "heuristic"
							: "none";
				const noteType = isCreateNoteSuggestion(suggestion)
					? suggestion.suggestedNoteType
					: "n/a";
				inboxLogger.info`Suggestion built file=${filename} action=${suggestion.action} confidence=${suggestion.confidence} type=${noteType} source=${source} reason=${suggestion.reason} cid=${cid}`;
			}

			suggestionCache.set(suggestion.id, suggestion);
			if (onProgress) {
				await onProgress({
					...progressBase,
					stage: "done",
					llmFailures: llmStats.failures,
					llmError: llmStats.lastError,
					llmModelUsed: llmModelUsed ?? llmStats.lastModelUsed,
					llmFallbackUsed: llmFallbackUsed,
				});
			}
			return suggestion;
		});
	}

	/**
	 * Log scan statistics.
	 * @internal
	 */
	function logScanStatistics(
		suggestions: InboxSuggestion[],
		durationMs: number,
		cid: string,
		llmStats: { successes: number; failures: number },
	): void {
		const confidenceCounts = suggestions.reduce(
			(counts, suggestion) => {
				counts[suggestion.confidence] += 1;
				return counts;
			},
			{ high: 0, medium: 0, low: 0 },
		);
		const actionCounts = suggestions.reduce(
			(counts, suggestion) => {
				const key = suggestion.action;
				counts[key] = (counts[key] ?? 0) + 1;
				return counts;
			},
			{} as Record<string, number>,
		);

		if (inboxLogger) {
			inboxLogger.info`Scan complete suggestions=${suggestions.length} durationMs=${durationMs} llmSuccesses=${llmStats.successes} llmFailures=${llmStats.failures} cid=${cid}`;
			inboxLogger.debug`Scan breakdown confidence=${JSON.stringify(confidenceCounts)} actions=${JSON.stringify(actionCounts)} durationMs=${durationMs} cid=${cid}`;

			// Warn if LLM appears unavailable
			if (llmStats.failures > 0 && llmStats.successes === 0) {
				inboxLogger.warn`LLM service unavailable: all ${llmStats.failures} calls failed. Suggestions are heuristic-only. cid=${cid}`;
			}
		}
	}

	/**
	 * Scan the inbox and generate suggestions for all items.
	 *
	 * @returns Array of suggestions for inbox items
	 */
	async function scan(options?: ScanOptions): Promise<InboxSuggestion[]> {
		await initLoggerWithNotice();
		const startedAt = Date.now();
		const cid = createCorrelationId();
		const onProgress = options?.onProgress;

		// Track LLM failures to detect service unavailability
		const llmStats = {
			successes: 0,
			failures: 0,
			fallbacks: 0,
			lastError: undefined as string | undefined,
			lastFallbackReason: undefined as string | undefined,
			lastModelUsed: undefined as string | undefined,
		};

		// Clear stale suggestions from previous scans to prevent memory leaks
		suggestionCache.clear();

		if (inboxLogger) {
			inboxLogger.info`Scan started vault=${resolvedConfig.vaultPath} cid=${cid}`;
		}

		// Git safety check FIRST: ensure vault is clean before expensive LLM processing
		// This prevents wasted time/tokens if user has uncommitted changes
		// excludeInbox: true because we expect files in inbox - we're checking output folders
		// excludeAttachments: true because orphaned attachments shouldn't block inbox processing
		try {
			const config = { vault: resolvedConfig.vaultPath };
			await ensureGitGuard(config, {
				checkAllFileTypes: true,
				excludeInbox: true,
				excludeAttachments: true,
			});
		} catch (error) {
			throw createInboxError(
				"SYS_UNEXPECTED",
				{ cid, operation: "scan" },
				error instanceof Error ? error.message : "Git safety check failed",
			);
		}

		// Load registry and clean up staging
		const registry = await loadAndCleanRegistry(cid);

		// Find supported files and get extractor registry
		const findResult = await findSupportedFiles(cid);
		if (!findResult) {
			return [];
		}
		const { files: supportedFiles, extractorRegistry } = findResult;

		// Validate dependencies
		await validateDependencies(cid);

		// Build vault context
		const vaultContext = buildVaultContext();

		// Create concurrency limiters
		const extractionLimit = pLimit(
			resolvedConfig.concurrency?.pdfExtraction ?? 5,
		);
		const llmLimit = pLimit(resolvedConfig.concurrency?.llmCalls ?? 3);

		// Process files concurrently
		const suggestionPromises = supportedFiles.map((file, index) =>
			processSingleFile({
				file,
				index,
				total: supportedFiles.length,
				registry,
				extractorRegistry,
				vaultContext,
				extractionLimit,
				llmLimit,
				onProgress,
				cid,
				llmStats,
			}),
		);

		const results = await Promise.all(suggestionPromises);
		const suggestions = results.filter((s): s is InboxSuggestion => s !== null);
		const durationMs = Date.now() - startedAt;

		logScanStatistics(suggestions, durationMs, cid, llmStats);

		return suggestions;
	}

	/**
	 * Execute approved suggestions.
	 *
	 * @param ids - IDs of suggestions to execute
	 * @param options - Optional execution options for progress reporting
	 * @returns Array of execution results
	 */
	async function execute(
		ids: SuggestionId[],
		options?: ExecuteOptions,
	): Promise<ExecutionResult[]> {
		await initLoggerWithNotice();
		const startedAt = Date.now();
		const cid = createCorrelationId();
		const onProgress = options?.onProgress;

		if (inboxLogger) {
			inboxLogger.info`Execute started count=${ids.length} cid=${cid}`;
		}

		if (ids.length === 0) {
			return [];
		}

		// Warn if cache is empty - suggests scan() wasn't called
		// Don't throw - let per-ID error handling return appropriate results
		if (suggestionCache.size === 0) {
			if (inboxLogger) {
				inboxLogger.warn`Execute called with empty cache - did you forget to call scan()? cid=${cid}`;
			}
		}

		// Git safety check (belt-and-suspenders): re-verify in case files changed since scan
		// Primary check is in scan() to fail fast before expensive LLM processing
		// excludeInbox: true because we expect files in inbox - we're checking output folders
		// excludeAttachments: true because orphaned attachments shouldn't block inbox processing
		try {
			const config = { vault: resolvedConfig.vaultPath };
			await ensureGitGuard(config, {
				checkAllFileTypes: true,
				excludeInbox: true,
				excludeAttachments: true,
			});
		} catch (error) {
			throw createInboxError(
				"SYS_UNEXPECTED",
				{ cid, operation: "execute" },
				error instanceof Error ? error.message : "Git safety check failed",
			);
		}

		// Load the registry for updating after successful execution
		const registry = createRegistry(resolvedConfig.vaultPath);
		await registry.load();

		const results: ExecutionResult[] = [];
		let successes = 0;
		let failures = 0;
		let processed = 0;
		const total = ids.length;

		for (const id of ids) {
			// Look up suggestion by ID
			const suggestion = suggestionCache.get(id);
			if (!suggestion) {
				results.push({
					suggestionId: id,
					success: false,
					action: "skip",
					error: `Suggestion not found: ${id}`,
				});
				failures++;
				continue;
			}

			// Skip if action is skip
			if (suggestion.action === "skip") {
				results.push({
					suggestionId: id,
					success: true,
					action: "skip",
				});
				successes++;
				continue;
			}

			try {
				const result = await executeSuggestion(
					suggestion,
					resolvedConfig,
					registry,
					cid,
				);
				results.push(result);
				if (result.success) {
					successes++;
					// Save registry immediately after each successful execution
					await registry.save();
					if (executeLogger) {
						executeLogger.debug`Registry saved after item=${id} ${cid}`;
					}
				} else {
					failures++;
				}
			} catch (error) {
				if (executeLogger) {
					executeLogger.error`Execute failed id=${id} error=${error instanceof Error ? error.message : "unknown"} ${cid}`;
				}
				results.push({
					suggestionId: id,
					success: false,
					action: suggestion.action,
					error: error instanceof Error ? error.message : "Unknown error",
				});
				failures++;
			}

			// Emit progress after each item for CLI feedback
			processed++;
			if (onProgress) {
				const lastResult = results[results.length - 1];
				// Extract error from failed result using discriminated union pattern
				const progressError =
					lastResult && !lastResult.success ? lastResult.error : undefined;
				await onProgress({
					processed,
					total,
					suggestionId: id,
					action: suggestion?.action ?? "skip",
					success: lastResult?.success ?? false,
					error: progressError,
				});
			}
		}

		// Final save to ensure any edge cases are captured
		// (This is now redundant but harmless as a safety net)
		await registry.save();

		const durationMs = Date.now() - startedAt;
		if (inboxLogger) {
			inboxLogger.info`Execute complete success=${successes} failed=${failures} durationMs=${durationMs} cid=${cid}`;
			inboxLogger.debug`Execute summary total=${total} success=${successes} failed=${failures} durationMs=${durationMs} cid=${cid}`;
		}

		return results;
	}

	/**
	 * Re-process a suggestion with additional user instructions.
	 *
	 * @param id - Suggestion ID to edit
	 * @param prompt - User's additional instructions
	 * @returns Updated suggestion
	 */
	async function editWithPrompt(
		id: SuggestionId,
		prompt: string,
	): Promise<InboxSuggestion> {
		await initLoggerWithNotice();
		const cid = createCorrelationId();

		if (inboxLogger) {
			inboxLogger.info`Edit started id=${id} prompt=${prompt} cid=${cid}`;
		}

		// Look up original suggestion
		const original = suggestionCache.get(id);
		if (!original) {
			throw new Error(`Suggestion not found: ${id}`);
		}

		// Get source file path
		const sourcePath = join(resolvedConfig.vaultPath, original.source);
		const filename = basename(original.source);

		// Get extractor registry and find appropriate extractor
		const extractorRegistry = await getDefaultRegistry();
		const file = createInboxFile(sourcePath);
		const extractorMatch = extractorRegistry.findExtractor(file);

		// Extract text again for re-processing
		let text: string;
		try {
			if (!extractorMatch) {
				throw new Error(
					`No extractor available for file type: ${file.extension}`,
				);
			}
			const extracted = await extractorMatch.extractor.extract(file, cid);
			text = extracted.text;
		} catch (error) {
			// Return original with error note if extraction fails
			return {
				...original,
				reason: `Edit failed: ${error instanceof Error ? error.message : "extraction error"}`,
			};
		}

		// Get vault context
		// Load para-obsidian config to get paraFolders mapping
		const paraConfigForContext = loadConfig();
		const vaultContext: VaultContext = {
			areas: getVaultAreas(
				resolvedConfig.vaultPath,
				paraConfigForContext.paraFolders,
			),
			projects: getVaultProjects(
				resolvedConfig.vaultPath,
				paraConfigForContext.paraFolders,
			),
		};

		// Build prompt with user hint
		const llmPrompt = buildInboxPrompt(
			{
				content: text,
				filename,
				vaultContext,
				userHint: prompt,
			},
			DEFAULT_CLASSIFIERS,
		);

		// Call LLM with user hint
		let llmResult: DocumentTypeResult | null = null;
		try {
			const response = await llmClient(
				llmPrompt,
				resolvedConfig.llmProvider,
				resolvedConfig.llmModel,
			);
			llmResult = parseDetectionResponse(response);
		} catch (error) {
			if (inboxLogger) {
				inboxLogger.warn`LLM re-detection failed: ${error instanceof Error ? error.message : "unknown"} cid=${cid}`;
			}
		}

		// Run heuristics again
		const heuristicResult = combineHeuristics(filename, text);

		// Build updated suggestion
		const updated = buildSuggestion({
			filename,
			inboxFolder: resolvedConfig.inboxFolder,
			heuristicResult,
			llmResult,
		});

		// Preserve original ID and update cache
		const finalSuggestion: InboxSuggestion = {
			...updated,
			id: original.id, // Keep original ID
			reason: llmResult
				? `Re-processed with hint: "${prompt}" → ${llmResult.reasoning ?? updated.reason}`
				: `Re-processed with hint: "${prompt}" (LLM unavailable)`,
		};

		suggestionCache.set(id, finalSuggestion);

		if (inboxLogger) {
			inboxLogger.info`Edit complete id=${id} newConfidence=${finalSuggestion.confidence} cid=${cid}`;
		}

		return finalSuggestion;
	}

	/**
	 * Challenge a suggestion and re-classify with a user hint.
	 * Preserves the previous classification for audit trail.
	 *
	 * @param id - Suggestion ID to challenge
	 * @param hint - User's hint for re-classification
	 * @returns Updated suggestion with previousClassification populated
	 * @throws InboxError with USR_INVALID_ITEM_ID if suggestion not found
	 * @throws InboxError with USR_EDIT_PROMPT_EMPTY if hint is empty
	 */
	async function challenge(
		id: SuggestionId,
		hint: string,
	): Promise<InboxSuggestion> {
		await initLoggerWithNotice();
		const cid = createCorrelationId();

		// Input validation
		const trimmedHint = hint?.trim() ?? "";

		if (!trimmedHint) {
			throw createInboxError("USR_EDIT_PROMPT_EMPTY", {
				cid,
				itemId: id,
				operation: "challenge",
			});
		}

		if (inboxLogger) {
			inboxLogger.info`Challenge started id=${id} cid=${cid}`;
		}

		// Look up original suggestion
		const original = suggestionCache.get(id);
		if (!original) {
			throw createInboxError("USR_INVALID_ITEM_ID", {
				cid,
				itemId: id,
				operation: "challenge",
			});
		}

		// Store previous classification for audit trail BEFORE any mutation
		const previousClassification = {
			documentType: isCreateNoteSuggestion(original)
				? original.suggestedNoteType
				: undefined,
			confidence: original.confidence,
			reason: original.reason,
		};

		// Re-process with hint using editWithPrompt
		// If this fails, we haven't mutated anything yet
		let updated: InboxSuggestion;
		try {
			updated = await editWithPrompt(id, trimmedHint);
		} catch (error) {
			// Log failure without exposing full error details
			if (inboxLogger) {
				inboxLogger.warn`Challenge re-classification failed id=${id} cid=${cid}`;
			}
			throw error;
		}

		// Create final suggestion with challenge metadata
		// Only mutate cache after successful re-classification
		const challengedSuggestion: ChallengeSuggestion = {
			id: updated.id,
			source: updated.source,
			processor: updated.processor,
			confidence: updated.confidence,
			action: "challenge",
			hint: trimmedHint,
			previousClassification,
			detectionSource: updated.detectionSource,
			reason: `Challenged: "${trimmedHint}" → ${updated.reason}`,
		};

		suggestionCache.set(id, challengedSuggestion);

		if (inboxLogger) {
			const newType = isCreateNoteSuggestion(updated)
				? updated.suggestedNoteType
				: undefined;
			inboxLogger.info`Challenge complete id=${id} oldType=${previousClassification.documentType} newType=${newType} cid=${cid}`;
		}

		return challengedSuggestion;
	}

	/**
	 * Generate a markdown report of suggestions.
	 *
	 * @param suggestions - Suggestions to include in report
	 * @returns Markdown formatted report
	 */
	function generateReportMethod(suggestions: InboxSuggestion[]): string {
		return generateReport(suggestions, resolvedConfig.vaultPath);
	}
}
