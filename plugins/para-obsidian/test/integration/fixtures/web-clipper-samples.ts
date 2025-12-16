/**
 * Real-world Web Clipper Sample Fixtures
 *
 * These fixtures represent actual content patterns from Obsidian Web Clipper.
 * Used for integration testing of bookmark classification and processing.
 *
 * Categories:
 * 1. Technical articles (dev blogs, documentation)
 * 2. Recipes (cooking sites)
 * 3. Videos (YouTube, Vimeo)
 * 4. News articles
 * 5. Product pages
 *
 * @module test/integration/fixtures/web-clipper-samples
 */

import type { DocumentFixture } from "./index";
import { createDocumentTypeFixture } from "./index";

/**
 * Technical article from a developer blog.
 * Represents common dev documentation clips.
 */
export const TECH_ARTICLE_MARTIN_FOWLER: DocumentFixture<"bookmark"> = {
	description: "Technical article from Martin Fowler's blog",
	classifier: "bookmark",
	input: {
		filename: "Microservices Guide.md",
		content: `---
type: bookmark
url: https://martinfowler.com/articles/microservices.html
title: Microservices Guide
clipped: 2024-12-17
template_version: 1
---

# Microservices Guide

In short, the microservice architectural style is an approach to developing a single application as a suite of small services, each running in its own process and communicating with lightweight mechanisms.

## Characteristics of a Microservice Architecture

### Componentization via Services

For as long as we've been involved in the software industry, there's been a desire to build systems by plugging together components.

### Organized around Business Capabilities

When looking to split a large application into parts, often management focuses on the technology layer.

### Products not Projects

Most application development efforts that we see use a project model: where the aim is to deliver some piece of software which is then considered to be completed.

---

> "Any organization that designs a system will produce a design whose structure is a copy of the organization's communication structure." - Conway's Law
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.92,
		reasoning:
			"Well-structured technical article with clear frontmatter, URL, and technical content about software architecture",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://martinfowler.com/articles/microservices.html",
			title: "Microservices Guide",
			author: "Martin Fowler",
			category: "software-architecture",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Microservices Guide.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://martinfowler.com/articles/microservices.html",
			title: "Microservices Guide",
		},
		shouldAutoClassify: true,
	},
	expectedFields: {
		url: "https://martinfowler.com/articles/microservices.html",
		title: "Microservices Guide",
		author: "Martin Fowler",
		category: "software-architecture",
	},
};

/**
 * Recipe from a cooking blog.
 * Common pattern for home cooks clipping recipes.
 */
export const RECIPE_SERIOUS_EATS: DocumentFixture<"bookmark"> = {
	description: "Recipe from Serious Eats with author attribution",
	classifier: "bookmark",
	input: {
		filename: "Perfect Roast Chicken.md",
		content: `---
type: bookmark
url: https://www.seriouseats.com/perfect-roast-chicken
title: The Best Roast Chicken
clipped: 2024-12-16
template_version: 1
author: J. Kenji López-Alt
---

# The Best Roast Chicken

The key to perfect roast chicken is all about managing moisture.

## Why It Works

- Dry-brining seasons the meat throughout
- Starting in a cold oven ensures even cooking
- High heat at the end crisps the skin

## Ingredients

- 1 (3.5 to 4-pound) whole chicken
- Kosher salt
- Freshly ground black pepper
- 2 tablespoons unsalted butter

## Instructions

1. **Day before:** Pat chicken dry and season generously with salt. Refrigerate uncovered overnight.
2. **Cooking day:** Let chicken come to room temperature for 1 hour.
3. Place in a cold oven, set to 400°F.
4. Roast until internal temp reaches 150°F (about 1 hour).
5. Increase heat to 450°F and roast until skin is crispy (10-15 minutes).

---

*Recipe adapted from The Food Lab*
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.95,
		reasoning:
			"Clear recipe format with ingredients, instructions, and author attribution typical of cooking blog clips",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://www.seriouseats.com/perfect-roast-chicken",
			title: "The Best Roast Chicken",
			author: "J. Kenji López-Alt",
			category: "recipes",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Perfect Roast Chicken.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://www.seriouseats.com/perfect-roast-chicken",
			title: "The Best Roast Chicken",
		},
		shouldAutoClassify: true,
	},
	expectedFields: {
		url: "https://www.seriouseats.com/perfect-roast-chicken",
		title: "The Best Roast Chicken",
		author: "J. Kenji López-Alt",
		category: "recipes",
	},
};

/**
 * YouTube video clip.
 * Common pattern for saving video content.
 */
