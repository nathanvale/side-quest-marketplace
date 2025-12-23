/**
 * Note Creation Logic
 *
 * Handles creating notes from templates:
 * - Map extracted fields to template arguments
 * - Create note using para-obsidian createFromTemplate
 * - Handle area/project linking
 * - Move pre-classified notes (frontmatter detection)
 *
 * @module inbox/execute/note-creator
 */

import { mkdir, rename } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadConfig } from "../../config/index";
import { createFromTemplate } from "../../notes/create";
import type { executeLogger } from "../../shared/logger";
import {
	DEFAULT_CLASSIFIERS,
	mapFieldsToTemplate,
} from "../classify/classifiers";
import { generateUniqueNotePath } from "../core/engine-utils";
import type { OperationContext } from "../shared/context";
import type { CreateNoteSuggestion, InboxSuggestion } from "../types";
import type { NoteCreationResult } from "./types";

/**
 * Move a pre-classified note from inbox to its destination.
 *
 * Used when a note already has valid frontmatter with type/area/project.
 * Instead of creating from template, we just move the existing file.
 *
 * @param suggestion - Pre-classified suggestion with source and destination
 * @param vaultPath - Absolute vault root path
 * @param logger - Optional logger instance
 * @param cid - Correlation ID for logging
 * @param options - Optional operation context
 * @returns Result with notePath or error
 */
export async function movePreClassifiedNote(
	suggestion: CreateNoteSuggestion,
	vaultPath: string,
	logger: typeof executeLogger,
	cid: string,
	options?: OperationContext,
): Promise<NoteCreationResult> {
	const { sessionCid } = options ?? {};
	if (!suggestion.suggestedDestination) {
		return {
			success: false,
			error: "Pre-classified note missing destination",
		};
	}

	try {
		const sourceFilename = basename(suggestion.source);
		const sourcePath = join(vaultPath, suggestion.source);
		const destDir = join(vaultPath, suggestion.suggestedDestination);

		// Generate collision-safe destination path
		const initialDestPath = join(destDir, sourceFilename);
		const destPath = generateUniqueNotePath(initialDestPath);

		// Log collision if path was modified
		if (destPath !== initialDestPath) {
			logger.warn`Pre-classified note collision: renamed to ${basename(destPath)} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
		}

		// Ensure destination directory exists
		await mkdir(destDir, { recursive: true });

		// Move the file
		await rename(sourcePath, destPath);

		// Return vault-relative path
		const notePath = join(suggestion.suggestedDestination, basename(destPath));

		if (logger) {
			logger.info`Moved pre-classified note from=${suggestion.source} to=${notePath} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
		}

		return {
			success: true,
			notePath,
		};
	} catch (error) {
		if (logger) {
			logger.error`Failed to move pre-classified note: ${error instanceof Error ? error.message : "unknown"} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
		}
		return {
			success: false,
			error: `Failed to move note: ${error instanceof Error ? error.message : "unknown"}`,
		};
	}
}

/**
 * Create a note from a suggestion using para-obsidian templates.
 *
 * Steps:
 * 1. Load para-obsidian config
 * 2. Map extracted fields using converter
 * 3. Add area/project links (wrapped in wikilinks)
 * 4. Call createFromTemplate
 *
 * @param suggestion - Suggestion containing note details
 * @param logger - Optional logger instance
 * @param cid - Correlation ID for logging
 * @param options - Optional operation context
 * @returns Result with notePath or error
 */
export async function createNoteFromSuggestion(
	suggestion: InboxSuggestion,
	logger: typeof executeLogger,
	cid: string,
	options?: OperationContext,
): Promise<NoteCreationResult> {
	const { sessionCid } = options ?? {};
	if (
		suggestion.action !== "create-note" ||
		!suggestion.suggestedNoteType ||
		!suggestion.suggestedTitle
	) {
		return {
			success: false,
			error: "Invalid suggestion: missing note type or title",
		};
	}

	try {
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

		// Area and project fields are left empty - user fills them in manually in Obsidian
		// No longer auto-suggesting or auto-routing based on LLM classification

		// Create the note
		// For Type A documents (sourceOfTruth: "markdown"), suggestedContent contains
		// the extracted markdown to embed in the note body via {{content}} placeholder
		// Use classifier's template name if available (e.g., "generic" ID → "document" template)
		const templateName =
			converter?.template.name ?? suggestion.suggestedNoteType;
		const result = createFromTemplate(paraConfig, {
			template: templateName,
			title: suggestion.suggestedTitle,
			dest: suggestion.suggestedDestination,
			args,
			content: suggestion.suggestedContent,
		});

		if (logger) {
			logger.info`Created note from template=${templateName} path=${result.filePath} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
		}

		return {
			success: true,
			notePath: result.filePath,
		};
	} catch (error) {
		if (logger) {
			logger.error`Failed to create note: ${error instanceof Error ? error.message : "unknown"} ${cid}${sessionCid ? ` ${sessionCid}` : ""}`;
		}
		return {
			success: false,
			error: `Note creation failed: ${error instanceof Error ? error.message : "unknown"}`,
		};
	}
}
