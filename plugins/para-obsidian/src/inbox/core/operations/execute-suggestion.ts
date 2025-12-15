/**
 * Single suggestion execution for inbox processing.
 *
 * Handles the execution of a single inbox suggestion:
 * - Moving attachments to dated names
 * - Creating notes from templates
 * - Injecting attachment links
 *
 * @module inbox/core/operations/execute-suggestion
 */

import { basename, dirname, extname, join } from "node:path";
import {
	ensureDirSync,
	moveFile,
	pathExistsSync,
	readTextFileSync,
	writeTextFileSync,
} from "@sidequest/core/fs";
import { loadConfig } from "../../../config/index";
import { autoCommitChanges } from "../../../git/index";
import { createFromTemplate, injectSections } from "../../../notes/create";
import { resolveVaultPath } from "../../../shared/fs";
import { executeLogger } from "../../../shared/logger";
import {
	DEFAULT_CLASSIFIERS,
	mapFieldsToTemplate,
} from "../../classify/classifiers";
import {
	type createRegistry,
	hashFile,
} from "../../registry/processed-registry";
import type { ExecutionResult, InboxSuggestion } from "../../types";
import { generateFilename, generateUniquePath } from "../engine-utils";
import { rollbackOperation } from "../staging/rollback";

/**
 * Engine configuration for suggestion execution.
 */
export interface ExecuteSuggestionConfig {
	readonly vaultPath: string;
	readonly inboxFolder: string;
	readonly attachmentsFolder: string;
	readonly templatesFolder: string;
}

/**
 * Execute a single suggestion.
 *
 * For create-note actions:
 * 1. Move PDF to Attachments folder with dated name
 * 2. Create note with template (TBD - for now just moves attachment)
 * 3. Update registry
 *
 * @param suggestion - The suggestion to execute
 * @param config - Engine configuration
 * @param registry - Registry instance for tracking processed items
 * @param cid - Correlation ID for logging
 * @returns Execution result
 */
export async function executeSuggestion(
	suggestion: InboxSuggestion,
	config: ExecuteSuggestionConfig,
	registry: ReturnType<typeof createRegistry>,
	cid: string,
): Promise<ExecutionResult> {
	const sourcePath = join(config.vaultPath, suggestion.source);
	const filename = basename(suggestion.source);

	if (executeLogger) {
		executeLogger.debug`Executing suggestion id=${suggestion.id} action=${suggestion.action} source=${filename} ${cid}`;
	}

	// Generate attachment filename
	// LLM-suggested names already include the document date (e.g., "2025-10-27-pv-foulkes-invoice")
	// Fallback uses processing timestamp (YYYYMMDD-HHMM-description)
	let datedFilename: string;

	// Extract suggestedAttachmentName if present on the suggestion type
	// (available on create-note, move, rename, and link suggestions)
	const suggestedName =
		"suggestedAttachmentName" in suggestion
			? suggestion.suggestedAttachmentName
			: undefined;

	if (suggestedName) {
		// LLM provided a filename with document date - use it directly (no timestamp prefix)
		const ext = extname(suggestion.source);
		datedFilename = `${suggestedName}${ext}`;
	} else {
		// Fallback: use processing timestamp + extracted description from filename
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
			const converter = DEFAULT_CLASSIFIERS.find(
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

	// Auto-commit changes if enabled (defense-in-depth: commit after each successful execution)
	const paraConfig = loadConfig();
	if (paraConfig.autoCommit) {
		const filesToCommit = [movedAttachmentPath];
		if (createdNotePath) {
			filesToCommit.push(createdNotePath);
		}
		try {
			await autoCommitChanges(
				paraConfig,
				filesToCommit,
				`inbox: ${createdNotePath ? basename(createdNotePath, ".md") : basename(movedAttachmentPath)}`,
			);
			if (executeLogger) {
				executeLogger.debug`Auto-committed ${filesToCommit.length} file(s) ${cid}`;
			}
		} catch (error) {
			// Log but don't fail - registry already updated, files moved successfully
			if (executeLogger) {
				executeLogger.warn`Auto-commit failed: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
			}
		}
	}

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
