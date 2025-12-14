/**
 * Note Creation Logic
 *
 * Handles creating notes from templates:
 * - Map extracted fields to template arguments
 * - Create note using para-obsidian createFromTemplate
 * - Handle area/project linking
 *
 * @module inbox/execute/note-creator
 */

import { loadConfig } from "../../config/index";
import { createFromTemplate } from "../../notes/create";
import type { executeLogger } from "../../shared/logger";
import {
	DEFAULT_INBOX_CONVERTERS,
	mapFieldsToTemplate,
} from "../classify/converters";
import type { InboxSuggestion } from "../types";
import type { NoteCreationResult } from "./types";

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
 * @returns Result with notePath or error
 */
export async function createNoteFromSuggestion(
	suggestion: InboxSuggestion,
	logger: typeof executeLogger,
	cid: string,
): Promise<NoteCreationResult> {
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

		// Create the note
		const result = createFromTemplate(paraConfig, {
			template: suggestion.suggestedNoteType,
			title: suggestion.suggestedTitle,
			dest: suggestion.suggestedDestination,
			args,
		});

		if (logger) {
			logger.info`Created note from template=${suggestion.suggestedNoteType} path=${result.filePath} ${cid}`;
		}

		return {
			success: true,
			notePath: result.filePath,
		};
	} catch (error) {
		if (logger) {
			logger.error`Failed to create note: ${error instanceof Error ? error.message : "unknown"} ${cid}`;
		}
		return {
			success: false,
			error: `Note creation failed: ${error instanceof Error ? error.message : "unknown"}`,
		};
	}
}
