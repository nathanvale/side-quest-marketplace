/**
 * Edge case fixtures for cross-cutting scenarios
 *
 * Tests error handling, duplicate management, Unicode handling,
 * and malformed content across all document types.
 */

import type { DocumentFixture } from "./index";
import { createDocumentTypeFixture } from "./index";

// ============================================================================
// Duplicate Handling Fixtures
// ============================================================================

/**
 * First bookmark with specific title - used to test collision handling
 */
export const DUPLICATE_FIRST: DocumentFixture<"bookmark"> = {
	description: "first bookmark - establishes baseline for collision tests",
	classifier: "bookmark",
	input: {
		filename: "🔖 Kit Documentation.md",
		content: `---
type: bookmark
url: https://kit.cased.com/docs
title: Kit Documentation
clipped: 2024-12-16
---

# Kit Documentation

Official documentation for Kit CLI.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.92,
		extractedFields: {
			url: "https://kit.cased.com/docs",
			title: "Kit Documentation",
		},
	}),
	expectedOutcome: {
		noteCreated: "Resources/Bookmarks/🔖 Kit Documentation.md",
		noteLocation: "Resources",
		frontmatter: {
			type: "bookmark",
			url: "https://kit.cased.com/docs",
			title: "Kit Documentation",
			clipped: "2024-12-16",
		},
	},
	expectedFields: {
		url: "https://kit.cased.com/docs",
		title: "Kit Documentation",
	},
};

/**
 * Second bookmark with same title, different URL - should get counter suffix
 */
export const DUPLICATE_SECOND_DIFFERENT_URL: DocumentFixture<"bookmark"> = {
	description:
		"second bookmark with same title but different URL - should append counter",
	classifier: "bookmark",
	input: {
		filename: "🔖 Kit Documentation.md",
		content: `---
type: bookmark
url: https://kit.cased.com/guide
title: Kit Documentation
clipped: 2024-12-16
---

# Kit Documentation

Getting started guide.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.91,
		extractedFields: {
			url: "https://kit.cased.com/guide",
			title: "Kit Documentation",
		},
	}),
	expectedOutcome: {
		noteCreated: "Resources/Bookmarks/🔖 Kit Documentation 2.md",
		noteLocation: "Resources",
		frontmatter: {
			type: "bookmark",
			url: "https://kit.cased.com/guide",
			title: "Kit Documentation",
			clipped: "2024-12-16",
		},
	},
	expectedFields: {
		url: "https://kit.cased.com/guide",
		title: "Kit Documentation",
	},
};

/**
 * Exact duplicate (same title + URL) - should be skipped with warning
 */
export const EXACT_DUPLICATE: DocumentFixture<"bookmark"> = {
	description: "exact duplicate content - should be skipped with warning",
	classifier: "bookmark",
	input: {
		filename: "🔖 Kit Documentation.md",
		content: `---
type: bookmark
url: https://kit.cased.com/docs
title: Kit Documentation
clipped: 2024-12-16
---

# Kit Documentation

Official documentation for Kit CLI.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.92,
		extractedFields: {
			url: "https://kit.cased.com/docs",
			title: "Kit Documentation",
		},
	}),
	expectedOutcome: {
		noteCreated: null, // Should be skipped
		noteLocation: null,
		frontmatter: null,
		warningMessage: "Duplicate content detected - skipping",
	},
	expectedFields: {
		url: "https://kit.cased.com/docs",
		title: "Kit Documentation",
	},
};

// ============================================================================
// Unicode/Encoding Edge Cases
// ============================================================================

/**
 * Unicode title with CJK characters and emoji
 */
export const UNICODE_CJK_EMOJI: DocumentFixture<"bookmark"> = {
	description: "handles Unicode CJK characters and emoji in title",
	classifier: "bookmark",
	input: {
		filename: "🔖 TypeScript 學習指南 🚀.md",
		content: `---
type: bookmark
url: https://example.com/typescript-guide
title: "TypeScript 學習指南 🚀"
clipped: 2024-12-16
tags: [日本語, español, emoji-✨]
---

# TypeScript 學習指南 🚀

包含中文、日本語、한국어 content.

## 学習内容

- 基本語法 (Basic Syntax)
- 型システム (Type System)
- 実践例 (Examples)
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.88,
		extractedFields: {
			url: "https://example.com/typescript-guide",
			title: "TypeScript 學習指南 🚀",
		},
	}),
	expectedOutcome: {
		noteCreated: "Resources/Bookmarks/🔖 TypeScript 學習指南 🚀.md",
		noteLocation: "Resources",
		frontmatter: {
			type: "bookmark",
			url: "https://example.com/typescript-guide",
			title: "TypeScript 學習指南 🚀",
			clipped: "2024-12-16",
			tags: ["日本語", "español", "emoji-✨"],
		},
	},
	expectedFields: {
		url: "https://example.com/typescript-guide",
		title: "TypeScript 學習指南 🚀",
	},
};

/**
 * RTL text (Hebrew/Arabic)
 */
