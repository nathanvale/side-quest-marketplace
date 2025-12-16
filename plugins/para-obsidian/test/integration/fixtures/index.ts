import type { DocumentTypeResult } from "../../../src/inbox/classify/llm-classifier";

/**
 * Type-safe extracted fields for bookmark classifier.
 * Represents data extracted from web content or bookmark metadata.
 */
export interface BookmarkFields {
	url: string;
	title: string;
	category?: string;
	author?: string;
	published?: string;
}

/**
 * Type-safe extracted fields for invoice classifier.
 * Represents financial data extracted from invoice documents.
 */
export interface InvoiceFields {
	amount: number;
	provider: string;
	invoiceNumber?: string;
	dueDate?: string;
	currency?: string;
	abn?: string;
	gst?: string;
}

/**
 * Map classifier types to their extracted field types.
 * Enables type-safe fixture creation per classifier.
 */
export type ExtractedFieldsByType = {
	bookmark: BookmarkFields;
	invoice: InvoiceFields;
};

/**
 * Integration test fixture focused on BEHAVIOR not internal state.
 * Tests what the USER experiences (filesystem outcomes, not mocks).
 *
 * Philosophy:
 * - _mockLLMResponse is INTERNAL (simulates API, not tested)
 * - expectedOutcome is BEHAVIOR (what we actually assert)
 * - Fixtures document the contract between classifier and file system
 *
 * @example
 * ```typescript
 * const fixture: DocumentFixture<"bookmark"> = {
 *   description: "Complete bookmark with all fields",
 *   classifier: "bookmark",
 *   input: {
 *     filename: "article.md",
 *     content: "[Article](https://example.com)"
 *   },
 *   _mockLLMResponse: createDocumentTypeFixture({
 *     documentType: "bookmark",
 *     confidence: 0.9
 *   }),
 *   expectedOutcome: {
 *     noteCreated: "Resources/bookmarks/article.md",
 *     noteLocation: "Resources",
 *     frontmatter: { type: "bookmark", url: "https://example.com" },
 *     shouldAutoClassify: true
 *   },
 *   expectedFields: {
 *     url: "https://example.com",
 *     title: "Article"
 *   }
 * }
 * ```
 */
export interface DocumentFixture<
	T extends keyof ExtractedFieldsByType = "bookmark" | "invoice",
> {
	/** Human-readable test scenario description */
	description: string;

	/** Classifier type being tested */
	classifier: T;

	/** Input data fed to the classification engine */
	input: {
		/** Filename in inbox (e.g., "article.md") */
		filename: string;
		/** Raw markdown content */
		content: string;
	};

	/**
	 * Mock LLM response (INTERNAL - not asserted in tests).
	 * Simulates what Ollama would return. Tests should NOT
	 * assert against this, only use it to stub the API.
	 */
	_mockLLMResponse: DocumentTypeResult;

	/**
	 * Expected BEHAVIOR (what we actually test).
	 * Describes the user-visible filesystem outcome.
	 */
	expectedOutcome: {
		/** Relative path where note should be created (null if skip) */
		noteCreated: string | null;
		/** PARA location where note should land (including Inbox for unrouted items) */
		noteLocation:
			| "Projects"
			| "Areas"
			| "Resources"
			| "Archives"
			| "00 Inbox"
			| null;
		/** Frontmatter that should be written (null if none) */
		frontmatter: Record<string, unknown> | null;
		/** Content fragments that should appear in body */
		bodyContains?: string[];
		/** Should classifier auto-classify without prompt? */
		shouldAutoClassify?: boolean;
		/** Should classifier prompt user for confirmation? */
		shouldPromptUser?: boolean;
		/** Warning message that should be shown */
		warningMessage?: string;
	};

	/**
	 * Extracted fields (for frontmatter validation).
	 * Type-safe per classifier via ExtractedFieldsByType.
	 */
	expectedFields: ExtractedFieldsByType[T];
}

/**
 * Fixture categories for a single classifier.
 * Organizes fixtures by completeness and edge cases.
 */
export interface FixtureSet<T extends keyof ExtractedFieldsByType> {
	/** Fixture with all fields populated */
	complete: DocumentFixture<T>;
	/** Fixture with only required fields */
	minimal: DocumentFixture<T>;
	/** Array of edge case fixtures (partial data, errors, etc) */
	edgeCases: DocumentFixture<T>[];
}

/**
 * Complete fixture registry for all classifiers.
 * Populated by individual fixture files (bookmark.ts, invoice.ts).
 */
export interface FixtureRegistry {
	bookmark: FixtureSet<"bookmark">;
	invoice: FixtureSet<"invoice">;
}

/**
 * Helper to create DocumentTypeResult with sensible defaults.
 * Ensures fixtures match real Ollama API structure without verbose repetition.
 *
 * @param overrides - Partial result to override defaults
 * @returns Complete DocumentTypeResult for mocking
 *
 * @example
 * ```typescript
 * const mockResponse = createDocumentTypeFixture({
 *   documentType: "bookmark",
 *   confidence: 0.9,
 *   extractedFields: { url: "https://example.com" }
 * });
 * ```
 */
export function createDocumentTypeFixture(
	overrides?: Partial<DocumentTypeResult>,
): DocumentTypeResult {
	return {
		documentType: "bookmark",
		confidence: 0.75,
		reasoning: "Content matches classifier patterns",
		suggestedArea: null,
		suggestedProject: null,
		extractedFields: {},
		suggestedFilenameDescription: null,
		extractionWarnings: [],
		...overrides,
	};
}

/**
 * Fixture registry populated by individual classifier fixture files.
 * Import fixtures from bookmark.ts, invoice.ts, etc. to populate.
 *
 * @example
 * ```typescript
 * import { BOOKMARK_FIXTURES } from "./bookmark"
 * import { INVOICE_FIXTURES } from "./invoice"
 *
 * export const FIXTURE_REGISTRY: FixtureRegistry = {
 *   bookmark: BOOKMARK_FIXTURES,
 *   invoice: INVOICE_FIXTURES
 * }
 * ```
 */
export const FIXTURE_REGISTRY: Partial<FixtureRegistry> = {
	// Populated by fixture imports
};
