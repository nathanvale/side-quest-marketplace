import type { DocumentFixture, FixtureSet } from "./index";
import { createDocumentTypeFixture } from "./index";

/**
 * Complete Web Clipper bookmark with all optional fields populated.
 * Tests full feature set including category, author, tags, and highlights.
 */
export const BOOKMARK_COMPLETE: DocumentFixture<"bookmark"> = {
	description: "complete Web Clipper bookmark with all fields",
	classifier: "bookmark",
	input: {
		filename: "🔖 Kit CLI Documentation.md",
		content: `---
type: bookmark
url: https://kit.cased.com
title: Kit CLI Documentation
clipped: 2024-12-16
category: "[[Documentation]]"
author: "[[Cased]]"
tags: [cli, code-search]
---

# Kit CLI Documentation

## Notes

Fast semantic search for codebases using ML embeddings.

## Highlights

- "30-50x faster than grep for symbol lookup"
- "Automatic semantic index with fallback to text search"
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.92,
		reasoning:
			"URL, title, and clipped date present. Contains structured notes and highlights typical of web clipper bookmarks.",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://kit.cased.com",
			title: "Kit CLI Documentation",
			category: "Documentation",
			author: "Cased",
		},
	}),
	expectedOutcome: {
		// LLM path: notes go to inbox until user sets destination
		noteCreated: "00 Inbox/Bookmarks/🔖 Kit CLI Documentation.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://kit.cased.com",
			title: "Kit CLI Documentation",
			category: "Documentation",
			author: "Cased",
		},
		bodyContains: [
			"Kit CLI Documentation",
			"semantic search",
			"30-50x faster than grep",
		],
		shouldAutoClassify: false, // Needs user to accept destination
		shouldPromptUser: true,
	},
	expectedFields: {
		url: "https://kit.cased.com",
		title: "Kit CLI Documentation",
		category: "Documentation",
		author: "Cased",
	},
};

/**
 * Minimal bookmark with only required fields (url, title, clipped).
 * Tests graceful handling of sparse data without optional fields.
 */
export const BOOKMARK_MINIMAL: DocumentFixture<"bookmark"> = {
	description: "minimal bookmark with only required fields",
	classifier: "bookmark",
	input: {
		filename: "🔖 TypeScript Handbook.md",
		content: `---
type: bookmark
url: https://www.typescriptlang.org/docs/handbook/
title: TypeScript Handbook
clipped: 2024-12-16
---

# TypeScript Handbook

Official TypeScript documentation and language reference.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.91,
		reasoning:
			"Basic bookmark structure with required fields. No category or author metadata.",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://www.typescriptlang.org/docs/handbook/",
			title: "TypeScript Handbook",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Bookmarks/🔖 TypeScript Handbook.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://www.typescriptlang.org/docs/handbook/",
			title: "TypeScript Handbook",
		},
		bodyContains: ["TypeScript Handbook", "Official TypeScript documentation"],
		shouldAutoClassify: false,
		shouldPromptUser: true,
	},
	expectedFields: {
		url: "https://www.typescriptlang.org/docs/handbook/",
		title: "TypeScript Handbook",
	},
};

/**
 * GitHub PR bookmark - should classify to Projects.
 * Tests domain-specific routing for development resources.
 */
