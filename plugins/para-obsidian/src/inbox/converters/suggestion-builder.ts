/**
 * Suggestion Builder
 *
 * Transforms heuristic and LLM detection results into inbox suggestions.
 * This is Stage 5 of the inbox processing pipeline - the conversion layer
 * that maps classification results to actionable suggestions.
 *
 * @module converters/suggestion-builder
 */

import { join } from "node:path";
import { generateTitle } from "../core/engine-utils";
import type { DocumentTypeResult } from "../llm-detection";
import {
	type Confidence,
	createSuggestionId,
	type InboxAction,
	type InboxSuggestion,
	type ProcessorType,
} from "../types";

// =============================================================================
// Types
// =============================================================================

/**
 * Heuristic detection result from filename/content analysis.
 */
export interface HeuristicResult {
	/** Whether heuristics detected a document type */
	readonly detected: boolean;
	/** Suggested document type (invoice, booking, etc.) */
	readonly suggestedType?: string;
	/** Confidence score from heuristics (0.0 to 1.0) */
	readonly confidence: number;
}

/**
 * Input for building a suggestion.
 */
export interface SuggestionInput {
	/** Filename (basename only, no path) */
	readonly filename: string;
	/** Inbox folder path (relative to vault) */
	readonly inboxFolder: string;
	/** Heuristic detection result */
	readonly heuristicResult: HeuristicResult;
	/** LLM detection result (null if LLM was not used) */
	readonly llmResult: DocumentTypeResult | null;
	/** Processor type that generated this suggestion */
	readonly processor?: ProcessorType;
}

// =============================================================================
// Suggestion Building
// =============================================================================

/**
 * Build a suggestion from heuristic and LLM results.
 *
 * Decision logic:
 * 1. If LLM detected with high confidence (≥0.7): Use LLM result
 *    - Boost to HIGH if heuristics agree
 * 2. If only heuristics detected (>0.5): Use heuristic result
 * 3. If LLM detected with low confidence: Mark for review
 * 4. No detection: Skip
 *
 * @param input - Suggestion input with detection results
 * @returns Inbox suggestion ready for user review
 */
export function buildSuggestion(input: SuggestionInput): InboxSuggestion {
	const {
		filename,
		inboxFolder,
		heuristicResult,
		llmResult,
		processor = "attachments",
	} = input;

	const source = join(inboxFolder, filename);

	// Determine confidence level
	let confidence: Confidence;
	let action: InboxAction;
	let suggestedNoteType: string | undefined;
	let suggestedArea: string | undefined;
	let suggestedProject: string | undefined;
	let extractedFields: Record<string, unknown> | undefined;
	let reason: string;

	// If LLM detected with high confidence
	if (llmResult && llmResult.confidence >= 0.7) {
		confidence = llmResult.confidence >= 0.9 ? "high" : "medium";
		action = "create-note";
		suggestedNoteType = llmResult.documentType;
		suggestedArea = llmResult.suggestedArea ?? undefined;
		suggestedProject = llmResult.suggestedProject ?? undefined;
		extractedFields = llmResult.extractedFields ?? undefined;
		reason =
			llmResult.reasoning ??
			`LLM detected ${llmResult.documentType} with ${(llmResult.confidence * 100).toFixed(0)}% confidence`;

		// Boost confidence if heuristics agree
		if (
			heuristicResult.detected &&
			heuristicResult.suggestedType === llmResult.documentType
		) {
			confidence = "high";
			reason = `Heuristics and LLM agree: ${llmResult.documentType}`;
		}
	}
	// If only heuristics detected
	else if (heuristicResult.detected && heuristicResult.confidence > 0.5) {
		confidence = heuristicResult.confidence >= 0.8 ? "medium" : "low";
		action = "create-note";
		suggestedNoteType = heuristicResult.suggestedType;
		reason = `Heuristic detection: ${heuristicResult.suggestedType} (${(heuristicResult.confidence * 100).toFixed(0)}% confidence)`;
	}
	// Low confidence - needs review
	else if (llmResult) {
		confidence = "low";
		action = llmResult.documentType === "generic" ? "skip" : "create-note";
		suggestedNoteType = llmResult.documentType;
		reason = `Low confidence LLM detection: ${llmResult.documentType}`;
	}
	// No detection
	else {
		confidence = "low";
		action = "skip";
		reason = "Unable to determine document type";
	}

	// Generate suggested title from filename
	const suggestedTitle = generateTitle(
		filename,
		suggestedNoteType,
		extractedFields,
	);

	// Use LLM-suggested filename description if available
	const suggestedAttachmentName = llmResult?.suggestedFilenameDescription
		? llmResult.suggestedFilenameDescription
		: undefined;

	return {
		id: createSuggestionId(crypto.randomUUID()),
		source,
		processor,
		confidence,
		action,
		suggestedNoteType,
		suggestedTitle,
		suggestedArea,
		suggestedProject,
		extractedFields,
		suggestedAttachmentName,
		reason,
	};
}