export const VIDEO_YOUTUBE: DocumentFixture<"bookmark"> = {
	description: "YouTube video with description",
	classifier: "bookmark",
	input: {
		filename: "TypeScript Tutorial 2024.md",
		content: `---
type: bookmark
url: https://www.youtube.com/watch?v=30LWjhZzg50
title: TypeScript Tutorial for Beginners [2024]
clipped: 2024-12-15
template_version: 1
---

# TypeScript Tutorial for Beginners [2024]

Learn TypeScript in this comprehensive tutorial for beginners.

## What You'll Learn

- TypeScript basics and setup
- Type annotations and inference
- Interfaces and type aliases
- Generics and utility types
- Best practices for 2024

## Timestamps

- 0:00 Introduction
- 5:30 Setting up TypeScript
- 15:00 Basic Types
- 30:00 Functions
- 45:00 Objects and Interfaces
- 1:00:00 Generics

---

Channel: Programming with Mosh
Duration: 1:30:00
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.88,
		reasoning:
			"YouTube video clip with typical structure: title, description, timestamps, and channel attribution",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://www.youtube.com/watch?v=30LWjhZzg50",
			title: "TypeScript Tutorial for Beginners [2024]",
			author: "Programming with Mosh",
			category: "tutorials",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/TypeScript Tutorial 2024.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://www.youtube.com/watch?v=30LWjhZzg50",
			title: "TypeScript Tutorial for Beginners [2024]",
		},
		shouldAutoClassify: true,
	},
	expectedFields: {
		url: "https://www.youtube.com/watch?v=30LWjhZzg50",
		title: "TypeScript Tutorial for Beginners [2024]",
		author: "Programming with Mosh",
		category: "tutorials",
	},
};

/**
 * News article from a publication.
 * Represents current events and journalism clips.
 */
export const NEWS_ARTICLE: DocumentFixture<"bookmark"> = {
	description: "News article from tech publication",
	classifier: "bookmark",
	input: {
		filename: "Bun 1.0 Release.md",
		content: `---
type: bookmark
url: https://bun.sh/blog/bun-v1.0
title: Bun 1.0 is here
clipped: 2024-09-08
template_version: 1
published: 2023-09-08
---

# Bun 1.0 is here

After nearly two years of development and over 150,000 commits, Bun 1.0 is finally here.

## What is Bun?

Bun is an all-in-one JavaScript runtime & toolkit designed for speed, complete with a bundler, test runner, and Node.js-compatible package manager.

## Highlights

- **4x faster** than Node.js for running JavaScript
- **25x faster** package installation than npm
- Native TypeScript and JSX support
- Drop-in Node.js replacement

## Benchmarks

| Task | Bun | Node |
|------|-----|------|
| Hello World | 0.08s | 0.3s |
| Install lodash | 0.1s | 2.5s |

---

*By Jarred Sumner, Bun creator*
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.9,
		reasoning:
			"Tech news article with publication date, author, and structured content about a software release",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://bun.sh/blog/bun-v1.0",
			title: "Bun 1.0 is here",
			author: "Jarred Sumner",
			published: "2023-09-08",
			category: "tech-news",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Bun 1.0 Release.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://bun.sh/blog/bun-v1.0",
			title: "Bun 1.0 is here",
			published: "2023-09-08",
		},
		shouldAutoClassify: true,
	},
	expectedFields: {
		url: "https://bun.sh/blog/bun-v1.0",
		title: "Bun 1.0 is here",
		author: "Jarred Sumner",
		published: "2023-09-08",
	},
};

/**
 * Documentation page clip.
 * Common for developers saving reference docs.
 */
