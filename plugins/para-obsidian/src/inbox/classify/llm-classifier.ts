/**
 * Inbox Processing Framework - LLM Detection
 *
 * Uses LLM to detect document type and extract structured fields from inbox items.
 * Integrates with existing @sidequest/core/llm abstraction.
 *
 * @example
 * ```typescript
 * import { buildInboxPrompt, parseDetectionResponse, detectDocumentType } from "./llm-detection";
 *
 * const prompt = buildInboxPrompt({ content, filename, vaultContext });
 * const response = await callLLM(prompt);
 * const result = parseDetectionResponse(response);
 * ```
 */

import type { InboxConverter } from "./classifiers";

// =============================================================================
// Types
// =============================================================================

/**
 * Vault context for LLM to use in suggestions.
 */
export interface InboxVaultContext {
	/** Available areas in the vault */
	readonly areas: ReadonlyArray<string>;

	/** Available projects in the vault */
	readonly projects: ReadonlyArray<string>;

	/** Optional suggested tags */
	readonly suggestedTags?: ReadonlyArray<string>;
}

/**
 * Options for building the inbox detection prompt.
 */
export interface InboxPromptOptions {
	/** Extracted text content from the document */
	readonly content: string;

	/** Original filename */
	readonly filename: string;

	/** Vault context for suggestions */
	readonly vaultContext: InboxVaultContext;

	/** Optional user hint to guide detection */
	readonly userHint?: string;
}

/**
 * Extracted fields from a document.
 * Keys vary by document type.
 */
export interface FieldExtractionResult {
	// Common fields
	readonly date?: string;
	readonly provider?: string;

	// Invoice fields
	readonly amount?: string;
	readonly currency?: string;
	readonly invoiceNumber?: string;
	readonly abn?: string;
	readonly gst?: string;

	// Booking fields
	readonly bookingReference?: string;
	readonly confirmationNumber?: string;
	readonly departure?: string;
	readonly arrival?: string;
	readonly passenger?: string;
	readonly checkIn?: string;
	readonly checkOut?: string;

	// Allow additional fields from converters
	readonly [key: string]: unknown;
}

/**
 * Result of LLM document type detection.
 */
export interface DocumentTypeResult {
	/**
	 * Detected document type.
	 * Matches an InboxConverter id (e.g., 'invoice', 'booking').
	 * Falls back to 'generic' if no converter matches.
	 */
	readonly documentType: string;

	/** Confidence in the detection (0-1) */
	readonly confidence: number;

	/** Extracted fields from the document */
	readonly extractedFields?: FieldExtractionResult | null;

	/** Suggested attachment filename description (e.g., "pv-foulkes-invoice-0004447") */
	readonly suggestedFilenameDescription?: string | null;

	/** LLM's reasoning for the classification */
	readonly reasoning?: string;

