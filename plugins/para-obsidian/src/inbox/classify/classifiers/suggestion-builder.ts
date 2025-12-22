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
	/** Extracted markdown content for Type A documents (embedded in note body) */
	readonly extractedMarkdown?: string;
	/** Source of truth from classifier ("markdown" for Type A, "binary" for Type B) */
	readonly sourceOfTruth?: "markdown" | "binary";
}

// =============================================================================
// Suggestion Building
// =============================================================================

/**
 * Threshold for strong filename match - when the user explicitly names a file
 * with a type keyword (e.g., "invoice"), this is authoritative and should not
 * be overridden by LLM classification.
 */
const STRONG_FILENAME_THRESHOLD = 0.9;

/**
 * Build a suggestion from heuristic and LLM results.
 *
 * Decision logic (priority order):
 * 1. If detectionSource provided: Use it (frontmatter fast-path)
 * 2. **NEW**: If heuristics have a strong filename match (≥0.9): Use heuristic type
 *    - This is authoritative - user explicitly named the file with a type keyword
 *    - Still use LLM for field extraction, area, and project suggestions
 * 3. If LLM and heuristics agree: HIGH confidence
 * 4. If LLM detected with high confidence (≥0.7): Use LLM result
 * 5. If only heuristics detected (>0.5): Use heuristic result
 * 6. If LLM detected with low confidence: Mark for review
 * 7. No detection: Skip
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

	// Check for strong filename match - this is AUTHORITATIVE
	// When a user explicitly names a file with a type keyword (e.g., "invoice.pdf"),
	// that signal should NOT be overridden by LLM guessing at the content
	const hasStrongFilenameMatch =
		heuristicResult.detected &&
		heuristicResult.confidence >= STRONG_FILENAME_THRESHOLD &&
		heuristicResult.suggestedType;

	// PRIORITY 1: Strong filename match is authoritative
	// User explicitly named the file with a type keyword - trust them
	if (hasStrongFilenameMatch && !isLLMFallback) {
		confidence = "high";
		action = "create-note";
		suggestedNoteType = heuristicResult.suggestedType;
		// Still use LLM for field extraction, area, and project (if available)
		suggestedArea = llmResult?.suggestedArea ?? undefined;
		suggestedProject = llmResult?.suggestedProject ?? undefined;
		extractedFields = llmResult?.extractedFields ?? undefined;

		// Check if LLM agreed or disagreed
		if (llmResult && llmResult.documentType === heuristicResult.suggestedType) {
			reason = `Filename and LLM agree: ${heuristicResult.suggestedType}`;
			detectionSource = "llm+heuristic";
		} else if (
			llmResult &&
			llmResult.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM
		) {
			// LLM disagrees but filename is authoritative
			reason = `Filename authoritative: ${heuristicResult.suggestedType} (LLM suggested ${llmResult.documentType}, overridden)`;
			detectionSource = "heuristic";
		} else {
			reason = `Strong filename match: ${heuristicResult.suggestedType}`;
			detectionSource = "heuristic";
		}
	}
	// PRIORITY 2: LLM and heuristics agree (both detected same type)
	else if (
		llmResult &&
		!isLLMFallback &&
		llmResult.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM &&
		heuristicResult.detected &&
		heuristicResult.suggestedType === llmResult.documentType
	) {
		confidence = "high";
		action = "create-note";
		suggestedNoteType = llmResult.documentType;
		suggestedArea = llmResult.suggestedArea ?? undefined;
		suggestedProject = llmResult.suggestedProject ?? undefined;
		extractedFields = llmResult.extractedFields ?? undefined;
		reason = `Heuristics and LLM agree: ${llmResult.documentType}`;
		detectionSource = "llm+heuristic";
	}
	// PRIORITY 3: LLM detected with high confidence (no strong filename match)
	else if (
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
	}
	// PRIORITY 4: Heuristics detected OR LLM fallback scenario
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
	// ONLY for Type B (binary source of truth) - Type A embeds content in markdown
	const suggestedAttachmentName =
		hash && input.sourceOfTruth !== "markdown"
			? generateFilename(filename, hash, suggestedNoteType, extractedFields)
			: undefined;

	// Pass through extraction warnings from LLM
	const extractionWarnings =
		llmResult?.extractionWarnings && llmResult.extractionWarnings.length > 0
			? llmResult.extractionWarnings
			: undefined;

	// Set destination based on routing source
	// Fast-path items (have area/project frontmatter) get auto-routed to their destination
	// LLM-path items (no routing fields) get created in inbox - user adds tags in Obsidian later
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
		// LLM-path: No frontmatter routing → create note in inbox folder
		// Store LLM suggestions for DISPLAY (user sees what LLM detected)
		// Note created in inbox with null area/project - user updates in Obsidian
		llmSuggestedArea = suggestedArea;
		llmSuggestedProject = suggestedProject;
		// Set destination to inbox folder so note is created there
		suggestedDestination = inboxFolder;
	}

	// Return properly typed discriminated union based on action
	if (action === "create-note") {
		// Debug: Log Type A/B fields being set on suggestion
		if (input.extractedMarkdown || input.sourceOfTruth) {
			console.error(
				`[buildSuggestion] Type A/B fields: sourceOfTruth=${input.sourceOfTruth ?? "undefined"} extractedMarkdownLength=${input.extractedMarkdown?.length ?? 0}`,
			);
		}

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
			// Type A/B document processing fields
			suggestedContent: input.extractedMarkdown,
			sourceOfTruth: input.sourceOfTruth,
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