export const DOCUMENTATION_PAGE: DocumentFixture<"bookmark"> = {
	description: "Documentation page from official docs",
	classifier: "bookmark",
	input: {
		filename: "Bun Test Runner.md",
		content: `---
type: bookmark
url: https://bun.sh/docs/cli/test
title: bun test - Test runner
clipped: 2024-12-17
template_version: 1
---

# bun test

Bun ships with a fast, built-in test runner.

## Quick Start

\`\`\`typescript
import { expect, test } from "bun:test";

test("2 + 2", () => {
  expect(2 + 2).toBe(4);
});
\`\`\`

## Running Tests

\`\`\`bash
bun test              # Run all tests
bun test ./src        # Run tests in directory
bun test --watch      # Watch mode
\`\`\`

## Assertions

- \`expect(value).toBe(expected)\`
- \`expect(value).toEqual(expected)\`
- \`expect(fn).toThrow()\`

---

See also: [bun:test API reference](https://bun.sh/docs/api/test)
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.93,
		reasoning:
			"Official documentation page with code examples and structured reference content",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://bun.sh/docs/cli/test",
			title: "bun test - Test runner",
			category: "documentation",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Bun Test Runner.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://bun.sh/docs/cli/test",
			title: "bun test - Test runner",
		},
		shouldAutoClassify: true,
	},
	expectedFields: {
		url: "https://bun.sh/docs/cli/test",
		title: "bun test - Test runner",
		category: "documentation",
	},
};

/**
 * Product page clip.
 * E-commerce or product research pattern.
 */
export const PRODUCT_PAGE: DocumentFixture<"bookmark"> = {
	description: "Product page from e-commerce site",
	classifier: "bookmark",
	input: {
		filename: "Keychron K2 Keyboard.md",
		content: `---
type: bookmark
url: https://www.keychron.com/products/keychron-k2-wireless-mechanical-keyboard
title: Keychron K2 Wireless Mechanical Keyboard
clipped: 2024-12-10
template_version: 1
---

# Keychron K2 Wireless Mechanical Keyboard

A 75% layout wireless mechanical keyboard for Mac and Windows.

## Features

- Bluetooth 5.1 & USB-C wired
- Hot-swappable version available
- Mac and Windows compatible
- 4000mAh battery (up to 240 hours)

## Specifications

| Spec | Value |
|------|-------|
| Layout | 75% (84 keys) |
| Switches | Gateron (Red/Brown/Blue) |
| Keycaps | Double-shot ABS |
| Backlight | White LED |

## Price

$89 USD

---

*Considering for home office setup*
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.85,
		reasoning:
			"Product page with specifications table, features list, and pricing typical of e-commerce clips",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://www.keychron.com/products/keychron-k2-wireless-mechanical-keyboard",
			title: "Keychron K2 Wireless Mechanical Keyboard",
			category: "products",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Keychron K2 Keyboard.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://www.keychron.com/products/keychron-k2-wireless-mechanical-keyboard",
			title: "Keychron K2 Wireless Mechanical Keyboard",
		},
		shouldAutoClassify: true,
	},
	expectedFields: {
		url: "https://www.keychron.com/products/keychron-k2-wireless-mechanical-keyboard",
		title: "Keychron K2 Wireless Mechanical Keyboard",
		category: "products",
	},
};

/**
 * GitHub repository clip.
 * Common for developers saving project references.
 */
export const GITHUB_REPO: DocumentFixture<"bookmark"> = {
	description: "GitHub repository page",
	classifier: "bookmark",
	input: {
		filename: "Zod TypeScript Validation.md",
		content: `---
type: bookmark
url: https://github.com/colinhacks/zod
title: colinhacks/zod: TypeScript-first schema validation
clipped: 2024-12-17
template_version: 1
---

# zod

TypeScript-first schema validation with static type inference.

## Installation

\`\`\`bash
npm install zod
# or
bun add zod
\`\`\`

## Basic Usage

\`\`\`typescript
import { z } from "zod";

const User = z.object({
  name: z.string(),
  age: z.number().min(0),
  email: z.string().email(),
});

type User = z.infer<typeof User>;
\`\`\`

## Stats

- Stars: 28.5k
- License: MIT
- Latest: v3.22.4

---

*Alternative to io-ts for runtime validation*
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.91,
		reasoning:
			"GitHub repository documentation with installation instructions, code examples, and project stats",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://github.com/colinhacks/zod",
			title: "colinhacks/zod: TypeScript-first schema validation",
			author: "colinhacks",
			category: "github",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Zod TypeScript Validation.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://github.com/colinhacks/zod",
			title: "colinhacks/zod: TypeScript-first schema validation",
		},
		shouldAutoClassify: true,
	},
	expectedFields: {
		url: "https://github.com/colinhacks/zod",
		title: "colinhacks/zod: TypeScript-first schema validation",
		author: "colinhacks",
		category: "github",
	},
};

/**
 * Blog post with personal notes.
 * Shows user annotation pattern in clips.
 */
export const BLOG_WITH_NOTES: DocumentFixture<"bookmark"> = {
	description: "Blog post with personal notes added",
	classifier: "bookmark",
	input: {
		filename: "ADHD Productivity Tips.md",
		content: `---
type: bookmark
url: https://www.additudemag.com/productivity-tips-adhd-adults/
title: 17 Productivity Tips for Adults with ADHD
clipped: 2024-12-12
template_version: 1
notes: Really helpful list, especially the time boxing technique
---

# 17 Productivity Tips for Adults with ADHD

Strategies to manage time, stay focused, and get things done.

## Time Management

1. **Time boxing** - Set specific time limits for tasks
2. **Body doubling** - Work alongside someone else
3. **External deadlines** - Create accountability

## Focus Techniques

4. Use noise-canceling headphones
5. Keep phone in another room
6. Break large tasks into small steps

## My Takeaways

> The time boxing technique really works for me. Setting a 25-minute timer helps me get started.

---

*Shared by Dr. Russell Barkley*
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.87,
		reasoning:
			"Blog article with personal notes field and highlighted takeaways, showing active reading pattern",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://www.additudemag.com/productivity-tips-adhd-adults/",
			title: "17 Productivity Tips for Adults with ADHD",
			category: "productivity",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/ADHD Productivity Tips.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://www.additudemag.com/productivity-tips-adhd-adults/",
			title: "17 Productivity Tips for Adults with ADHD",
			notes: "Really helpful list, especially the time boxing technique",
		},
		shouldAutoClassify: true,
	},
	expectedFields: {
		url: "https://www.additudemag.com/productivity-tips-adhd-adults/",
		title: "17 Productivity Tips for Adults with ADHD",
		category: "productivity",
	},
};