export const BOOKMARK_GITHUB_PR: DocumentFixture<"bookmark"> = {
	description: "GitHub PR bookmark classified to Projects",
	classifier: "bookmark",
	input: {
		filename: "🔖 PR Add bookmark classifier.md",
		content: `---
type: bookmark
url: https://github.com/nathanvale/side-quest-marketplace/pull/1234
title: "PR: Add bookmark classifier"
clipped: 2024-12-16
category: "[[Pull Requests]]"
tags: [github, development]
---

# PR: Add bookmark classifier

## Summary

Adds LLM-based bookmark classifier for Web Clipper integration.

## Changes

- New BookmarkClassifier with URL/title extraction
- Integration tests for bookmark fixtures
- Documentation updates
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.93,
		reasoning:
			"GitHub PR URL indicates active development work. Should route to Projects for ongoing work tracking.",
		suggestedArea: "Projects",
		extractedFields: {
			url: "https://github.com/nathanvale/side-quest-marketplace/pull/1234",
			title: "PR: Add bookmark classifier",
			category: "Pull Requests",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Bookmarks/🔖 PR Add bookmark classifier.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://github.com/nathanvale/side-quest-marketplace/pull/1234",
			title: "PR: Add bookmark classifier",
			category: "Pull Requests",
		},
		bodyContains: ["Add bookmark classifier", "LLM-based bookmark classifier"],
		shouldAutoClassify: false,
		shouldPromptUser: true,
	},
	expectedFields: {
		url: "https://github.com/nathanvale/side-quest-marketplace/pull/1234",
		title: "PR: Add bookmark classifier",
		category: "Pull Requests",
	},
};

/**
 * Banking portal bookmark - should classify to Areas (Finance).
 * Tests domain-specific routing for personal/business areas.
 */
export const BOOKMARK_BANKING: DocumentFixture<"bookmark"> = {
	description: "banking portal bookmark classified to Areas/Finance",
	classifier: "bookmark",
	input: {
		filename: "🔖 NAB NetBank.md",
		content: `---
type: bookmark
url: https://www.nab.com.au/netbank/login
title: NAB NetBank
clipped: 2024-12-16
category: "[[Banking]]"
tags: [finance, banking]
---

# NAB NetBank

Personal banking login portal.

## Quick Links

- Account overview
- Transfer funds
- Pay bills
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.94,
		reasoning:
			"Banking URL indicates financial area of responsibility. Should route to Areas for ongoing account management.",
		suggestedArea: "Areas",
		extractedFields: {
			url: "https://www.nab.com.au/netbank/login",
			title: "NAB NetBank",
			category: "Banking",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Bookmarks/🔖 NAB NetBank.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://www.nab.com.au/netbank/login",
			title: "NAB NetBank",
			category: "Banking",
		},
		bodyContains: ["NAB NetBank", "Personal banking login portal"],
		shouldAutoClassify: false,
		shouldPromptUser: true,
	},
	expectedFields: {
		url: "https://www.nab.com.au/netbank/login",
		title: "NAB NetBank",
		category: "Banking",
	},
};

/**
 * Bookmark with special characters in title.
 * Tests proper escaping and encoding.
 */
export const BOOKMARK_SPECIAL_CHARS: DocumentFixture<"bookmark"> = {
	description: "bookmark with special characters in title",
	classifier: "bookmark",
	input: {
		filename: "🔖 TypeScript The Guide & More.md",
		content: `---
type: bookmark
url: https://example.com/ts-guide
title: "TypeScript: The Guide & More"
clipped: 2024-12-16
---

# TypeScript: The Guide & More

Complete guide to TypeScript's features & best practices.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.9,
		reasoning: "Standard bookmark with special characters in title.",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://example.com/ts-guide",
			title: "TypeScript: The Guide & More",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Bookmarks/🔖 TypeScript The Guide & More.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://example.com/ts-guide",
			title: "TypeScript: The Guide & More",
		},
		bodyContains: ["TypeScript: The Guide & More", "best practices"],
		shouldAutoClassify: false,
		shouldPromptUser: true,
	},
	expectedFields: {
		url: "https://example.com/ts-guide",
		title: "TypeScript: The Guide & More",
	},
};

/**
 * Bookmark with Unicode characters in title and content.
 * Tests proper UTF-8 handling.
 */
export const BOOKMARK_UNICODE: DocumentFixture<"bookmark"> = {
	description: "bookmark with Unicode content",
	classifier: "bookmark",
	input: {
		filename: "🔖 TypeScript 學習指南.md",
		content: `---
type: bookmark
url: https://example.com/ts-zh
title: 🚀 TypeScript 學習指南
clipped: 2024-12-16
category: "[[教學文件]]"
tags: [typescript, 中文]
---

# 🚀 TypeScript 學習指南

完整的 TypeScript 教學資源，包含範例程式碼。

## 重點內容

- 類型系統基礎
- 進階類型操作
- 實戰應用案例
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.89,
		reasoning:
			"Bookmark with Chinese characters, proper UTF-8 encoding detected.",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://example.com/ts-zh",
			title: "🚀 TypeScript 學習指南",
			category: "教學文件",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Bookmarks/🔖 TypeScript 學習指南.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://example.com/ts-zh",
			title: "🚀 TypeScript 學習指南",
			category: "教學文件",
		},
		bodyContains: ["TypeScript 學習指南", "類型系統基礎"],
		shouldAutoClassify: false,
		shouldPromptUser: true,
	},
	expectedFields: {
		url: "https://example.com/ts-zh",
		title: "🚀 TypeScript 學習指南",
		category: "教學文件",
	},
};

/**
 * Bookmark with very long URL including query parameters and fragment.
 * Tests proper URL handling and truncation.
 */
