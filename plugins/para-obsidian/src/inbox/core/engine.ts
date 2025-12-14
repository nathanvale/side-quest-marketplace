/**
 * Inbox Processing Engine
 *
 * Factory function and implementation for the inbox processing engine.
 * This is the main entry point for scan/execute/edit operations.
 *
 * @module inbox/engine
 */

import path, { basename, dirname, extname, join } from "node:path";
import {
	ensureDirSync,
	moveFile,
	pathExistsSync,
	readDir,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";
import { globFilesSync } from "@sidequest/core/glob";
import pLimit from "p-limit";
import { DEFAULT_PARA_FOLDERS } from "../../config/defaults";
import { loadConfig } from "../../config/index";
import { parseFrontmatter } from "../../frontmatter/parse";
import { ensureGitGuard } from "../../git/index";
import { createFromTemplate, injectSections } from "../../notes/create";
import { resolveVaultPath } from "../../shared/fs";
import {
	createCorrelationId,
	executeLogger,
	inboxLogger,
	initLoggerWithNotice,
} from "../../shared/logger";
import {
	buildSuggestion,
	DEFAULT_INBOX_CONVERTERS,
	mapFieldsToTemplate,
} from "../classify/converters";
import {
	checkPdfToText,
	combineHeuristics,
	extractPdfText,
} from "../classify/detection/pdf-processor";
import {
	buildInboxPrompt,
	type DocumentTypeResult,
	type InboxVaultContext,
	parseDetectionResponse,
} from "../classify/llm-classifier";
import { createRegistry, hashFile } from "../registry/processed-registry";
import {
	createInboxFile,
	getDefaultRegistry,
	type InboxFile,
} from "../scan/extractors";
import { createInboxError } from "../shared/errors";
import {
	type ChallengeSuggestion,
	createSuggestionId,
	type ExecuteOptions,
	type ExecutionResult,
	type InboxEngine,
	type InboxEngineConfig,
	type InboxSuggestion,
	isCreateNoteSuggestion,
	isMoveSuggestion,
	type ProcessedItem,
	type ScanOptions,
	type SuggestionId,
} from "../types";
import { generateFilename, generateUniquePath } from "./engine-utils";

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
	// Apply defaults to config
	// Note: fileIO concurrency is defined but execution is sequential by design
	// to ensure registry saves are atomic and don't conflict. The config option
	// is preserved for future parallel execution support.
	const resolvedConfig: Required<
		Omit<InboxEngineConfig, "llmModel" | "concurrency">
	> &
		Pick<InboxEngineConfig, "llmModel" | "concurrency"> = {
		vaultPath: config.vaultPath,
		inboxFolder: config.inboxFolder ?? "00 Inbox",
		attachmentsFolder: config.attachmentsFolder ?? "Attachments",
		templatesFolder: config.templatesFolder ?? "Templates",
		llmProvider: config.llmProvider ?? "haiku",
		llmModel: config.llmModel,
		concurrency: config.concurrency ?? {
			pdfExtraction: 5,
			llmCalls: 3,
			fileIO: 10,
		},
	};

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
		generateReport,
	};

	// =========================================================================
	// Method Implementations
	// =========================================================================

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

		// Clear stale suggestions from previous scans to prevent memory leaks
		suggestionCache.clear();

		if (inboxLogger) {
			inboxLogger.info`Scan started vault=${resolvedConfig.vaultPath} cid=${cid}`;
		}

		// Load the registry to check for already-processed items
		const registry = createRegistry(resolvedConfig.vaultPath);
		await registry.load();

		// Layer 4: Detect and clean up orphaned staging files from interrupted operations
		await cleanupOrphanedStaging(resolvedConfig.vaultPath, registry, cid);

		// Get inbox folder path
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
			return [];
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
			return [];
		}

		// Check pdftotext availability
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

		// Get vault context for LLM (stub for now - could integrate with indexer)
		// Load para-obsidian config to get paraFolders mapping for vault context
		const paraConfig = loadConfig();
		const vaultContext: InboxVaultContext = {
			areas: getVaultAreas(resolvedConfig.vaultPath, paraConfig.paraFolders),
			projects: getVaultProjects(
				resolvedConfig.vaultPath,
				paraConfig.paraFolders,
			),
		};

		// Create concurrency limiters
		const extractionLimit = pLimit(
			resolvedConfig.concurrency?.pdfExtraction ?? 5,
		);
		const llmLimit = pLimit(resolvedConfig.concurrency?.llmCalls ?? 3);

		// Process supported files concurrently
		const suggestionPromises = supportedFiles.map((file, index) =>
			extractionLimit(async () => {
				const { path: filePath, filename } = file;
				const progressBase = {
					index: index + 1,
					total: supportedFiles.length,
					filename,
				} as const;

				// Check if already processed via hash
				try {
					if (onProgress) {
						await onProgress({ ...progressBase, stage: "hash" });
					}
					const hash = await hashFile(filePath);
					if (registry.isProcessed(hash)) {
						if (inboxLogger) {
							inboxLogger.debug`Skipping already processed: ${filename} cid=${cid}`;
						}
						if (onProgress) {
							await onProgress({ ...progressBase, stage: "skip" });
						}
						return null; // Skip this file
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

				// Extract text
				let text: string;
				try {
					if (onProgress) {
						await onProgress({ ...progressBase, stage: "extract" });
					}
					text = await extractPdfText(filePath, cid);
				} catch (error) {
					if (inboxLogger) {
						inboxLogger.warn`Failed to extract PDF text: ${filename} cid=${cid}`;
					}
					if (onProgress) {
						await onProgress({
							...progressBase,
							stage: "error",
							error:
								error instanceof Error ? error.message : "extraction failed",
						});
					}
					// Return error suggestion
					const errorSuggestion: InboxSuggestion = {
						id: createSuggestionId(crypto.randomUUID()),
						source: join(resolvedConfig.inboxFolder, filename),
						processor: "attachments",
						confidence: "low",
						action: "skip",
						reason: `PDF text extraction failed: ${error instanceof Error ? error.message : "unknown error"}`,
					};
					suggestionCache.set(errorSuggestion.id, errorSuggestion);
					return errorSuggestion;
				}

				// Run heuristic detection
				const heuristicResult = combineHeuristics(filename, text);

				// Run LLM detection (with its own rate limit)
				let llmResult: DocumentTypeResult | null = null;
				try {
					if (onProgress) {
						await onProgress({ ...progressBase, stage: "llm" });
					}
					await llmLimit(async () => {
						const prompt = buildInboxPrompt({
							content: text,
							filename,
							vaultContext,
						});
						const response = await callLLM(
							prompt,
							resolvedConfig.llmProvider,
							resolvedConfig.llmModel,
						);
						llmResult = parseDetectionResponse(response);
					});
				} catch (error) {
					if (inboxLogger) {
						inboxLogger.warn`LLM detection failed: ${filename} - ${error instanceof Error ? error.message : "unknown"} cid=${cid}`;
					}
				}

				// Build suggestion
				const suggestion = buildSuggestion({
					filename,
					inboxFolder: resolvedConfig.inboxFolder,
					heuristicResult,
					llmResult,
				});
				suggestionCache.set(suggestion.id, suggestion);
				if (onProgress) {
					await onProgress({ ...progressBase, stage: "done" });
				}
				return suggestion;
			}),
		);

		const results = await Promise.all(suggestionPromises);
		const suggestions = results.filter((s): s is InboxSuggestion => s !== null);
		const durationMs = Date.now() - startedAt;

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
			inboxLogger.info`Scan complete suggestions=${suggestions.length} durationMs=${durationMs} cid=${cid}`;
			inboxLogger.debug`Scan breakdown confidence=${JSON.stringify(confidenceCounts)} actions=${JSON.stringify(actionCounts)} durationMs=${durationMs} cid=${cid}`;
		}

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

		// Git safety check: ensure vault is a git repo with clean working tree
		// Use checkAllFileTypes=true to prevent bypassing git guard with PDFs/JSON
		try {
			// Build minimal config for git guard without loading from disk
			// This prevents test failures when PARA_VAULT points to a different location
			const config = {
				vault: resolvedConfig.vaultPath,
			};
			await ensureGitGuard(config, { checkAllFileTypes: true });
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
				await onProgress({
					processed,
					total,
					suggestionId: id,
					action: suggestion?.action ?? "skip",
					success: results[results.length - 1]?.success ?? false,
					error: results[results.length - 1]?.error,
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

		// Extract text again for re-processing
		let text: string;
		try {
			text = await extractPdfText(sourcePath, cid);
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
		const vaultContext: InboxVaultContext = {
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
		const llmPrompt = buildInboxPrompt({
			content: text,
			filename,
			vaultContext,
			userHint: prompt,
		});

		// Call LLM with user hint
		let llmResult: DocumentTypeResult | null = null;
		try {
			const response = await callLLM(
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
	function generateReport(suggestions: InboxSuggestion[]): string {
		const lines: string[] = [
			"# Inbox Processing Report",
			"",
			`Generated: ${new Date().toISOString()}`,
			`Vault: ${resolvedConfig.vaultPath}`,
			"",
		];

		if (suggestions.length === 0) {
			lines.push("No suggestions to report.");
			return lines.join("\n");
		}

		// Group by confidence
		const byConfidence = {
			high: suggestions.filter((s) => s.confidence === "high"),
			medium: suggestions.filter((s) => s.confidence === "medium"),
			low: suggestions.filter((s) => s.confidence === "low"),
		};

		lines.push("## Summary");
		lines.push("");
		lines.push(`- Total suggestions: ${suggestions.length}`);
		lines.push(`- High confidence: ${byConfidence.high.length}`);
		lines.push(`- Medium confidence: ${byConfidence.medium.length}`);
		lines.push(`- Low confidence: ${byConfidence.low.length}`);
		lines.push("");

		lines.push("## Suggestions");
		lines.push("");

		for (const suggestion of suggestions) {
			const filename = suggestion.source.split("/").pop() ?? suggestion.source;
			lines.push(`### ${filename}`);
			lines.push("");
			lines.push(`- **Action:** ${suggestion.action}`);
			lines.push(`- **Confidence:** ${suggestion.confidence}`);
			lines.push(`- **Processor:** ${suggestion.processor}`);
			if (isCreateNoteSuggestion(suggestion) && suggestion.suggestedTitle) {
				lines.push(`- **Suggested Title:** ${suggestion.suggestedTitle}`);
			}
			if (
				(isCreateNoteSuggestion(suggestion) || isMoveSuggestion(suggestion)) &&
				suggestion.suggestedDestination
			) {
				lines.push(
					`- **Suggested Destination:** ${suggestion.suggestedDestination}`,
				);
			}
			lines.push(`- **Reason:** ${suggestion.reason}`);
			lines.push("");
		}

		return lines.join("\n");
	}
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Layer 4: Cleanup orphaned staging files from interrupted operations.
 * Detects notes left in .inbox-staging and moves them to final destination
 * or deletes them if they're truly orphaned (no registry entry).
 */
async function cleanupOrphanedStaging(
	vaultPath: string,
	registry: ReturnType<typeof createRegistry>,
	cid: string,
): Promise<void> {
	const stagingDir = join(vaultPath, ".inbox-staging");
	if (!pathExistsSync(stagingDir)) return;

	try {
		const files = readDir(stagingDir).filter((f) => f.endsWith(".md"));
		if (files.length === 0) return;

		if (inboxLogger) {
			inboxLogger.info`Found ${files.length} orphaned files in staging, attempting cleanup ${cid}`;
		}

		for (const file of files) {
			const stagingPath = join(stagingDir, file);

			// Check if this file has a registry entry with orphanedInStaging flag
			const allItems = registry.getAllItems();
			const matchingEntry = allItems.find(
				(item: ProcessedItem) =>
					item.createdNote?.includes(file) && item.orphanedInStaging === true,
			);

			if (matchingEntry) {
				// Found registry entry - try to move to final destination
				if (inboxLogger) {
					inboxLogger.info`Recovering orphaned staging file: ${file} ${cid}`;
				}

				// Determine final destination from note type
				try {
					const config = loadConfig();
					const content = readTextFileSync(stagingPath);
					const { attributes } = parseFrontmatter(content);
					const noteType = attributes.note_type as string | undefined;

					let finalDest = "";
					if (noteType && config.defaultDestinations?.[noteType]) {
						finalDest = config.defaultDestinations[noteType];
					}

					const finalPath = join(vaultPath, finalDest, file);
					ensureDirSync(dirname(finalPath));
					await moveFile(stagingPath, finalPath);

					// Update registry with final path (orphanedInStaging will be overridden)
					const updatedItem: ProcessedItem = {
						sourceHash: matchingEntry.sourceHash,
						sourcePath: matchingEntry.sourcePath,
						processedAt: matchingEntry.processedAt,
						createdNote: join(finalDest, file),
						movedAttachment: matchingEntry.movedAttachment,
						orphanedInStaging: false,
					};
					registry.markProcessed(updatedItem);

					if (inboxLogger) {
						inboxLogger.info`Recovered orphaned file to final destination: ${finalPath} ${cid}`;
					}
				} catch (error) {
					if (inboxLogger) {
						inboxLogger.warn`Failed to recover orphaned file ${file}: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
					}
				}
			} else {
				// No registry entry - truly orphaned, delete after 24 hours
				try {
					const stats = await Bun.file(stagingPath).stat();
					const ageMs = Date.now() - stats.mtime.getTime();
					const oneDayMs = 24 * 60 * 60 * 1000;

					if (ageMs > oneDayMs) {
						const fs = await import("node:fs");
						fs.unlinkSync(stagingPath);
						if (inboxLogger) {
							inboxLogger.info`Deleted stale orphaned file (>24h): ${file} ${cid}`;
						}
					}
				} catch (error) {
					if (inboxLogger) {
						inboxLogger.warn`Failed to check/delete orphaned file ${file}: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
					}
				}
			}
		}

		await registry.save();
	} catch (error) {
		if (inboxLogger) {
			inboxLogger.warn`Failed to cleanup orphaned staging files: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
		}
	}
}

/**
 * Get list of areas from vault (recursive scan for all .md files).
 *
 * Uses config.paraFolders to determine the areas folder path.
 * Falls back to DEFAULT_PARA_FOLDERS if not configured.
 *
 * @param vaultPath - Absolute path to vault root
 * @param paraFolders - PARA folder mappings from config (optional)
 * @returns Array of area names (without .md extension)
 *
 * @example
 * // With config: "02 Areas/Psychotherapy/Psychotherapy.md" -> "Psychotherapy"
 */
function getVaultAreas(
	vaultPath: string,
	paraFolders?: Record<string, string>,
): string[] {
	const folders = paraFolders ?? DEFAULT_PARA_FOLDERS;
	const areasFolder = folders.areas ?? DEFAULT_PARA_FOLDERS.areas ?? "02 Areas";
	const areasPath = join(vaultPath, areasFolder);
	try {
		const files = globFilesSync("**/*.md", { cwd: areasPath, absolute: false });
		const areas = files.map((file) => basename(file, ".md"));
		return [...new Set(areas)]; // Dedupe in case of same-named notes
	} catch {
		return [];
	}
}

/**
 * Get list of projects from vault (recursive scan for all .md files).
 *
 * Uses config.paraFolders to determine the projects folder path.
 * Falls back to DEFAULT_PARA_FOLDERS if not configured.
 *
 * @param vaultPath - Absolute path to vault root
 * @param paraFolders - PARA folder mappings from config (optional)
 * @returns Array of project names (without .md extension)
 *
 * @example
 * // With config: "01 Projects/Work/Build Garden Shed.md" -> "Build Garden Shed"
 */
function getVaultProjects(
	vaultPath: string,
	paraFolders?: Record<string, string>,
): string[] {
	const folders = paraFolders ?? DEFAULT_PARA_FOLDERS;
	const projectsFolder =
		folders.projects ?? DEFAULT_PARA_FOLDERS.projects ?? "01 Projects";
	const projectsPath = join(vaultPath, projectsFolder);
	try {
		const files = globFilesSync("**/*.md", {
			cwd: projectsPath,
			absolute: false,
		});
		const projects = files.map((file) => basename(file, ".md"));
		return [...new Set(projects)]; // Dedupe in case of same-named notes
	} catch {
		return [];
	}
}

// Lazy-loaded LLM module to avoid circular dependencies at module load time
let llmModule: typeof import("@sidequest/core/llm") | null = null;

/**
 * Call LLM using the @sidequest/core/llm abstraction.
 */
async function callLLM(
	prompt: string,
	provider: string,
	model?: string,
): Promise<string> {
	// Lazy load once, then reuse cached module
	if (!llmModule) {
		llmModule = await import("@sidequest/core/llm");
	}
	const { callModel } = llmModule;

	// Determine the model to use based on provider
	// Cast to satisfy the type - callModel will validate
	const resolvedModel = (model ??
		(provider === "haiku" ? "haiku" : "sonnet")) as
		| "sonnet"
		| "haiku"
		| "qwen:7b"
		| "qwen:14b"
		| "qwen2.5:14b"
		| "qwen-coder:17b"
		| "qwen-coder:14b";

	return callModel({
		model: resolvedModel,
		prompt,
	});
}

/**
 * Execute a single suggestion.
 *
 * For create-note actions:
 * 1. Move PDF to Attachments folder with dated name
 * 2. Create note with template (TBD - for now just moves attachment)
 * 3. Update registry
 */
async function executeSuggestion(
	suggestion: InboxSuggestion,
	config: {
		vaultPath: string;
		inboxFolder: string;
		attachmentsFolder: string;
		templatesFolder: string;
	},
	registry: ReturnType<typeof createRegistry>,
	cid: string,
): Promise<ExecutionResult> {
	const sourcePath = join(config.vaultPath, suggestion.source);
	const filename = basename(suggestion.source);

	if (executeLogger) {
		executeLogger.debug`Executing suggestion id=${suggestion.id} action=${suggestion.action} source=${filename} ${cid}`;
	}

	// Generate dated attachment name: YYYYMMDD-HHMM-description.ext
	// Use LLM-suggested description if available, otherwise extract from filename
	let datedFilename: string;

	// Extract suggestedAttachmentName if present on the suggestion type
	// (available on create-note, move, rename, and link suggestions)
	const suggestedName =
		"suggestedAttachmentName" in suggestion
			? suggestion.suggestedAttachmentName
			: undefined;

	if (suggestedName) {
		// LLM provided a clean description - use it directly
		const ext = extname(suggestion.source);
		const timestamp = new Date();
		const year = timestamp.getFullYear();
		const month = String(timestamp.getMonth() + 1).padStart(2, "0");
		const day = String(timestamp.getDate()).padStart(2, "0");
		const hour = String(timestamp.getHours()).padStart(2, "0");
		const minute = String(timestamp.getMinutes()).padStart(2, "0");
		const timestampPrefix = `${year}${month}${day}-${hour}${minute}`;
		datedFilename = `${timestampPrefix}-${suggestedName}${ext}`;
	} else {
		// Fallback: extract description from messy filename
		datedFilename = generateFilename(suggestion.source);
	}

	const intendedAttachmentDest = join(
		config.vaultPath,
		config.attachmentsFolder,
		datedFilename,
	);

	// Generate unique path to prevent overwriting existing files
	const attachmentDest = generateUniquePath(intendedAttachmentDest);
	const actualFilename = basename(attachmentDest);
	const movedAttachmentPath = join(config.attachmentsFolder, actualFilename);

	if (attachmentDest !== intendedAttachmentDest && executeLogger) {
		executeLogger.warn`File collision detected - using unique name: ${actualFilename} ${cid}`;
	}

	// Hash the SOURCE file BEFORE moving (needed for registry)
	let hash: string;
	try {
		hash = await hashFile(sourcePath);
	} catch (error) {
		return {
			suggestionId: suggestion.id,
			success: false,
			action: suggestion.action,
			error: `Failed to hash source file: ${error instanceof Error ? error.message : "unknown"}`,
		};
	}

	let createdNotePath: string | undefined;
	let stagingNotePath: string | undefined;

	// Layer 2: Mark operation as in-progress in registry before any writes
	// This allows cleanup job to detect interrupted operations
	const inProgressMarker = {
		sourceHash: hash,
		sourcePath: suggestion.source,
		processedAt: new Date().toISOString(),
		inProgress: true,
	};
	registry.markInProgress(inProgressMarker);
	await registry.save();

	// Create note FIRST if action is create-note (before moving attachment)
	// Layer 1: Use staging directory pattern for atomic operations
	if (
		suggestion.action === "create-note" &&
		suggestion.suggestedNoteType &&
		suggestion.suggestedTitle
	) {
		try {
			// Load para-obsidian config to get template info
			const paraConfig = loadConfig();

			// Build args from suggestion using converter field mappings
			let args: Record<string, string> = {};

			// Find converter for this note type to get field mappings
			const converter = DEFAULT_INBOX_CONVERTERS.find(
				(c) => c.id === suggestion.suggestedNoteType,
			);

			// Map extracted fields using converter (LLM keys → Templater prompts)
			if (suggestion.extractedFields && converter) {
				args = mapFieldsToTemplate(suggestion.extractedFields, converter);
			} else if (suggestion.extractedFields) {
				// Fallback: use raw field names if no converter found
				for (const [key, value] of Object.entries(suggestion.extractedFields)) {
					if (typeof value === "string") {
						args[key] = value;
					} else if (value !== null && value !== undefined) {
						args[key] = String(value);
					}
				}
			}

			// Add area/project if suggested (use exact Templater prompt text as keys)
			// Wrap in wikilink format [[...]] as required by frontmatter validation
			if (suggestion.suggestedArea) {
				args["Area (leave empty if using project)"] =
					`[[${suggestion.suggestedArea}]]`;
			}
			if (suggestion.suggestedProject) {
				args["Project (leave empty if using area)"] =
					`[[${suggestion.suggestedProject}]]`;
			}

			// Create note in staging directory first (.inbox-staging)
			const stagingDir = join(config.vaultPath, ".inbox-staging");
			ensureDirSync(stagingDir);

			const result = createFromTemplate(paraConfig, {
				template: suggestion.suggestedNoteType,
				title: suggestion.suggestedTitle,
				dest: ".inbox-staging", // Stage in temp location
				args,
			});

			stagingNotePath = result.filePath;

			if (executeLogger) {
				executeLogger.info`Created note in staging path=${stagingNotePath} ${cid}`;
			}
		} catch (error) {
			// Note creation failed - clean up in-progress marker
			registry.clearInProgress(hash);
			await registry.save();

			if (executeLogger) {
				executeLogger.error`Failed to create note: ${error instanceof Error ? error.message : "unknown"} - attachment remains in inbox for retry ${cid}`;
			}
			return {
				suggestionId: suggestion.id,
				success: false,
				action: suggestion.action,
				error: `Note creation failed: ${error instanceof Error ? error.message : "unknown"}. Attachment remains in inbox - fix the issue and retry.`,
			};
		}
	}

	// Now move the attachment (note creation succeeded or wasn't needed)
	ensureDirSync(dirname(attachmentDest));

	// TOCTOU protection: Check file still exists before moving
	// File was hashed earlier, but could have been deleted by another process
	if (!pathExistsSync(sourcePath)) {
		// ROLLBACK: Clean up staging note and in-progress marker
		await rollbackOperation(stagingNotePath, hash, registry, cid);

		return {
			suggestionId: suggestion.id,
			success: false,
			action: suggestion.action,
			error: `Source file no longer exists: ${sourcePath}. It may have been moved or deleted by another process.`,
		};
	}

	try {
		await moveFile(sourcePath, attachmentDest);
	} catch (error) {
		// ROLLBACK: Clean up staging note and in-progress marker
		await rollbackOperation(stagingNotePath, hash, registry, cid);

		// Log the failure and return error
		if (executeLogger) {
			executeLogger.error`Failed to move attachment: ${error instanceof Error ? error.message : "unknown"} - attachment remains in inbox ${cid}`;
		}

		return {
			suggestionId: suggestion.id,
			success: false,
			action: suggestion.action,
			error: `Operation failed and was rolled back: ${error instanceof Error ? error.message : "unknown"}. Attachment remains in inbox - fix the issue and retry.`,
		};
	}

	// SUCCESS: Move staged note to final destination atomically
	if (stagingNotePath) {
		try {
			const paraConfig = loadConfig();
			// Type narrowing: only CreateNoteSuggestion and MoveSuggestion have suggestedDestination
			const finalDest =
				("suggestedDestination" in suggestion
					? suggestion.suggestedDestination
					: "") ?? "";
			const stagingAbsolute = resolveVaultPath(
				paraConfig.vault,
				stagingNotePath,
			);
			const finalRelative = join(finalDest, basename(stagingNotePath));
			const finalAbsolute = resolveVaultPath(paraConfig.vault, finalRelative);

			// Atomic rename from staging to final location
			await moveFile(stagingAbsolute.absolute, finalAbsolute.absolute);
			createdNotePath = finalRelative;

			if (executeLogger) {
				executeLogger.info`Moved note from staging to final destination=${createdNotePath} ${cid}`;
			}
		} catch (error) {
			// Critical: attachment moved but note stuck in staging
			// Log error but don't fail - cleanup job will handle orphans
			if (executeLogger) {
				executeLogger.error`Failed to move note from staging: ${error instanceof Error ? error.message : "unknown"} - note left in staging for cleanup ${cid}`;
			}

			// Mark staging path in registry for cleanup detection
			registry.markProcessed({
				sourceHash: hash,
				sourcePath: suggestion.source,
				processedAt: new Date().toISOString(),
				createdNote: stagingNotePath,
				movedAttachment: movedAttachmentPath,
				orphanedInStaging: true,
			});
			await registry.save();

			return {
				suggestionId: suggestion.id,
				success: true,
				action: suggestion.action,
				createdNote: undefined,
				movedAttachment: movedAttachmentPath,
				warning:
					"Note created in staging but move failed - will be cleaned up automatically",
			};
		}
	}

	// Inject attachment link into the note (if note was created)
	if (createdNotePath) {
		try {
			const paraConfig = loadConfig();
			const attachmentWikilink = `![[${movedAttachmentPath}]]`;
			const injectionResult = injectSections(paraConfig, createdNotePath, {
				Attachments: attachmentWikilink,
			});

			if (injectionResult.injected.length > 0) {
				if (executeLogger) {
					executeLogger.info`Injected attachment link into section=Attachments ${cid}`;
				}
			} else if (injectionResult.skipped.length > 0) {
				// Section doesn't exist - append to end of file
				if (executeLogger) {
					executeLogger.warn`No Attachments section found - appending to end of file ${cid}`;
				}
				const target = resolveVaultPath(paraConfig.vault, createdNotePath);
				const content = readTextFileSync(target.absolute);
				const updatedContent = `${content.trimEnd()}\n\n## Attachments\n\n${attachmentWikilink}\n`;
				writeTextFileSync(target.absolute, updatedContent);
				if (executeLogger) {
					executeLogger.info`Created Attachments section and added link ${cid}`;
				}
			}
		} catch (error) {
			if (executeLogger) {
				executeLogger.warn`Failed to inject attachment link: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
			}
			// Don't fail - note and attachment move succeeded, just missing link
		}
	}

	// Update registry - clear in-progress flag and mark as completed
	registry.clearInProgress(hash);
	registry.markProcessed({
		sourceHash: hash,
		sourcePath: suggestion.source,
		processedAt: new Date().toISOString(),
		createdNote: createdNotePath,
		movedAttachment: movedAttachmentPath,
	});

	if (executeLogger) {
		executeLogger.info`Executed suggestion id=${suggestion.id} movedTo=${datedFilename} createdNote=${createdNotePath ?? "none"} ${cid}`;
	}

	return {
		suggestionId: suggestion.id,
		success: true,
		action: suggestion.action,
		createdNote: createdNotePath,
		movedAttachment: movedAttachmentPath,
	};
}

/**
 * Layer 3: Atomic rollback helper - cleans up staging note and registry marker
 * Uses sync operations to ensure cleanup completes before returning control
 */
async function rollbackOperation(
	stagingNotePath: string | undefined,
	sourceHash: string,
	registry: ReturnType<typeof createRegistry>,
	cid: string,
): Promise<void> {
	if (stagingNotePath) {
		try {
			const fs = await import("node:fs");
			const stagingAbsolute = path.resolve(stagingNotePath);

			if (fs.existsSync(stagingAbsolute)) {
				fs.unlinkSync(stagingAbsolute);
				// Ensure deletion is durable
				const dir = path.dirname(stagingAbsolute);
				const fd = fs.openSync(dir, "r");
				fs.fsyncSync(fd);
				fs.closeSync(fd);

				if (executeLogger) {
					executeLogger.info`Rolled back staging note=${stagingNotePath} ${cid}`;
				}
			}
		} catch (rollbackError) {
			if (executeLogger) {
				executeLogger.error`Failed to rollback staging note: ${rollbackError instanceof Error ? rollbackError.message : "unknown"} ${cid}`;
			}
		}
	}

	// Clean up in-progress marker
	registry.clearInProgress(sourceHash);
	await registry.save();
}