export const UNICODE_RTL: DocumentFixture<"bookmark"> = {
	description: "handles RTL (Right-to-Left) text in Hebrew and Arabic",
	classifier: "bookmark",
	input: {
		filename: "🔖 מדריך TypeScript.md",
		content: `---
type: bookmark
url: https://example.com/typescript-hebrew
title: "מדריך TypeScript בעברית"
clipped: 2024-12-16
tags: [עברית, arabic-العربية]
---

# מדריך TypeScript בעברית

מדריך מקיף ללימוד TypeScript.

## محتوى عربي

دليل شامل لتعلم TypeScript.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.87,
		extractedFields: {
			url: "https://example.com/typescript-hebrew",
			title: "מדריך TypeScript בעברית",
		},
	}),
	expectedOutcome: {
		noteCreated: "Resources/Bookmarks/🔖 מדריך TypeScript.md",
		noteLocation: "Resources",
		frontmatter: {
			type: "bookmark",
			url: "https://example.com/typescript-hebrew",
			title: "מדריך TypeScript בעברית",
			clipped: "2024-12-16",
			tags: ["עברית", "arabic-العربية"],
		},
	},
	expectedFields: {
		url: "https://example.com/typescript-hebrew",
		title: "מדריך TypeScript בעברית",
	},
};

// ============================================================================
// Long Value Edge Cases
// ============================================================================

/**
 * Very long title (>100 chars) - should be truncated in filename
 */
export const LONG_TITLE: DocumentFixture<"bookmark"> = {
	description:
		"very long title exceeding typical filename limits - should truncate gracefully",
	classifier: "bookmark",
	input: {
		filename:
			"🔖 A Comprehensive and Extraordinarily Detailed Guide to Understanding the Complete TypeScript Type System Including Advanced Generics Conditional Types and Template Literal Types.md",
		content: `---
type: bookmark
url: https://example.com/typescript-long-guide
title: "A Comprehensive and Extraordinarily Detailed Guide to Understanding the Complete TypeScript Type System Including Advanced Generics Conditional Types and Template Literal Types"
clipped: 2024-12-16
---

# A Comprehensive and Extraordinarily Detailed Guide

Very detailed content here.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.89,
		extractedFields: {
			url: "https://example.com/typescript-long-guide",
			title:
				"A Comprehensive and Extraordinarily Detailed Guide to Understanding the Complete TypeScript Type System Including Advanced Generics Conditional Types and Template Literal Types",
		},
	}),
	expectedOutcome: {
		noteCreated:
			"Resources/Bookmarks/🔖 A Comprehensive and Extraordinarily Detailed Guide to Understanding the Complete TypeScript Type System.md",
		noteLocation: "Resources",
		frontmatter: {
			type: "bookmark",
			url: "https://example.com/typescript-long-guide",
			title:
				"A Comprehensive and Extraordinarily Detailed Guide to Understanding the Complete TypeScript Type System Including Advanced Generics Conditional Types and Template Literal Types",
			clipped: "2024-12-16",
		},
	},
	expectedFields: {
		url: "https://example.com/typescript-long-guide",
		title:
			"A Comprehensive and Extraordinarily Detailed Guide to Understanding the Complete TypeScript Type System Including Advanced Generics Conditional Types and Template Literal Types",
	},
};

/**
 * Very long URL (>500 chars with query params)
 */
