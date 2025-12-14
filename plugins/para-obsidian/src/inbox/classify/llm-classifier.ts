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

import { llmLogger } from "../../shared/logger";
import type { InboxConverter } from "./converters";

// Non-null assertion for logger
const log = llmLogger as NonNullable<typeof llmLogger>;

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
	/** Detected document type */
	readonly documentType:
		| "invoice"
		| "booking"
		| "receipt"
		| "session"
		| "generic";

	/** Confidence in the detection (0-1) */
	readonly confidence: number;

	/** Suggested area wikilink (e.g., "Health", "Travel") */
	readonly suggestedArea?: string | null;

	/** Suggested project wikilink (e.g., "2024 Tax Return") */
	readonly suggestedProject?: string | null;

	/** Extracted fields from the document */
	readonly extractedFields?: FieldExtractionResult | null;

	/** Suggested attachment filename description (e.g., "pv-foulkes-invoice-0004447") */
	readonly suggestedFilenameDescription?: string | null;

	/** LLM's reasoning for the classification */
	readonly reasoning?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Available document types for classification.
 */
const DOCUMENT_TYPES = [
	"invoice",
	"booking",
	"receipt",
	"session",
	"generic",
] as const;

/**
 * Example JSON response format for the prompt.
 */
const EXAMPLE_RESPONSE = {
	documentType: "invoice",
	confidence: 0.92,
	suggestedArea: "Health",
	suggestedProject: "Medical Expenses 2024",
	suggestedFilenameDescription: "invoice-20241201-dr-smith-medical-practice",
	extractedFields: {
		amount: "220.00",
		currency: "AUD",
		provider: "Dr Smith Medical Practice",
		date: "2024-12-01",
		invoiceNumber: "INV-4480",
	},
	reasoning:
		"Document contains TAX INVOICE header, ABN, amount due, and medical provider details",
};

// =============================================================================
// Converter Support
// =============================================================================

/**
 * Build document type list from converters for LLM prompt
 */
function buildDocumentTypesFromConverters(
	converters: readonly InboxConverter[],
): string {
	return converters
		.filter((c) => c.enabled)
		.map((c) => c.id)
		.join(", ");
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
export function buildInboxPrompt(
	options: InboxPromptOptions,
	converters?: readonly InboxConverter[],
): string {
	const { content, filename, vaultContext, userHint } = options;

	const areasSection =
		vaultContext.areas.length > 0
			? `Available areas in vault: ${vaultContext.areas.join(", ")}`
			: "No areas defined in vault";

	const projectsSection =
		vaultContext.projects.length > 0
			? `Available projects in vault: ${vaultContext.projects.join(", ")}`
			: "No projects defined in vault";

	const userHintSection = userHint ? `\nUser hint: "${userHint}"` : "";

	// Use converters if provided, otherwise fall back to DOCUMENT_TYPES
	const documentTypes = converters
		? buildDocumentTypesFromConverters(converters)
		: DOCUMENT_TYPES.map((t) => `- ${t}`).join("\n");

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

	return `You are analyzing a document from an inbox to determine its type and extract key information.

## Document Information
- Filename: ${filename}
- Content preview (first 3000 chars):

${content.slice(0, 3000)}

## Available Document Types
${documentTypes}

## Vault Context
${areasSection}
${projectsSection}
${userHintSection}

## Task
1. Determine the document type from the available types
2. Estimate your confidence (0.0 to 1.0) in this classification
3. Suggest an appropriate area from the vault (if any matches) - return JUST the name without brackets
4. Suggest an appropriate project from the vault (if any matches) - return JUST the name without brackets
5. Extract relevant fields based on document type
6. Generate a descriptive filename slug for the attachment (lowercase, hyphen-separated)
   - For invoices: "invoice-" + date (YYYYMMDD) + "-" + provider name (e.g., "invoice-20250930-pv-foulkes")
   - For bookings: Use provider + booking type + reference (e.g., "qantas-flight-qf123")
   - For receipts: Use provider + "receipt" + date (e.g., "woolworths-receipt-20241201")
   - Keep it concise (max 50 chars), use only a-z, 0-9, and hyphens

**CRITICAL for area/project fields:**
- suggestedArea: Return ONLY the area name (e.g., "Health" not "[[Health]]")
- suggestedProject: Return ONLY the project name (e.g., "2025 Tassie Holiday" not "[[2025 Tassie Holiday]]")
- Wikilink brackets will be added automatically - do NOT include them

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

	// Validate document type
	const validTypes = new Set(DOCUMENT_TYPES);
	if (!validTypes.has(obj.documentType as (typeof DOCUMENT_TYPES)[number])) {
		log.warn`Unknown document type from LLM: ${obj.documentType}, defaulting to generic`;
		obj.documentType = "generic";
	}

	return {
		documentType: obj.documentType as DocumentTypeResult["documentType"],
		confidence: Math.max(0, Math.min(1, obj.confidence)),
		suggestedArea: obj.suggestedArea as string | null | undefined,
		suggestedProject: obj.suggestedProject as string | null | undefined,
		extractedFields: obj.extractedFields as
			| FieldExtractionResult
			| null
			| undefined,
		suggestedFilenameDescription: obj.suggestedFilenameDescription as
			| string
			| null
			| undefined,
		reasoning: obj.reasoning as string | undefined,
	};
}

// =============================================================================
// Edit With Prompt Support
// =============================================================================

/**
 * Build a follow-up prompt for editing a suggestion with user input.
 *
 * @param originalContent - Original document content
 * @param previousResult - Previous detection result
 * @param userPrompt - User's editing instructions
 * @param vaultContext - Vault context
 * @returns Follow-up prompt string
 */
export function buildEditPrompt(
	originalContent: string,
	previousResult: DocumentTypeResult,
	userPrompt: string,
	vaultContext: InboxVaultContext,
): string {
	const areasSection =
		vaultContext.areas.length > 0
			? `Available areas: ${vaultContext.areas.join(", ")}`
			: "No areas defined";

	const projectsSection =
		vaultContext.projects.length > 0
			? `Available projects: ${vaultContext.projects.join(", ")}`
			: "No projects defined";

	return `You previously analyzed this document and classified it as:
- Type: ${previousResult.documentType}
- Area: ${previousResult.suggestedArea ?? "none"}
- Project: ${previousResult.suggestedProject ?? "none"}
- Confidence: ${previousResult.confidence}

The user has provided additional instructions:
"${userPrompt}"

## Vault Context
${areasSection}
${projectsSection}

## Document Content (first 2000 chars)
${originalContent.slice(0, 2000)}

## Task
Re-analyze the document considering the user's instructions.
Provide an updated classification in the same JSON format.

Respond with valid JSON only:`;
}