/**
 * Minimal clip with just URL and title.
 * Edge case: minimal Web Clipper output.
 */
export const MINIMAL_CLIP: DocumentFixture<"bookmark"> = {
	description: "Minimal clip with only required fields",
	classifier: "bookmark",
	input: {
		filename: "Quick Save.md",
		content: `---
type: bookmark
url: https://example.com/article
title: Interesting Article
clipped: 2024-12-17
template_version: 1
---

# Interesting Article

Quick save for later reading.
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.75,
		reasoning:
			"Minimal bookmark with required fields only, limited content for classification",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://example.com/article",
			title: "Interesting Article",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Quick Save.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://example.com/article",
			title: "Interesting Article",
		},
		shouldAutoClassify: true,
	},
	expectedFields: {
		url: "https://example.com/article",
		title: "Interesting Article",
	},
};

/**
 * Academic paper/research clip.
 * Common for researchers and students.
 */
export const ACADEMIC_PAPER: DocumentFixture<"bookmark"> = {
	description: "Academic paper or research article",
	classifier: "bookmark",
	input: {
		filename: "Attention Is All You Need.md",
		content: `---
type: bookmark
url: https://arxiv.org/abs/1706.03762
title: "Attention Is All You Need"
clipped: 2024-12-17
template_version: 1
author: Vaswani et al.
published: 2017-06-12
---

# Attention Is All You Need

## Abstract

The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.

## Key Contributions

1. **Self-attention mechanism** - Allows modeling dependencies without regard to distance
2. **Multi-head attention** - Attends to different representation subspaces
3. **Positional encoding** - Injects sequence order information

## Citation

\`\`\`bibtex
@article{vaswani2017attention,
  title={Attention is all you need},
  author={Vaswani, Ashish and Shazeer, Noam and ...},
  journal={NeurIPS},
  year={2017}
}
\`\`\`

---

*Foundational paper for modern LLMs*
`,
	},
	_mockLLMResponse: createDocumentTypeFixture({
		documentType: "bookmark",
		confidence: 0.94,
		reasoning:
			"Academic paper with abstract, authors, publication date, and BibTeX citation - research content pattern",
		suggestedArea: "Resources",
		extractedFields: {
			url: "https://arxiv.org/abs/1706.03762",
			title: "Attention Is All You Need",
			author: "Vaswani et al.",
			published: "2017-06-12",
			category: "research",
		},
	}),
	expectedOutcome: {
		noteCreated: "00 Inbox/Attention Is All You Need.md",
		noteLocation: "00 Inbox",
		frontmatter: {
			type: "bookmark",
			url: "https://arxiv.org/abs/1706.03762",
			title: "Attention Is All You Need",
			author: "Vaswani et al.",
			published: "2017-06-12",
		},
		shouldAutoClassify: true,
	},
	expectedFields: {
		url: "https://arxiv.org/abs/1706.03762",
		title: "Attention Is All You Need",
		author: "Vaswani et al.",
		published: "2017-06-12",
	},
};

/**
 * All Web Clipper sample fixtures for export.
 */
export const WEB_CLIPPER_SAMPLES = {
	techArticle: TECH_ARTICLE_MARTIN_FOWLER,
	recipe: RECIPE_SERIOUS_EATS,
	video: VIDEO_YOUTUBE,
	news: NEWS_ARTICLE,
	documentation: DOCUMENTATION_PAGE,
	product: PRODUCT_PAGE,
	github: GITHUB_REPO,
	blogWithNotes: BLOG_WITH_NOTES,
	minimal: MINIMAL_CLIP,
	academic: ACADEMIC_PAPER,
} as const;

/**
 * Array of all samples for iteration.
 */
export const ALL_WEB_CLIPPER_SAMPLES = Object.values(WEB_CLIPPER_SAMPLES);