	/** Warnings about fields that could not be extracted */
	readonly extractionWarnings?: readonly string[];
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default document types for fallback when no converters provided.
 * @deprecated Use converters instead. This will be removed in a future version.
 */
const DEFAULT_DOCUMENT_TYPES = [
	"invoice",
	"booking",
	"receipt",
	"session",
	"generic",
] as const;

/**
 * Maximum length for user-provided content in prompts to prevent context overflow
 */
const MAX_CONTENT_LENGTH = 10000;

/**
 * Maximum length for user hints and filenames to prevent prompt injection
 */
const MAX_USER_INPUT_LENGTH = 500;

/**
 * Example JSON response format for the prompt.
 */
const EXAMPLE_RESPONSE = {
	documentType: "invoice",
	confidence: 0.92,
	suggestedFilenameDescription: "2024-12-01-dr-smith-medical-practice-invoice",
	extractedFields: {
		amount: "220.00",
		currency: "AUD",
		provider: "Dr Smith Medical Practice",
		date: "2024-12-01",
		invoiceNumber: "INV-4480",
	},
	reasoning:
		"Document contains TAX INVOICE header, ABN, amount due, and medical provider details",
	extractionWarnings: [],
};

// =============================================================================
// Sanitization
// =============================================================================

/**
 * Sanitize user-provided content for safe inclusion in LLM prompts.
 *
 * Protects against prompt injection by:
 * - Escaping markdown code blocks that could contain control sequences
 * - Removing potential instruction injection patterns
 * - Applying length limits to prevent context overflow
 * - Preserving readability for legitimate content
 *
 * @param text - Raw user input (file content, hints, filenames)
 * @param maxLength - Maximum allowed length (default: MAX_CONTENT_LENGTH)
 * @returns Sanitized text safe for prompt inclusion
 *
 * @example
 * ```typescript
 * const safe = sanitizeForPrompt(userContent)
 * const prompt = `Analyze this: ${safe}`
 * ```
 */
function sanitizeForPrompt(
	text: string,
	maxLength = MAX_CONTENT_LENGTH,
): string {
	// Apply length limit first
	let sanitized = text.slice(0, maxLength);

	// Escape markdown code blocks that could contain control sequences
	sanitized = sanitized.replace(/```/g, "\\`\\`\\`");

	// Remove potential instruction injection patterns (attempts to override system instructions)
	// These patterns are common in prompt injection attacks
	const injectionPatterns = [
		/ignore\s+(previous|above|all)\s+instructions/gi,
		/disregard\s+(previous|above|all)/gi,
		/forget\s+(previous|above|all)/gi,
		/new\s+instructions:/gi,
		/system\s*:/gi,
		/\[INST\]/gi,
		/\[\/INST\]/gi,
		/<\|im_start\|>/gi,
		/<\|im_end\|>/gi,
	];

	for (const pattern of injectionPatterns) {
		sanitized = sanitized.replace(pattern, "[REDACTED]");
	}

	// Escape special markdown headers that could structure prompts
	sanitized = sanitized.replace(/^#{1,6}\s/gm, "\\$&");

	return sanitized;
}

// =============================================================================
// Converter Support
// =============================================================================

/**
 * Build document type list from converters for LLM prompt.
 *
 * Includes displayName and promptHint to help LLM distinguish between similar types.
 */
function buildDocumentTypesFromConverters(
	converters: readonly InboxConverter[],
): string {
	return converters
		.filter((c) => c.enabled)
		.map((c) => {
			const hint = c.extraction?.promptHint
				? `: ${c.extraction.promptHint}`
				: "";
			return `- **${c.id}** (${c.displayName})${hint}`;
		})
		.join("\n");
}

/**
 * Build field extraction guidelines from converter
 */
function buildFieldGuidelinesFromConverter(converter: InboxConverter): string {
	return converter.fields
		.map(
			(f) =>
				`- ${f.name}: ${f.description}${f.requirement === "required" ? " (required)" : ""}`,
		)
		.join("\n");
}

// =============================================================================
// Prompt Building
// =============================================================================

/**
 * Build the LLM prompt for document type detection and field extraction.
 *
 * @param options - Prompt options including content, filename, and vault context
 * @param converters - Optional converters for dynamic document types and fields
 * @returns Formatted prompt string
 */
/**
 * Known type keywords to detect in filenames.
 * When found, we inform the LLM that this is an explicit user signal.
 */
const FILENAME_TYPE_KEYWORDS = [
	"invoice",
	"receipt",
	"statement",
	"booking",
	"reservation",
	"confirmation",
	"bill",
	"quote",
	"estimate",
] as const;

/**
 * Build vault context section for the LLM prompt.
 * Provides available areas and projects so LLM can suggest appropriate values.
 */
function buildVaultContextSection(vaultContext: InboxVaultContext): string {
	const sections: string[] = [];

	if (vaultContext.areas.length > 0) {
		sections.push(`## Available Areas (PARA)
Choose from these existing areas when setting the "area" field:
${vaultContext.areas.map((a) => `- ${a}`).join("\n")}

**IMPORTANT:** Use the EXACT area name from this list. Do not abbreviate or modify.`);
	}

	if (vaultContext.projects.length > 0) {
		sections.push(`## Available Projects
Choose from these existing projects when setting the "project" field:
${vaultContext.projects.map((p) => `- ${p}`).join("\n")}

**IMPORTANT:** Use the EXACT project name from this list. Do not abbreviate or modify.`);
	}

	return sections.length > 0 ? `\n${sections.join("\n\n")}\n` : "";
}

/**
 * Build content preview for LLM prompt.
 * For longer documents, includes both beginning and end to capture
 * appendices, schedules, and summary sections that often contain key data.
 *
 * Sanitizes content to prevent prompt injection.
 *
 * @param content - Full document content
 * @returns Formatted content preview section
 */
function buildContentPreview(content: string): string {
	const START_CHARS = 5000;
	const END_CHARS = 3000;
	const TOTAL_LIMIT = 8000;

	// Short documents: include everything (sanitized)
	if (content.length <= TOTAL_LIMIT) {
		const sanitized = sanitizeForPrompt(content, TOTAL_LIMIT);
		return `- Content (${content.length} chars):

${sanitized}`;
	}

	// Long documents: include start + end (sanitized)
	const startSection = sanitizeForPrompt(
		content.slice(0, START_CHARS),
		START_CHARS,
	);
	const endSection = sanitizeForPrompt(content.slice(-END_CHARS), END_CHARS);

	return `- Content preview (first ${START_CHARS} chars):

${startSection}

[... ${content.length - START_CHARS - END_CHARS} chars omitted ...]

- Content end (last ${END_CHARS} chars - often contains schedules/appendices):

${endSection}`;
}

/**
 * Detect type keywords in a filename and return a hint for the LLM.
 */
function detectFilenameTypeHint(filename: string): string | null {
	const lowerFilename = filename.toLowerCase();
	const foundKeywords = FILENAME_TYPE_KEYWORDS.filter((keyword) =>
		lowerFilename.includes(keyword),
	);

	if (foundKeywords.length === 0) {
		return null;
	}

	// Return the most specific match (invoice > statement, etc.)
	const keyword = foundKeywords[0];
	return `**IMPORTANT: The filename contains "${keyword}" - this is an explicit signal from the user about the document type. Give strong weight to this signal.** If the document content matches a "${keyword}", you should classify it as such unless there is overwhelming evidence otherwise.`;
}

export function buildInboxPrompt(
	options: InboxPromptOptions,
	converters?: readonly InboxConverter[],
): string {
	const { content, filename, vaultContext, userHint } = options;

	// Sanitize user-provided inputs
	const sanitizedFilename = sanitizeForPrompt(filename, MAX_USER_INPUT_LENGTH);
	const sanitizedUserHint = userHint
		? sanitizeForPrompt(userHint, MAX_USER_INPUT_LENGTH)
		: null;

	const userHintSection = sanitizedUserHint
		? `\nUser hint: "${sanitizedUserHint}"`
		: "";

	// Build vault context section for area/project suggestions
	const vaultContextSection = buildVaultContextSection(vaultContext);

	// Detect filename type hint (using sanitized filename)
	const filenameHint = detectFilenameTypeHint(sanitizedFilename);
	const filenameHintSection = filenameHint ? `\n${filenameHint}\n` : "";

	// Use converters if provided, otherwise fall back to DEFAULT_DOCUMENT_TYPES
	const documentTypes = converters
		? buildDocumentTypesFromConverters(converters)
		: DEFAULT_DOCUMENT_TYPES.map((t) => `- ${t}`).join("\n");

	// Build field guidelines from converters if provided
	let fieldGuidelines = `## Field Extraction Guidelines
- For invoices: amount (numeric only, no symbols), currency (code only, e.g., AUD), provider, date, invoiceNumber, abn, gst
- For bookings: date, provider, bookingReference, departure, arrival, passenger
- For receipts: amount (numeric only, no symbols), currency (code only, e.g., AUD), provider, date, category
- For generic: any notable key-value pairs

**CRITICAL for currency fields:**
- amount: Extract ONLY the numeric value (e.g., "220.00" not "$220 AUD")
- currency: Extract ONLY the 3-letter currency code (e.g., "AUD" not "$" or "AUD $")`;

	if (converters) {
		const converterGuidelines = converters
			.filter((c) => c.enabled)
			.map((c) => `- For ${c.id}: ${buildFieldGuidelinesFromConverter(c)}`)
			.join("\n");

		if (converterGuidelines) {
			fieldGuidelines = `## Field Extraction Guidelines\n${converterGuidelines}`;
		}
	}

	// Build content preview - include both start and end for documents with appendices/schedules
	const contentPreview = buildContentPreview(content);

	return `You are analyzing a document from an inbox to determine its type and extract key information.

## Document Information
- Filename: ${sanitizedFilename}
${contentPreview}
${filenameHintSection}
## Available Document Types
${documentTypes}
${vaultContextSection}${userHintSection}

## Task
1. Determine the document type from the available types
2. Estimate your confidence (0.0 to 1.0) in this classification
3. Extract relevant fields based on document type
4. Generate a descriptive filename slug for the attachment (lowercase, hyphen-separated)
   - For invoices: date (YYYY-MM-DD) + "-" + provider slug + "-invoice" (e.g., "2025-09-30-pv-foulkes-invoice")
   - For bookings: date (YYYY-MM-DD) + "-" + provider slug + "-booking" (e.g., "2025-01-15-qantas-booking")
   - For receipts: date (YYYY-MM-DD) + "-" + provider slug + "-receipt" (e.g., "2024-12-01-woolworths-receipt")
   - Keep it concise (max 50 chars), use only a-z, 0-9, and hyphens
   - If you CANNOT extract the date or provider, set suggestedFilenameDescription to null
5. Report any fields you were asked to extract but could not find in extractionWarnings array

**CRITICAL for extractionWarnings:**
- If a required field cannot be extracted, add a clear warning message
- Example warnings: "Could not find invoice date", "Provider name unclear", "Amount not found in document"
- Return an empty array [] if all fields were successfully extracted
- This helps users understand what manual input may be needed

## Response Format
Respond with a JSON object ONLY (no markdown, no explanation outside JSON):

${JSON.stringify(EXAMPLE_RESPONSE, null, 2)}

${fieldGuidelines}

## Confidence Guidelines
- 0.9-1.0: Very clear document type with multiple confirming signals
- 0.7-0.9: Clear document type but some ambiguity
- 0.5-0.7: Probable type but significant uncertainty
- Below 0.5: Use "generic" type

Respond with valid JSON only:`;
}

// =============================================================================
// Response Parsing
// =============================================================================

/**
 * Parse and validate the LLM detection response.
 *
 * @param response - Raw LLM response string
 * @returns Parsed and validated detection result
 * @throws Error if response is invalid JSON or missing required fields
 */
export function parseDetectionResponse(response: string): DocumentTypeResult {
	// Strip markdown code blocks if present
	let jsonStr = response.trim();

	if (jsonStr.startsWith("```json")) {
		jsonStr = jsonStr.slice(7);
	} else if (jsonStr.startsWith("```")) {
		jsonStr = jsonStr.slice(3);
	}

	if (jsonStr.endsWith("```")) {
		jsonStr = jsonStr.slice(0, -3);
	}

	jsonStr = jsonStr.trim();

	// Parse JSON
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonStr);
	} catch {
		throw new Error(
			`Invalid JSON response from LLM: ${response.slice(0, 100)}...`,
		);
	}

	// Validate required fields
	if (typeof parsed !== "object" || parsed === null) {
		throw new Error("LLM response is not an object");
	}

	const obj = parsed as Record<string, unknown>;

	if (typeof obj.documentType !== "string") {
		throw new Error("Missing or invalid documentType in LLM response");
	}

	if (typeof obj.confidence !== "number") {
		throw new Error("Missing or invalid confidence in LLM response");
	}

	// Document type validation is lenient - any string is accepted.
	// The caller should validate against their registered converters.
	// If no match, they can fall back to 'generic'.
	const documentType = String(obj.documentType).toLowerCase();

	// Parse extraction warnings (ensure it's an array of strings)
	let extractionWarnings: readonly string[] | undefined;
	if (Array.isArray(obj.extractionWarnings)) {
		extractionWarnings = obj.extractionWarnings.filter(
			(w): w is string => typeof w === "string",
		);
	}

	return {
		documentType,
		confidence: Math.max(0, Math.min(1, obj.confidence)),
		extractedFields: obj.extractedFields as
			| FieldExtractionResult
			| null
			| undefined,
		suggestedFilenameDescription: obj.suggestedFilenameDescription as
			| string
			| null
			| undefined,
		reasoning: obj.reasoning as string | undefined,
		extractionWarnings,
	};
}

// =============================================================================
// Edit With Prompt Support
// =============================================================================

/**
 * Build a follow-up prompt for editing a suggestion with user input.
 *
 * Sanitizes user input to prevent prompt injection.
 *
 * @param originalContent - Original document content
 * @param previousResult - Previous detection result
 * @param userPrompt - User's editing instructions
 * @returns Follow-up prompt string
 */
export function buildEditPrompt(
	originalContent: string,
	previousResult: DocumentTypeResult,
	userPrompt: string,
): string {
	// Sanitize user inputs
	const sanitizedPrompt = sanitizeForPrompt(userPrompt, MAX_USER_INPUT_LENGTH);
	const sanitizedContent = sanitizeForPrompt(
		originalContent.slice(0, 2000),
		2000,
	);

	return `You previously analyzed this document and classified it as:
- Type: ${previousResult.documentType}
- Confidence: ${previousResult.confidence}

The user has provided additional instructions:
"${sanitizedPrompt}"

## Document Content (first 2000 chars)
${sanitizedContent}

## Task
Re-analyze the document considering the user's instructions.
Provide an updated classification in the same JSON format.

Respond with valid JSON only:`;
}