export const BOOKMARK_LONG_URL: DocumentFixture<"bookmark"> = {
	description: "bookmark with very long URL with query params and fragment",
	classifier: "bookmark",
	input: {
		filename: "🔖 Complex Search Results.md",
		content: `---
type: bookmark
url: https://www.example.com/search/results/advanced?query=typescript+generics+conditional+types&filters=language%3Aen&sort=relevance&page=1&limit=50&category=documentation&tags=advanced%2Ctutorial#section-examples
title: Complex Search Results
clipped: 2024-12-16
---

# Complex Search Results

Advanced TypeScript generics search results with multiple filters.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.75,
		reasoning: "Search results URL with complex query parameters.",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://www.example.com/search/results/advanced?query=typescript+generics+conditional+types&filters=language%3Aen&sort=relevance&page=1&limit=50&category=documentation&tags=advanced%2Ctutorial#section-examples",
			title: "Complex Search Results",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Bookmarks/🔖 Complex Search Results.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://www.example.com/search/results/advanced?query=typescript+generics+conditional+types&filters=language%3Aen&sort=relevance&page=1&limit=50&category=documentation&tags=advanced%2Ctutorial#section-examples",
			title: "Complex Search Results",
		},
		bodyContains: ["Complex Search Results", "TypeScript generics"],
		shouldAutoClassify: false,
		shouldPromptUser: true,
	},
	expectedFields: {
		url: "https://www.example.com/search/results/advanced?query=typescript+generics+conditional+types&filters=language%3Aen&sort=relevance&page=1&limit=50&category=documentation&tags=advanced%2Ctutorial#section-examples",
		title: "Complex Search Results",
	},
};

/**
 * Fast-path bookmark with area wikilink - auto-routes without LLM.
 * Tests the two-path routing when area field is present.
 */
export const BOOKMARK_FASTPATH_AREA: DocumentFixture<"bookmark"> = {
	description: "pre-routed bookmark with area wikilink (fast path)",
	classifier: "bookmark",
	input: {
		filename: "🔖 Finance Article.md",
		content: `---
type: bookmark
url: https://example.com/finance
title: Finance Article
clipped: 2024-12-16
area: "[[Finance]]"
---

# Finance Article

Article about personal finance management.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.0,
		reasoning: "ERROR: LLM should NOT be called for fast-path items",
	}),
	expectedOutcome: {
		noteCreated: "02 Areas/Finance/Bookmarks/🔖 Finance Article.md",
		noteLocation: "Areas",
		frontmatter: {
			type: "bookmark",
			url: "https://example.com/finance",
			title: "Finance Article",
			area: "[[Finance]]",
		},
		bodyContains: ["Finance Article", "personal finance"],
		shouldAutoClassify: true,
		shouldPromptUser: false,
	},
	expectedFields: {
		url: "https://example.com/finance",
		title: "Finance Article",
	},
};

/**
 * Fast-path bookmark with project wikilink - auto-routes without LLM.
 */
export const BOOKMARK_FASTPATH_PROJECT: DocumentFixture<"bookmark"> = {
	description: "pre-routed bookmark with project wikilink (fast path)",
	classifier: "bookmark",
	input: {
		filename: "🔖 Tax Guide 2024.md",
		content: `---
type: bookmark
url: https://ato.gov.au/tax-guide
title: Tax Guide 2024
clipped: 2024-12-16
project: "[[Tax 2024]]"
---

# Tax Guide 2024

Official ATO tax guide for 2024 financial year.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.0,
		reasoning: "ERROR: LLM should NOT be called for fast-path items",
	}),
	expectedOutcome: {
		noteCreated: "01 Projects/Tax 2024/Bookmarks/🔖 Tax Guide 2024.md",
		noteLocation: "Projects",
		frontmatter: {
			type: "bookmark",
			url: "https://ato.gov.au/tax-guide",
			title: "Tax Guide 2024",
			project: "[[Tax 2024]]",
		},
		bodyContains: ["Tax Guide 2024", "ATO"],
		shouldAutoClassify: true,
		shouldPromptUser: false,
	},
	expectedFields: {
		url: "https://ato.gov.au/tax-guide",
		title: "Tax Guide 2024",
	},
};

/**
 * Edge case fixtures array for comprehensive testing.
 */
export const BOOKMARK_EDGE_CASES: DocumentFixture<"bookmark">[] = [
	BOOKMARK_GITHUB_PR,
	BOOKMARK_BANKING,
	BOOKMARK_SPECIAL_CHARS,
	BOOKMARK_UNICODE,
	BOOKMARK_LONG_URL,
	BOOKMARK_FASTPATH_AREA,
	BOOKMARK_FASTPATH_PROJECT,
];

/**
 * Complete fixture set for bookmark classifier integration tests.
 * Organized by completeness and edge cases for systematic testing.
 */
export const BOOKMARK_FIXTURES: FixtureSet<"bookmark"> = {
	complete: BOOKMARK_COMPLETE,
	minimal: BOOKMARK_MINIMAL,
	edgeCases: BOOKMARK_EDGE_CASES,
};