export const LONG_URL: DocumentFixture<"bookmark"> = {
	description:
		"very long URL with extensive query parameters - should be stored fully",
	classifier: "bookmark",
	input: {
		filename: "🔖 Analytics Dashboard.md",
		content: `---
type: bookmark
url: https://analytics.example.com/dashboard?utm_source=email&utm_medium=newsletter&utm_campaign=2024_q4_typescript_guide&user_id=12345&session_token=abcdef123456789&filters=category:typescript,level:advanced,year:2024&sort=relevance&page=1&limit=50&include_archived=true&export_format=csv&columns=title,author,date,views,engagement&date_range=2024-01-01:2024-12-31&timezone=UTC&language=en&theme=dark&display_mode=grid&auto_refresh=true&refresh_interval=60&cache_bust=1234567890
title: Analytics Dashboard
clipped: 2024-12-16
---

# Analytics Dashboard

Dashboard with complex URL parameters.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.9,
		extractedFields: {
			url: "https://analytics.example.com/dashboard?utm_source=email&utm_medium=newsletter&utm_campaign=2024_q4_typescript_guide&user_id=12345&session_token=abcdef123456789&filters=category:typescript,level:advanced,year:2024&sort=relevance&page=1&limit=50&include_archived=true&export_format=csv&columns=title,author,date,views,engagement&date_range=2024-01-01:2024-12-31&timezone=UTC&language=en&theme=dark&display_mode=grid&auto_refresh=true&refresh_interval=60&cache_bust=1234567890",
			title: "Analytics Dashboard",
		},
	}),
	expectedOutcome: {
		noteCreated: "Resources/Bookmarks/🔖 Analytics Dashboard.md",
		noteLocation: "Resources",
		frontmatter: {
			type: "bookmark",
			url: "https://analytics.example.com/dashboard?utm_source=email&utm_medium=newsletter&utm_campaign=2024_q4_typescript_guide&user_id=12345&session_token=abcdef123456789&filters=category:typescript,level:advanced,year:2024&sort=relevance&page=1&limit=50&include_archived=true&export_format=csv&columns=title,author,date,views,engagement&date_range=2024-01-01:2024-12-31&timezone=UTC&language=en&theme=dark&display_mode=grid&auto_refresh=true&refresh_interval=60&cache_bust=1234567890",
			title: "Analytics Dashboard",
			clipped: "2024-12-16",
		},
	},
	expectedFields: {
		url: "https://analytics.example.com/dashboard?utm_source=email&utm_medium=newsletter&utm_campaign=2024_q4_typescript_guide&user_id=12345&session_token=abcdef123456789&filters=category:typescript,level:advanced,year:2024&sort=relevance&page=1&limit=50&include_archived=true&export_format=csv&columns=title,author,date,views,engagement&date_range=2024-01-01:2024-12-31&timezone=UTC&language=en&theme=dark&display_mode=grid&auto_refresh=true&refresh_interval=60&cache_bust=1234567890",
		title: "Analytics Dashboard",
	},
};

// ============================================================================
// Malformed Content
// ============================================================================

/**
 * Missing required URL field - should fail validation
 */
export const MISSING_URL: DocumentFixture<"bookmark"> = {
	description: "missing required URL field - should fail validation",
	classifier: "bookmark",
	input: {
		filename: "🔖 Invalid Bookmark.md",
		content: `---
type: bookmark
title: Invalid Bookmark
clipped: 2024-12-16
---

# Invalid Bookmark

This bookmark is missing the required URL field.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.85,
		extractedFields: {
			title: "Invalid Bookmark",
		},
	}),
	expectedOutcome: {
		noteCreated: null,
		noteLocation: null,
		frontmatter: null,
		warningMessage: "Missing required field: url",
	},
	expectedFields: {
		url: "", // Empty since URL is missing - this tests validation failure
		title: "Invalid Bookmark",
	},
};

/**
 * Invalid date format
 */
export const INVALID_DATE: DocumentFixture<"bookmark"> = {
	description: "invalid date format - should fail validation or normalize",
	classifier: "bookmark",
	input: {
		filename: "🔖 Bad Date Bookmark.md",
		content: `---
type: bookmark
url: https://example.com/bad-date
title: Bad Date Bookmark
clipped: "not a date"
---

# Bad Date Bookmark

This has an invalid date format.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.86,
		extractedFields: {
			url: "https://example.com/bad-date",
			title: "Bad Date Bookmark",
		},
	}),
	expectedOutcome: {
		noteCreated: null,
		noteLocation: null,
		frontmatter: null,
		warningMessage: "Invalid date format: clipped",
	},
	expectedFields: {
		url: "https://example.com/bad-date",
		title: "Bad Date Bookmark",
	},
};

/**
 * Corrupted YAML frontmatter
 */
export const CORRUPTED_FRONTMATTER: DocumentFixture<"bookmark"> = {
	description: "corrupted YAML frontmatter - should fail to parse",
	classifier: "bookmark",
	input: {
		filename: "🔖 Corrupted Bookmark.md",
		content: `---
type: bookmark
url: https://example.com/corrupted
title: "Corrupted Bookmark
clipped: 2024-12-16
tags: [unclosed, array
---

# Corrupted Bookmark

This has invalid YAML syntax.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.84,
		extractedFields: {
			url: "https://example.com/corrupted",
			title: "Corrupted Bookmark",
		},
	}),
	expectedOutcome: {
		noteCreated: null,
		noteLocation: null,
		frontmatter: null,
		warningMessage: "Failed to parse YAML frontmatter",
	},
	expectedFields: {
		url: "https://example.com/corrupted",
		title: "Corrupted Bookmark",
	},
};

// ============================================================================
// Exports
// ============================================================================

/**
 * Organized collection of edge case fixtures
 */
export const EDGE_CASE_FIXTURES = {
	duplicates: {
		first: DUPLICATE_FIRST,
		secondDifferentUrl: DUPLICATE_SECOND_DIFFERENT_URL,
		exactDuplicate: EXACT_DUPLICATE,
	},
	unicode: {
		cjkEmoji: UNICODE_CJK_EMOJI,
		rtl: UNICODE_RTL,
	},
	longValues: {
		longTitle: LONG_TITLE,
		longUrl: LONG_URL,
	},
	malformed: {
		missingUrl: MISSING_URL,
		invalidDate: INVALID_DATE,
		corruptedFrontmatter: CORRUPTED_FRONTMATTER,
	},
} as const;

/**
 * Flat array of all edge case fixtures for iteration
 */
export const ALL_EDGE_CASE_FIXTURES = [
	DUPLICATE_FIRST,
	DUPLICATE_SECOND_DIFFERENT_URL,
	EXACT_DUPLICATE,
	UNICODE_CJK_EMOJI,
	UNICODE_RTL,
	LONG_TITLE,
	LONG_URL,
	MISSING_URL,
	INVALID_DATE,
	CORRUPTED_FRONTMATTER,
] as const;
