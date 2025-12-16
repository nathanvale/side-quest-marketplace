#!/usr/bin/env bun
/**
 * Fixture Recorder for Para Obsidian Integration Tests
 *
 * Records real Ollama API responses for use in integration tests.
 * This script:
 * 1. Checks if Ollama is running
 * 2. Processes sample documents through the real LLM
 * 3. Saves responses as JSON fixtures with metadata
 *
 * Usage:
 *   bun run test/integration/scripts/record-fixtures.ts
 *
 * Prerequisites:
 *   - Ollama running: `ollama serve`
 *   - Model available: `ollama pull qwen2.5:14b`
 *
 * @module test/integration/scripts/record-fixtures
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const FIXTURES_DIR = path.join(import.meta.dir, "..", "fixtures", "recorded");

const OLLAMA_URL = "http://localhost:11434";

interface RecordedFixture {
	recordedAt: string;
	model: string;
	input: {
		filename: string;
		content: string;
	};
	response: {
		documentType: string;
		confidence: number;
		reasoning: string;
		suggestedArea: string | null;
		suggestedProject: string | null;
		extractedFields: Record<string, unknown>;
		suggestedFilenameDescription: string | null;
		extractionWarnings: string[];
	};
	metadata: {
		responseTimeMs: number;
		rawResponse?: string;
	};
}

/**
 * Sample documents to record LLM responses for.
 * These represent common inbox items.
 */
const SAMPLE_DOCUMENTS = [
	{
		filename: "web-clipper-article.md",
		content: `---
type: bookmark
url: https://martinfowler.com/articles/microservices.html
title: Microservices Guide
clipped: 2024-12-17
template_version: 1
---

# Microservices Guide

A definition of this new architectural term...

## Characteristics of Microservices

- Componentization via Services
- Organized around Business Capabilities
- Products not Projects

Great article on distributed systems architecture.
`,
	},
	{
		filename: "invoice-scan.md",
		content: `---
type: invoice
---

# Invoice

**Provider:** Acme Software Pty Ltd
**ABN:** 12 345 678 901
**Invoice Number:** INV-2024-1234
**Date:** 2024-12-15
**Due Date:** 2025-01-15

| Description | Amount |
|-------------|--------|
| Software License | $299.00 |
| Support | $50.00 |
| **Total** | **$349.00 AUD** |
| GST Included | $31.73 |

Please pay within 30 days.
`,
	},
	{
		filename: "tech-bookmark.md",
		content: `---
type: bookmark
url: https://bun.sh/docs/installation
title: Bun Installation
clipped: 2024-12-17
template_version: 1
---

# Bun Installation

Bun is an all-in-one JavaScript runtime & toolkit.

## Install

curl -fsSL https://bun.sh/install | bash

## Features

- Fast package manager
- TypeScript support
- Test runner built in
`,
	},
	{
		filename: "recipe-bookmark.md",
		content: `---
type: bookmark
url: https://www.seriouseats.com/slow-roasted-lamb
title: Slow Roasted Lamb Shoulder
clipped: 2024-12-17
template_version: 1
author: J. Kenji López-Alt
---

# Slow Roasted Lamb Shoulder

A foolproof recipe for melt-in-your-mouth lamb.

## Ingredients

- 4 lb lamb shoulder
- Fresh rosemary
- Garlic cloves

## Method

1. Season generously
2. Roast at 275°F for 6 hours
3. Rest before carving

Perfect for Sunday dinner!
`,
	},
	{
		filename: "video-bookmark.md",
		content: `---
type: bookmark
url: https://www.youtube.com/watch?v=dQw4w9WgXcQ
title: Learn TypeScript in 2024
clipped: 2024-12-17
template_version: 1
---

# Learn TypeScript in 2024

Comprehensive tutorial covering all the basics.

## Topics Covered

- Type annotations
- Interfaces and types
- Generics
- Utility types

Great introduction for beginners!
`,
	},
];

async function checkOllama(): Promise<boolean> {
	try {
		const response = await fetch(`${OLLAMA_URL}/api/tags`);
		return response.ok;
	} catch {
		return false;
	}
}

