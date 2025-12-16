import type { DocumentTypeResult } from "../../../src/inbox/classify/llm-classifier";

/**
 * High-confidence bookmark classification (documentation site)
 *
 * Represents a clear bookmark with all key fields extracted successfully.
 * Typical of documentation pages with structured metadata.
 */
export const BOOKMARK_HIGH_CONFIDENCE: DocumentTypeResult = {
	documentType: "bookmark",
	confidence: 0.92,
	suggestedArea: "Resources",
	suggestedProject: null,
	extractedFields: {
		url: "https://kit.cased.com",
		title: "Kit CLI Documentation",
		category: "Documentation",
		author: "Cased",
	},
	suggestedFilenameDescription: "2024-12-16-kit-cli-documentation",
	reasoning:
		"Document contains URL, title, documentation content markers, and clear web page structure",
	extractionWarnings: [],
};

/**
 * Medium-confidence bookmark (ambiguous content)
 *
 * Represents a bookmark where classification is uncertain - could be an article
 * or reference material. Missing some optional fields like author.
 */
export const BOOKMARK_MEDIUM_CONFIDENCE: DocumentTypeResult = {
	documentType: "bookmark",
	confidence: 0.78,
	suggestedArea: "Resources",
	suggestedProject: null,
	extractedFields: {
		url: "https://example.com/blog/post",
		title: "Interesting Article",
		category: "Blog",
	},
	suggestedFilenameDescription: "2024-12-16-interesting-article",
	reasoning:
		"Document has URL and title but lacks clear indicators of bookmark vs article",
	extractionWarnings: [
		"Missing author field - could not extract from content",
		"Category assigned based on URL pattern rather than explicit metadata",
	],
};

/**
 * Low-confidence bookmark (minimal signals)
 *
 * Represents a bookmark with very limited information extracted.
 * Classification is uncertain and may require manual review.
 */
export const BOOKMARK_LOW_CONFIDENCE: DocumentTypeResult = {
	documentType: "bookmark",
	confidence: 0.65,
	suggestedArea: "Resources",
	suggestedProject: null,
	extractedFields: {
		url: "https://short.link/xyz",
		title: "Untitled",
	},
	suggestedFilenameDescription: "2024-12-16-untitled-bookmark",
	reasoning:
		"Document contains URL but minimal metadata - shortened URL without clear destination",
	extractionWarnings: [
		"Very low information content - classification uncertain",
		"Missing category, author, and descriptive title",
		"Shortened URL detected - actual destination unknown",
	],
};

/**
 * High-confidence invoice classification
 *
 * Represents a well-structured tax invoice with all required Australian fields.
 * Typical of professional invoices from registered businesses.
 */
export const INVOICE_HIGH_CONFIDENCE: DocumentTypeResult = {
	documentType: "invoice",
	confidence: 0.94,
	suggestedArea: "Finance",
	suggestedProject: null,
	extractedFields: {
		amount: "220.00",
		currency: "AUD",
		provider: "Dr Smith Medical Practice",
		invoiceNumber: "INV-4480",
		date: "2024-12-01",
		abn: "12345678901",
		gst: "20.00",
	},
	suggestedFilenameDescription: "2024-12-01-dr-smith-medical-invoice",
	reasoning:
		"Document contains TAX INVOICE header, ABN, amount due, GST breakdown, and provider details - meets all Australian tax invoice requirements",
	extractionWarnings: [],
};

/**
 * Invoice with missing fields (for testing extraction warnings)
 *
 * Represents an invoice where some fields couldn't be extracted.
 * Common scenario with poorly formatted or scanned invoices.
 */
export const INVOICE_MISSING_FIELDS: DocumentTypeResult = {
	documentType: "invoice",
	confidence: 0.82,
	suggestedArea: "Finance",
	suggestedProject: null,
	extractedFields: {
		amount: "150.00",
		currency: "AUD",
		provider: "Local Service Provider",
		date: "2024-11-15",
	},
	suggestedFilenameDescription: "2024-11-15-local-service-provider-invoice",
	reasoning:
		"Document has invoice structure and key amount/provider fields, but missing compliance details",
	extractionWarnings: [
		"Missing invoice number - could not locate in document",
		"Missing ABN - may not be a registered business",
		"Missing GST breakdown - amount may include or exclude GST",
		"Consider manual review to verify tax compliance",
	],
};

/**
 * Generic fallback (when classification fails)
 *
 * Represents a document that couldn't be confidently classified into any
 * specific type. Falls back to generic document handling.
 */
export const GENERIC_FALLBACK: DocumentTypeResult = {
	documentType: "generic",
	confidence: 0.45,
	suggestedArea: "Inbox",
	suggestedProject: null,
	extractedFields: {},
	suggestedFilenameDescription: "2024-12-16-unknown-document",
	reasoning:
		"Document structure unclear - lacks clear indicators of bookmark, invoice, or other known types",
	extractionWarnings: [
		"Low confidence classification - defaulting to generic document type",
		"No structured fields could be reliably extracted",
		"Manual categorization recommended",
	],
};

/**
 * Medium-confidence invoice (partial extraction)
 *
 * Represents an invoice with core fields but missing optional metadata.
 * Sufficient for basic classification but may need enrichment.
 */
export const INVOICE_MEDIUM_CONFIDENCE: DocumentTypeResult = {
	documentType: "invoice",
	confidence: 0.85,
	suggestedArea: "Finance",
	suggestedProject: null,
	extractedFields: {
		amount: "450.00",
		provider: "ABC Consulting",
		invoiceNumber: "2024-123",
		date: "2024-10-20",
	},
	suggestedFilenameDescription: "2024-10-20-abc-consulting-invoice",
	reasoning:
		"Document has clear invoice markers and essential fields, some metadata missing",
	extractionWarnings: [
		"Currency not explicitly stated - assuming AUD from context",
		"GST information not found in document",
	],
};

/**
 * High-confidence bookmark (blog post)
 *
 * Represents a blog post bookmark with rich metadata extraction.
 * Typical of modern blog platforms with structured data.
 */
export const BOOKMARK_BLOG_HIGH_CONFIDENCE: DocumentTypeResult = {
	documentType: "bookmark",
	confidence: 0.91,
	suggestedArea: "Resources",
	suggestedProject: null,
	extractedFields: {
		url: "https://blog.example.com/2024/typescript-best-practices",
		title: "TypeScript Best Practices for 2024",
		category: "Programming",
		author: "Jane Developer",
		tags: "typescript,javascript,best-practices",
		publishDate: "2024-11-01",
	},
	suggestedFilenameDescription: "2024-11-01-typescript-best-practices",
	reasoning:
		"Document has clear blog post structure with author, publish date, tags, and article content",
	extractionWarnings: [],
};

/**
 * High-confidence bookmark (GitHub repository)
 *
 * Represents a GitHub repository bookmark with project metadata.
 * Includes repository-specific fields like stars and language.
 */
export const BOOKMARK_GITHUB_HIGH_CONFIDENCE: DocumentTypeResult = {
	documentType: "bookmark",
	confidence: 0.93,
	suggestedArea: "Resources",
	suggestedProject: "Open Source",
	extractedFields: {
		url: "https://github.com/microsoft/TypeScript",
		title: "microsoft/TypeScript",
		category: "Repository",
		author: "Microsoft",
		description:
			"TypeScript is a superset of JavaScript that compiles to clean JavaScript output",
		language: "TypeScript",
		stars: "98500",
	},
	suggestedFilenameDescription: "github-microsoft-typescript",
	reasoning:
		"Document is GitHub repository page with clear project metadata, star count, and description",
	extractionWarnings: [],
};
