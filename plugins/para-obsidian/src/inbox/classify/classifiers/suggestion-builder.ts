/**
 * Suggestion Builder
 *
 * Transforms heuristic and LLM detection results into inbox suggestions.
 * This is Stage 5 of the inbox processing pipeline - the conversion layer
 * that maps classification results to actionable suggestions.
 *
 * @module classifiers/suggestion-builder
 */

import { join } from "node:path";
import { generateFilename, generateTitle } from "../../core/engine-utils";
import {
	CONFIDENCE_THRESHOLDS,
	type Confidence,
	createSuggestionId,
	type DetectionSource,
	type InboxAction,
	type InboxSuggestion,
	type ProcessorType,
} from "../../types";
import type { DocumentTypeResult } from "../llm-classifier";

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
	/** Optional override for detection source (e.g., "frontmatter" for pre-tagged notes) */
	readonly detectionSource?: DetectionSource;
	/** SHA256 hash of file content (links note title to attachment filename) */
	readonly hash?: string;
}

// =============================================================================
// Suggestion Building
// =============================================================================

/**
 * Build a suggestion from heuristic and LLM results.
 *
 * Decision logic:
 * 1. If detectionSource provided: Use it (frontmatter fast-path)
 * 2. If LLM detected with high confidence (≥0.7): Use LLM result
 *    - Boost to HIGH if heuristics agree
 * 3. If only heuristics detected (>0.5): Use heuristic result
 * 4. If LLM detected with low confidence: Mark for review
 * 5. No detection: Skip
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
		detectionSource: providedDetectionSource,
		hash,
	} = input;

	const source = join(inboxFolder, filename);

	// Determine confidence level and detection source
	let confidence: Confidence;
	let action: InboxAction;
	let suggestedNoteType: string | undefined;
	let suggestedArea: string | undefined;
	let suggestedProject: string | undefined;
	let extractedFields: Record<string, unknown> | undefined;
	let reason: string;
	let detectionSource: DetectionSource;

	// Check if LLM result indicates a fallback scenario (error with warnings)
	const isLLMFallback =
		llmResult &&
		llmResult.confidence === 0 &&
		llmResult.extractionWarnings &&
		llmResult.extractionWarnings.length > 0;

	// Calculate detectionSource (can be overridden by providedDetectionSource later)
	// If LLM detected with high confidence (using CONFIDENCE_THRESHOLDS for consistency)
	if (
		llmResult &&
		!isLLMFallback &&
		llmResult.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM
	) {
		confidence =
			llmResult.confidence >= CONFIDENCE_THRESHOLDS.HIGH ? "high" : "medium";
		action = "create-note";
		suggestedNoteType = llmResult.documentType;
		suggestedArea = llmResult.suggestedArea ?? undefined;
		suggestedProject = llmResult.suggestedProject ?? undefined;
		extractedFields = llmResult.extractedFields ?? undefined;
		reason =
			llmResult.reasoning ??
			`LLM detected ${llmResult.documentType} with ${(llmResult.confidence * 100).toFixed(0)}% confidence`;
		detectionSource = "llm";

		// Boost confidence if heuristics agree
		if (
			heuristicResult.detected &&
			heuristicResult.suggestedType === llmResult.documentType
		) {
			confidence = "high";
			reason = `Heuristics and LLM agree: ${llmResult.documentType}`;
			detectionSource = "llm+heuristic";
		}
	}
	// If heuristics detected OR LLM fallback scenario (use heuristics + frontmatter extraction)
	else if (
		(heuristicResult.detected &&
			heuristicResult.confidence > CONFIDENCE_THRESHOLDS.HEURISTIC_MIN) ||
		isLLMFallback
	) {
		confidence =
			heuristicResult.confidence >= CONFIDENCE_THRESHOLDS.HEURISTIC_MEDIUM
				? "medium"
				: "low";
		action = "create-note";
		suggestedNoteType = heuristicResult.suggestedType;
		reason = `Heuristic detection: ${heuristicResult.suggestedType ?? "generic"} (${(heuristicResult.confidence * 100).toFixed(0)}% confidence)`;
		detectionSource = "heuristic";

		// If LLM fallback, merge extracted fields from frontmatter
		if (isLLMFallback && llmResult.extractedFields) {
			extractedFields = llmResult.extractedFields;
		}
	}
	// Low confidence - needs review
	else if (llmResult) {
		confidence = "low";
		action = llmResult.documentType === "generic" ? "skip" : "create-note";
		suggestedNoteType = llmResult.documentType;
		reason = `Low confidence LLM detection: ${llmResult.documentType}`;
		detectionSource = "llm";
	}
	// No detection
	else {
		confidence = "low";
		action = "skip";
		reason = "Unable to determine document type";
		detectionSource = "none";
	}

	// Override detection source if provided (frontmatter fast-path)
	if (providedDetectionSource) {
		detectionSource = providedDetectionSource;
	}

	// Generate suggested title (with hash for linking to attachment)
	const suggestedTitle = generateTitle(
		filename,
		suggestedNoteType,
		extractedFields,
		hash,
	);

	// Generate attachment name using hash (guarantees uniqueness)
	// Format mirrors note title: date-hash-type-provider.ext (lowercase, hyphens)
	const suggestedAttachmentName = hash
		? generateFilename(filename, hash, suggestedNoteType, extractedFields)
		: undefined;

	// Pass through extraction warnings from LLM
	const extractionWarnings =
		llmResult?.extractionWarnings && llmResult.extractionWarnings.length > 0
			? llmResult.extractionWarnings
			: undefined;

	// Set destination based on routing source
	// Fast-path items (have area/project frontmatter) get auto-routed with destination
	// LLM-path items (no routing fields) do NOT get destination - user must choose
	let suggestedDestination: string | undefined;
	let llmSuggestedArea: string | undefined;
	let llmSuggestedProject: string | undefined;

	// Check if this is a fast-path item with frontmatter routing
	const hasFrontmatterRouting =
		detectionSource === "frontmatter" && (suggestedArea || suggestedProject);

	if (hasFrontmatterRouting) {
		// Fast-path: Has area/project in frontmatter → set destination for auto-routing
		suggestedDestination = suggestedArea || suggestedProject;
	} else {
		// LLM-path: No frontmatter routing → store LLM suggestions for DISPLAY only
		// User must explicitly accept with y<n> or set with d<n>
		llmSuggestedArea = suggestedArea;
		llmSuggestedProject = suggestedProject;
		// Leave suggestedDestination undefined - user MUST set it
	}

	// Return properly typed discriminated union based on action
	if (action === "create-note") {
		return {
			id: createSuggestionId(),
			source,
			processor,
			confidence,
			detectionSource,
			action: "create-note" as const,
			suggestedNoteType: suggestedNoteType ?? "generic",
			suggestedTitle: suggestedTitle ?? filename,
			suggestedArea,
			suggestedProject,
			suggestedDestination,
			extractedFields,
			suggestedAttachmentName,
			extractionWarnings,
			reason,
			llmSuggestedArea,
			llmSuggestedProject,
		};
	}

	// Skip action - no suggestedNoteType or suggestedTitle
	return {
		id: createSuggestionId(),
		source,
		processor,
		confidence,
		detectionSource,
		action: "skip" as const,
		extractionWarnings,
		reason,
	};
}