async function getAvailableModels(): Promise<string[]> {
	try {
		const response = await fetch(`${OLLAMA_URL}/api/tags`);
		const data = (await response.json()) as { models?: { name: string }[] };
		return data.models?.map((m) => m.name) ?? [];
	} catch {
		return [];
	}
}

async function classifyDocument(
	content: string,
	model: string,
): Promise<{ response: RecordedFixture["response"]; timeMs: number }> {
	const startTime = Date.now();

	// Build classification prompt (simplified version of the real prompt)
	const prompt = `Analyze this markdown document and classify it.

DOCUMENT:
${content}

Respond in valid JSON with this structure:
{
  "documentType": "bookmark" | "invoice" | "generic",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "suggestedArea": "Resources" | "Projects" | "Areas" | null,
  "suggestedProject": null,
  "extractedFields": { "url": "...", "title": "...", etc },
  "suggestedFilenameDescription": "short-description" | null,
  "extractionWarnings": []
}

JSON response:`;

	const response = await fetch(`${OLLAMA_URL}/api/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model,
			prompt,
			stream: false,
			options: {
				temperature: 0.1,
				num_predict: 1024,
			},
		}),
	});

	const data = (await response.json()) as { response: string };
	const timeMs = Date.now() - startTime;

	// Parse the JSON response
	const jsonMatch = data.response.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		throw new Error("No JSON found in response");
	}

	const parsed = JSON.parse(jsonMatch[0]) as RecordedFixture["response"];

	return { response: parsed, timeMs };
}

async function main(): Promise<void> {
	console.log("Para Obsidian Fixture Recorder");
	console.log("==============================\n");

	// Check Ollama
	const ollamaRunning = await checkOllama();
	if (!ollamaRunning) {
		console.error("ERROR: Ollama is not running.");
		console.error("Start it with: ollama serve");
		process.exit(1);
	}
	console.log("Ollama is running");

	// Get available models
	const models = await getAvailableModels();
	if (models.length === 0) {
		console.error("ERROR: No models available.");
		console.error("Pull a model with: ollama pull qwen2.5:14b");
		process.exit(1);
	}

	// Prefer qwen2.5:14b, fall back to first available
	const preferredModels = ["qwen2.5:14b", "qwen:14b", "llama3.1:8b"];
	const model =
		preferredModels.find((m) => models.includes(m)) ??
		models[0] ??
		"qwen2.5:14b";
	console.log(`Using model: ${model}`);
	console.log(`Available models: ${models.join(", ")}\n`);

	// Ensure output directory exists
	await fs.mkdir(FIXTURES_DIR, { recursive: true });

	// Process each sample document
	let successCount = 0;
	let failCount = 0;

	for (const doc of SAMPLE_DOCUMENTS) {
		console.log(`Recording: ${doc.filename}`);

		try {
			const { response, timeMs } = await classifyDocument(doc.content, model);

			const fixture: RecordedFixture = {
				recordedAt: new Date().toISOString(),
				model,
				input: {
					filename: doc.filename,
					content: doc.content,
				},
				response,
				metadata: {
					responseTimeMs: timeMs,
				},
			};

			const outputPath = path.join(
				FIXTURES_DIR,
				doc.filename.replace(".md", ".json"),
			);
			await fs.writeFile(outputPath, JSON.stringify(fixture, null, 2));

			console.log(
				`  Type: ${response.documentType} (${(response.confidence * 100).toFixed(0)}%)`,
			);
			console.log(`  Time: ${timeMs}ms`);
			console.log(`  Saved: ${path.basename(outputPath)}`);
			successCount++;
		} catch (error) {
			console.error(
				`  ERROR: ${error instanceof Error ? error.message : error}`,
			);
			failCount++;
		}
	}

	console.log("\n==============================");
	console.log(`Recorded: ${successCount}/${SAMPLE_DOCUMENTS.length} fixtures`);
	if (failCount > 0) {
		console.log(`Failed: ${failCount}`);
	}
	console.log(`Output: ${FIXTURES_DIR}`);
}

main().catch(console.error);
