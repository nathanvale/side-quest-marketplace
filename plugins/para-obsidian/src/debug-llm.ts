/**
 * Debug script to test LLM call chain with real inbox prompt
 * Run with: bun run plugins/para-obsidian/src/debug-llm.ts
 */

import { buildInboxPrompt, parseDetectionResponse } from "./inbox/classify";
import { callLLM } from "./inbox/core/llm";

const MODEL = "qwen2.5:14b" as const;

console.log("=== Real Inbox LLM Test ===\n");

// Test with a sample invoice-like content
const sampleContent = `
INVOICE
Invoice #: INV-2024-001
Date: December 15, 2024

From: Acme Corp
To: John Smith

Services Rendered:
- Web Development: $5,000
- Design Work: $2,000

Total: $7,000 AUD
Due: January 15, 2025
`;

const prompt = buildInboxPrompt({
	content: sampleContent,
	filename: "invoice-acme-dec2024.pdf",
	vaultContext: {
		areas: ["Finance", "Work"],
		projects: ["Website Redesign"],
	},
});

console.log("1. Generated prompt length:", prompt.length, "chars");
console.log("   First 500 chars:\n", prompt.slice(0, 500));

console.log("\n2. Calling LLM...");
try {
	const startTime = Date.now();
	const response = await callLLM(prompt, "haiku", MODEL);
	const duration = Date.now() - startTime;
	console.log(`   ✅ LLM responded in ${duration}ms`);
	console.log(`   Raw response:\n${response}`);

	console.log("\n3. Parsing response...");
	const parsed = parseDetectionResponse(response);
	console.log(`   ✅ Parsed result:`, JSON.stringify(parsed, null, 2));
} catch (error) {
	console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`);
	if (error instanceof Error && error.stack) {
		console.log(`\n   Stack:\n${error.stack}`);
	}
}

console.log("\n=== Done ===");
