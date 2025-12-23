/**
 * Inbox Processing Engine
 *
 * Factory function and implementation for the inbox processing engine.
 * This is the main entry point for scan/execute/edit operations.
 *
 * @module inbox/engine
 */

import { basename, join } from "node:path";
import { pathExistsSync, readDir } from "@sidequest/core/fs";
import pLimit from "p-limit";
import {
	DEFAULT_DESTINATIONS,
	DEFAULT_PARA_FOLDERS,
} from "../../config/defaults";
import { loadConfig } from "../../config/index";
import {
	ensureCleanState,
	finalizeSession,
	startSession,
	trackChange,
} from "../../git/session";
import { observe } from "../../shared/instrumentation";
import {
	createCorrelationId,
	executeLogger,
	inboxLogger,
	initLoggerWithNotice,
} from "../../shared/logger";
import { captureResourceMetrics } from "../../shared/resource-metrics";
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
import { createInboxError } from "../shared/errors";
import { checkSLOBreach, recordSLOEvent } from "../shared/slos";
import {
	type BatchResult,
	type ChallengeSuggestion,
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
// generateTitle removed - no longer needed after markdown processing removal
import { callLLM, callLLMWithMetadata } from "./llm";
import { executeSuggestion } from "./operations";
import { generateReport } from "./operations/report";
import { cleanupOrphanedStaging } from "./staging";
import {
	getAreaPathMap,
	getProjectPathMap,
	getVaultAreas,
	getVaultProjects,
	type VaultContext,
} from "./vault";

// =============================================================================
// Engine Factory
// =============================================================================

/**
 * Creates a new inbox processing engine.
 *
 * The engine provides methods to:
 * - Scan the inbox for attachment files (PDF, DOCX) and generate suggestions
 * - Execute approved suggestions (create notes, move attachments)
 * - Edit suggestions with additional prompts
 * - Generate markdown reports
 *
 * Note: Markdown file processing is deprecated. Only PDF and DOCX attachments
 * are processed by the engine. Use the separate `para enrich` command for
 * markdown enrichment.
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
	const resolvedConfig = {
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
		restrictRegistryToAttachments: config.restrictRegistryToAttachments ?? true,
	} as const;

	// Use injected LLM client if provided, otherwise use real callLLM
	const llmClient = resolvedConfig.llmClient ?? callLLM;

	// In-memory cache of suggestions from last scan
	// Used by execute() to look up suggestions by ID
	const suggestionCache = new Map<string, InboxSuggestion>();

	if (inboxLogger) {
		const cid = createCorrelationId();
		inboxLogger.debug("Engine initialized", {
			event: "engine_created",
			cid,
			vaultPath: resolvedConfig.vaultPath,
			timestamp: new Date().toISOString(),
		});
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
	 * Validate execution preconditions before batch processing.
	 * Fails fast if vault structure is invalid.
	 * @internal
	 */
	function validateExecutionPreconditions(
		vaultPath: string,
		paraFolders: Record<string, string>,
	): void {
		if (!pathExistsSync(vaultPath)) {
			throw new Error(`Vault path does not exist: ${vaultPath}`);
		}

		for (const [_name, folder] of Object.entries(paraFolders)) {
			const fullPath = join(vaultPath, folder);
			if (!pathExistsSync(fullPath)) {
				throw new Error(`Required PARA folder missing: ${folder}`);
			}
		}
	}

	/**
	 * Load registry and clean up orphaned staging files.
	 * @internal
	 */
	async function loadAndCleanRegistry(
		sessionCid: string,
	): Promise<ReturnType<typeof createRegistry>> {
		const registry = createRegistry(resolvedConfig.vaultPath, {
			restrictToAttachments:
				resolvedConfig.restrictRegistryToAttachments ?? true,
		});
		await registry.load();
		await cleanupOrphanedStaging(resolvedConfig.vaultPath, registry, {
			sessionCid,
		});
		return registry;
	}

	/**
	 * Find and filter attachment files in the inbox.
	 * Only processes PDF and DOCX files - markdown processing is deprecated.
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
				inboxLogger.warn("Inbox folder not found", {
					event: "inbox_folder_not_found",
					cid,
					path: inboxPath,
					timestamp: new Date().toISOString(),
				});
			}
			return null;
		}

		// Get extractor registry
		const extractorRegistry = await getDefaultRegistry();

		// IMPORTANT: Only process attachment files (PDF, DOCX)
		// Markdown files are no longer supported by the inbox engine
		const attachmentExtensions = new Set([".pdf", ".docx"]);

		// Convert to InboxFile and filter to attachments only
		const supportedFiles: InboxFile[] = files
			.map((f) => createInboxFile(join(inboxPath, f)))
			.filter((f) => attachmentExtensions.has(f.extension));

		if (supportedFiles.length === 0) {
			if (inboxLogger) {
				inboxLogger.info`No attachment files found in inbox cid=${cid}`;
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
				inboxLogger.error("Required dependency missing", {
					event: "dependency_missing",
					cid,
					dependency: "pdftotext",
					error: pdfCheck.error,
					timestamp: new Date().toISOString(),
				});
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
	 * Determine if a file should be tracked in the processed registry.
	 *
	 * Registry Scope (Phase 4):
	 * - Attachments (PDFs, DOCX): YES - tracked via content hash
	 * - Markdown files: Not processed by engine (handled separately via enrich command)
	 *
	 * @param file - Inbox file to check
	 * @returns true if file should be tracked in registry
	 */
	function shouldTrackInRegistry(_file: InboxFile): boolean {
		// All files processed by engine are attachments (PDF, DOCX)
		// since markdown is no longer supported
		return true;
	}

	/**
	 * Context for processing a single inbox file.
	 * Groups related parameters for cleaner function signatures.
	 */
	interface ProcessFileContext {
		/** Session-level correlation ID for linking scan → execute operations */
		sessionCid: string;
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
		/** Parent correlation ID (scan's CID) for trace hierarchy */
		parentCid: string;
		/** Running statistics for LLM calls */
		llmStats: {
			successes: number;
			failures: number;
			fallbacks: number;
			errors: Array<{ filename: string; error: string; timestamp: number }>;
			lastFallbackReason: string | undefined;
			lastModelUsed: string | undefined;
		};
	}

	/**
	 * Process a single inbox file: hash check, extraction, LLM detection, suggestion building.
	 * @internal
	 */
	async function processSingleFile(
		ctx: ProcessFileContext,
	): Promise<InboxSuggestion | null> {
		const {
			sessionCid,
			file,
			index,
			total,
			registry,
			extractorRegistry,
			vaultContext,
			extractionLimit,
			llmLimit,
			onProgress,
			parentCid,
			llmStats,
		} = ctx;

		return extractionLimit(async () => {
			// Create unique CID for this file with parentCid for trace hierarchy
			const cid = createCorrelationId();
			const { path: filePath, filename } = file;
			const progressBase = {
				index: index + 1,
				total,
				filename,
			} as const;

			// Emit start event so CLI can track pending files
			if (onProgress) {
				await onProgress({ ...progressBase, stage: "start" });
			}

			// =================================================================
			// ATTACHMENT PROCESSING: Hash, extract, classify PDF and DOCX files
			// =================================================================

			// Calculate hash for dedup check and linking note title to attachment
			let fileHash: string;
			try {
				if (onProgress) {
					await onProgress({ ...progressBase, stage: "hash" });
				}
				fileHash = await hashFile(filePath);

				// Registry check - only for attachments (Phase 2: scope restriction)
				if (shouldTrackInRegistry(file)) {
					if (registry.isProcessed(fileHash)) {
						if (inboxLogger) {
							inboxLogger.debug`Skipping already processed: ${filename} sessionCid=${sessionCid} cid=${cid}`;
						}
						if (onProgress) {
							await onProgress({ ...progressBase, stage: "skip" });
						}
						return null;
					}
				} else {
					// Markdown files use frontmatter-based enrichment tracking
					// For bookmarks: check enrichedAt field in subsequent phases
					if (inboxLogger) {
						inboxLogger.debug`Skipped registry check for markdown: ${filename} cid=${cid}`;
					}
				}
			} catch (_error) {
				if (inboxLogger) {
					inboxLogger.warn`Failed to hash file: ${filename} sessionCid=${sessionCid} cid=${cid}`;
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
					inboxLogger.warn`No extractor found for: ${filename} sessionCid=${sessionCid} cid=${cid}`;
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
			let extractedMarkdown: string | undefined;
			try {
				if (onProgress) {
					await onProgress({ ...progressBase, stage: "extract" });
				}
				const extracted = await observe(
					inboxLogger,
					"inbox:extractContent",
					async () =>
						extractorMatch.extractor.extract(file, cid, parentCid, {
							sessionCid,
						}),
					{ parentCid, context: { filename } },
				);
				text = extracted.text;
				extractedMarkdown = extracted.markdown;
			} catch (error) {
				if (inboxLogger) {
					inboxLogger.warn`Failed to extract content: ${filename} sessionCid=${sessionCid} cid=${cid}`;
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

			// Run heuristic detection
			const heuristicResult = combineHeuristics(filename, text);
			if (inboxLogger) {
				inboxLogger.debug`Heuristic result file=${filename} detected=${heuristicResult.detected} type=${heuristicResult.suggestedType ?? "none"} confidence=${heuristicResult.confidence.toFixed(2)} sessionCid=${sessionCid} cid=${cid}`;
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
					inboxLogger.debug`LLM starting file=${filename} model=${llmModel} sessionCid=${sessionCid} cid=${cid}`;
				}
				llmResult = await observe(
					inboxLogger,
					"inbox:llmCall",
					async () =>
						llmLimit(async () => {
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
									{ sessionCid },
								);
								llmFallbackUsed = llmCallResult.isFallback;
								llmFallbackReason = llmCallResult.fallbackReason;
								llmModelUsed = llmCallResult.modelUsed;

								// Emit fallback progress update if fallback occurred
								if (llmFallbackUsed) {
									if (inboxLogger) {
										inboxLogger.info("LLM fallback triggered", {
											event: "llm_fallback",
											cid,
											sessionCid,
											parentCid,
											filename,
											primaryModel:
												resolvedConfig.llmModel ?? resolvedConfig.llmProvider,
											fallbackModel: llmCallResult.modelUsed,
											reason: llmCallResult.fallbackReason,
											timestamp: new Date().toISOString(),
										});
									}
									if (onProgress) {
										await onProgress({
											...progressBase,
											stage: "llm",
											model: llmCallResult.modelUsed,
											isFallback: true,
											fallbackReason: llmCallResult.fallbackReason,
										});
									}
								}

								if (inboxLogger) {
									inboxLogger.debug`LLM raw response file=${filename} length=${llmCallResult.response.length} preview=${llmCallResult.response.slice(0, 200).replace(/\n/g, " ")} sessionCid=${sessionCid} cid=${cid}`;
								}
								const result = parseDetectionResponse(llmCallResult.response);
								if (inboxLogger) {
									inboxLogger.info`LLM success file=${filename} type=${result.documentType} confidence=${result.confidence.toFixed(2)} fallback=${llmFallbackUsed} sessionCid=${sessionCid} cid=${cid}`;
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
								inboxLogger.debug`LLM raw response file=${filename} length=${response.length} preview=${response.slice(0, 200).replace(/\n/g, " ")} sessionCid=${sessionCid} cid=${cid}`;
							}
							const result = parseDetectionResponse(response);
							if (inboxLogger) {
								inboxLogger.info`LLM success file=${filename} type=${result.documentType} confidence=${result.confidence.toFixed(2)} sessionCid=${sessionCid} cid=${cid}`;
							}
							return result;
						}),
					{ parentCid, context: { filename, model: llmModel } },
				);
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
					inboxLogger.warn`LLM detection failed: ${filename} - ${errorMsg} sessionCid=${sessionCid} cid=${cid}`;
				}
				llmStats.failures += 1;
				llmStats.errors.push({
					filename: basename(file.path),
					error: errorMsg,
					timestamp: Date.now(),
				});
				llmResult = null;
				llmErrorMessage = errorMsg;
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
				};
			}

			// Build suggestion first - this determines the final document type
			// using all priority logic (authoritative filename, LLM, heuristics)
			let suggestion = buildSuggestion({
				filename,
				inboxFolder: resolvedConfig.inboxFolder,
				heuristicResult,
				llmResult,
				hash: fileHash,
			});

			// Now look up classifier using the FINAL type from the suggestion
			// This ensures Type A/B determination uses the same type as the suggestion
			const finalType = isCreateNoteSuggestion(suggestion)
				? suggestion.suggestedNoteType
				: undefined;

			const classifier = finalType
				? DEFAULT_CLASSIFIERS.find((c) => c.id === finalType && c.enabled)
				: undefined;

			// If this is a Type A document (markdown source of truth), add the extracted content
			if (
				classifier?.sourceOfTruth === "markdown" &&
				extractedMarkdown &&
				isCreateNoteSuggestion(suggestion)
			) {
				// Rebuild suggestion with Type A fields
				suggestion = buildSuggestion({
					filename,
					inboxFolder: resolvedConfig.inboxFolder,
					heuristicResult,
					llmResult,
					hash: fileHash,
					extractedMarkdown,
					sourceOfTruth: classifier.sourceOfTruth,
				});

				if (inboxLogger) {
					inboxLogger.debug`Type A document: type=${finalType} sourceOfTruth=${classifier.sourceOfTruth} markdownLength=${extractedMarkdown.length} sessionCid=${sessionCid} cid=${cid}`;
				}
			}

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
				inboxLogger.info`Suggestion built file=${filename} action=${suggestion.action} confidence=${suggestion.confidence} type=${noteType} source=${source} reason=${suggestion.reason} sessionCid=${sessionCid} cid=${cid}`;
			}

			suggestionCache.set(suggestion.id, suggestion);

			// Log file processing completion with structured event
			if (inboxLogger) {
				inboxLogger.info("File processed", {
					event: "file_processed",
					cid,
					sessionCid,
					parentCid,
					filename,
					action: suggestion.action,
					confidence: suggestion.confidence,
					llmUsed: llmResult !== null && !llmErrorMessage,
					llmFallbackUsed,
					success: true,
					timestamp: new Date().toISOString(),
				});
			}

			if (onProgress) {
				await onProgress({
					...progressBase,
					stage: "done",
					llmFailures: llmStats.failures,
					llmError: llmStats.errors[llmStats.errors.length - 1]?.error,
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
		sessionCid: string,
		llmStats: {
			successes: number;
			failures: number;
			fallbacks: number;
			errors: Array<{ filename: string; error: string; timestamp: number }>;
			lastFallbackReason: string | undefined;
			lastModelUsed: string | undefined;
		},
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
			inboxLogger.info("Scan completed", {
				event: "scan_completed",
				cid,
				sessionCid,
				suggestionCount: suggestions.length,
				durationMs,
				llmSuccesses: llmStats.successes,
				llmFailures: llmStats.failures,
				llmFallbacks: llmStats.fallbacks,
				timestamp: new Date().toISOString(),
			});
			inboxLogger.debug`Scan breakdown confidence=${JSON.stringify(confidenceCounts)} actions=${JSON.stringify(actionCounts)} durationMs=${durationMs} sessionCid=${sessionCid} cid=${cid}`;

			// Error if LLM appears unavailable
			if (llmStats.failures > 0 && llmStats.successes === 0) {
				inboxLogger.error`LLM service unavailable: all ${llmStats.failures} calls failed. Suggestions are heuristic-only. sessionCid=${sessionCid} cid=${cid}`;
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
		const sessionCid = options?.sessionCid ?? createCorrelationId();

		return observe(
			inboxLogger,
			"inbox:scan",
			async () => {
				const startedAt = Date.now();
				const cid = createCorrelationId();
				const onProgress = options?.onProgress;

				// Track LLM failures to detect service unavailability
				const llmStats = {
					successes: 0,
					failures: 0,
					fallbacks: 0,
					errors: [] as Array<{
						filename: string;
						error: string;
						timestamp: number;
					}>,
					lastFallbackReason: undefined as string | undefined,
					lastModelUsed: undefined as string | undefined,
				};

				// Clear stale suggestions from previous scans to prevent memory leaks
				suggestionCache.clear();

				if (inboxLogger) {
					inboxLogger.info("Scan started", {
						event: "scan_started",
						cid,
						sessionCid,
						vaultPath: resolvedConfig.vaultPath,
						timestamp: new Date().toISOString(),
					});

					// Log resource usage at scan start
					const startMetrics = captureResourceMetrics();
					inboxLogger.debug("Scan resources start", {
						event: "scan_resources_start",
						cid,
						sessionCid,
						parentCid: sessionCid,
						...startMetrics,
					});
				}

				// Silent pre-commit: auto-save any uncommitted PARA files before scan
				// This never blocks - if git fails, we log and continue
				// Note: We use default PARA folders here to avoid filesystem config reads
				// which can conflict with test vault setups
				const preCommitResult = await ensureCleanState({
					vault: resolvedConfig.vaultPath,
					paraFolders: DEFAULT_PARA_FOLDERS,
					defaultDestinations: DEFAULT_DESTINATIONS,
				});
				if (preCommitResult.preCommitted && inboxLogger) {
					inboxLogger.info`Auto-saved ${preCommitResult.files.length} existing files before scan`;
				}

				// Load registry and clean up staging
				const registry = await loadAndCleanRegistry(sessionCid);

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
						sessionCid,
						file,
						index,
						total: supportedFiles.length,
						registry,
						extractorRegistry,
						vaultContext,
						extractionLimit,
						llmLimit,
						onProgress,
						parentCid: cid,
						llmStats,
					}),
				);

				const results = await Promise.all(suggestionPromises);
				const suggestions = results.filter(
					(s): s is InboxSuggestion => s !== null,
				);
				const durationMs = Date.now() - startedAt;

				// Log resource usage at scan end
				if (inboxLogger) {
					const endMetrics = captureResourceMetrics();
					inboxLogger.debug("Scan resources end", {
						event: "scan_resources_end",
						cid,
						sessionCid,
						parentCid: sessionCid,
						...endMetrics,
					});
				}

				// Record LLM availability SLO if any LLM calls were attempted
				const totalLLMCalls = llmStats.successes + llmStats.failures;
				if (totalLLMCalls > 0) {
					const availabilityRate = (llmStats.successes / totalLLMCalls) * 100;
					const llmSLOCheck = await checkSLOBreach(
						"llm_availability",
						availabilityRate,
					);
					recordSLOEvent(
						"llm_availability",
						llmSLOCheck.breached,
						availabilityRate,
					);
				}

				logScanStatistics(suggestions, durationMs, cid, sessionCid, llmStats);

				return suggestions;
			},
			{ parentCid: sessionCid },
		);
	}

	/**
	 * Execute approved suggestions.
	 *
	 * @param ids - IDs of suggestions to execute
	 * @param options - Optional execution options for progress reporting
	 * @returns Batch result with successful executions and failures
	 */
	async function execute(
		ids: SuggestionId[],
		options?: ExecuteOptions,
	): Promise<BatchResult> {
		await initLoggerWithNotice();
		const sessionCid = options?.sessionCid ?? createCorrelationId();

		return observe(
			executeLogger,
			"inbox:execute",
			async () => {
				const startedAt = Date.now();
				const cid = createCorrelationId();
				const onProgress = options?.onProgress;

				if (inboxLogger) {
					inboxLogger.info("Execute started", {
						event: "execute_started",
						cid,
						sessionCid,
						count: ids.length,
						timestamp: new Date().toISOString(),
					});

					// Log resource usage at execute start
					const startMetrics = captureResourceMetrics();
					inboxLogger.debug("Execute resources start", {
						event: "execute_resources_start",
						cid,
						sessionCid,
						parentCid: sessionCid,
						...startMetrics,
					});
				}

				if (ids.length === 0) {
					return {
						successful: [],
						failed: new Map(),
						summary: { total: 0, succeeded: 0, failed: 0 },
					};
				}

				// Warn if cache is empty - suggests scan() wasn't called
				// Don't throw - let per-ID error handling return appropriate results
				if (suggestionCache.size === 0) {
					if (inboxLogger) {
						inboxLogger.warn`Execute called with empty cache - did you forget to call scan()? sessionCid=${sessionCid} cid=${cid}`;
					}
				}

				// Load para-obsidian config for path maps
				const paraConfig = loadConfig();

				// Pre-flight validation
				validateExecutionPreconditions(
					resolvedConfig.vaultPath,
					paraConfig.paraFolders ?? {},
				);

				// Start a session - this silently pre-commits any existing uncommitted files
				// and tracks changes for batch commit at the end
				// Note: We use defaults with fallback from config to avoid test interference
				const session = await startSession({
					vault: resolvedConfig.vaultPath,
					paraFolders: paraConfig.paraFolders ?? DEFAULT_PARA_FOLDERS,
					defaultDestinations:
						paraConfig.defaultDestinations ?? DEFAULT_DESTINATIONS,
				});
				if (inboxLogger) {
					inboxLogger.debug`Execute session started id=${session.id} sessionCid=${sessionCid} cid=${cid}`;
				}

				// Build path maps ONCE for entire batch
				const areaPathMap = getAreaPathMap(
					resolvedConfig.vaultPath,
					paraConfig.paraFolders,
				);
				const projectPathMap = getProjectPathMap(
					resolvedConfig.vaultPath,
					paraConfig.paraFolders,
				);

				// Load the registry for updating after successful execution
				const registry = createRegistry(resolvedConfig.vaultPath, {
					restrictToAttachments:
						resolvedConfig.restrictRegistryToAttachments ?? true,
				});
				await registry.load();

				const successful: ExecutionResult[] = [];
				const failed = new Map<SuggestionId, Error>();
				let processed = 0;
				const total = ids.length;

				for (const id of ids) {
					// Look up suggestion by ID from engine cache
					const suggestion = suggestionCache.get(id);
					if (!suggestion) {
						const error = new Error(`Suggestion not found: ${id}`);
						failed.set(id, error);
						continue;
					}

					// Skip if action is skip
					if (suggestion.action === "skip") {
						successful.push({
							suggestionId: id,
							success: true,
							action: "skip",
						});
						continue;
					}

					// Defense-in-depth: Validate create-note has destination
					// This should be filtered at CLI layer, but catch any slip-through
					if (
						isCreateNoteSuggestion(suggestion) &&
						!suggestion.suggestedDestination
					) {
						const error = new Error(
							`Cannot execute: missing destination. Tag the file in Obsidian and re-scan.`,
						);
						failed.set(id, error);
						if (executeLogger) {
							executeLogger.warn`Skipping create-note without destination id=${id} source=${basename(suggestion.source)} ${cid}`;
						}
						continue;
					}

					try {
						const result = await executeSuggestion(
							suggestion,
							resolvedConfig,
							registry,
							cid,
							{ areaPathMap, projectPathMap, sessionCid },
						);
						successful.push(result);
						if (result.success) {
							// Save registry immediately after each successful execution
							await registry.save();
							if (executeLogger) {
								executeLogger.debug`Registry saved after item=${id} ${cid}`;
							}
							// Track file changes in session for batch commit
							// Track source file deletion for git staging
							if (result.movedFrom) {
								await trackChange(session, result.movedFrom);
							}
							// Track destination files for git staging
							if (result.createdNote) {
								await trackChange(session, result.createdNote);
							}
							if (result.movedAttachment) {
								await trackChange(session, result.movedAttachment);
							}
						} else {
							// Track as failed even though executeSuggestion returned a result
							failed.set(id, new Error(result.error));
						}
					} catch (error) {
						failed.set(id, error as Error);
						// Log but don't stop - continue processing other suggestions
						if (executeLogger) {
							const filename = suggestion
								? basename(suggestion.source)
								: "unknown";
							executeLogger.error`Execute failed id=${id} filename=${filename} error=${error instanceof Error ? error.message : "unknown"} ${cid}`;
						}
					}

					// Emit progress after each item for CLI feedback
					processed++;
					if (onProgress) {
						const lastResult = successful[successful.length - 1];
						const wasSuccessful = lastResult?.success ?? false;
						const failedError = failed.get(id);
						// Extract error from failed result using discriminated union pattern
						const progressError = failedError
							? failedError.message
							: lastResult && !lastResult.success
								? lastResult.error
								: undefined;
						const percentComplete = Math.round((processed / total) * 100);
						await onProgress({
							processed,
							total,
							suggestionId: id,
							action: suggestion?.action ?? "skip",
							success: wasSuccessful,
							error: progressError,
							percentComplete,
						});
					}
				}

				// Final save to ensure any edge cases are captured
				// (This is now redundant but harmless as a safety net)
				await registry.save();

				// Finalize session - batch commit all changes from this execute() call
				const successCount = successful.filter((r) => r.success).length;
				if (successCount > 0) {
					const summary = `inbox: processed ${successCount} item${successCount === 1 ? "" : "s"}`;
					const commitResult = await finalizeSession(
						session,
						summary,
						paraConfig,
					);
					if (commitResult.committed && inboxLogger) {
						inboxLogger.info`Session committed: ${summary}`;
					}
				} else {
					// No successful operations - just mark session as finalized without commit
					session.finalized = true;
				}

				const durationMs = Date.now() - startedAt;

				// Log resource usage at execute end
				if (inboxLogger) {
					const endMetrics = captureResourceMetrics();
					inboxLogger.debug("Execute resources end", {
						event: "execute_resources_end",
						cid,
						sessionCid,
						parentCid: sessionCid,
						...endMetrics,
					});
				}

				if (inboxLogger) {
					inboxLogger.info("Execute completed", {
						event: "execute_completed",
						cid,
						successCount: successful.length,
						failureCount: failed.size,
						total,
						durationMs,
						timestamp: new Date().toISOString(),
					});
					inboxLogger.debug`Execute summary total=${total} success=${successful.length} failed=${failed.size} durationMs=${durationMs} sessionCid=${sessionCid} cid=${cid}`;
				}

				return {
					successful,
					failed,
					summary: {
						total: ids.length,
						succeeded: successful.length,
						failed: failed.size,
					},
				};
			},
			{ parentCid: sessionCid },
		);
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
			// SECURITY: Never log raw user prompts - only log metadata
			inboxLogger.info`Edit started id=${id} promptLength=${prompt.length} hasPrompt=${prompt.length > 0} cid=${cid}`;
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
			inboxLogger.info("Challenge started", {
				id,
				hint: trimmedHint,
				cid,
			});
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
				inboxLogger.warn("Challenge re-classification failed", {
					id,
					error: error instanceof Error ? error.message : "unknown",
					cid,
				});
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
			inboxLogger.info("Challenge complete", {
				id,
				oldType: previousClassification.documentType,
				newType,
				oldConfidence: previousClassification.confidence,
				newConfidence: updated.confidence,
				cid,
			});
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
