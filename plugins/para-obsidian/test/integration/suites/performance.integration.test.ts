/**
 * Performance Benchmark Integration Tests
 *
 * Measures execution time and throughput for inbox processing operations:
 * - Single document classification
 * - Batch processing (5, 10, 20 documents)
 * - Fixture creation overhead
 * - Scan vs execute performance
 *
 * These tests establish baseline performance expectations and catch regressions.
 * They use mock LLM responses to isolate processing logic performance.
 *
 * @module test/integration/suites/performance
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDocumentTypeFixture } from "../fixtures";
import {
	createTestHarness,
	type IntegrationTestHarness,
} from "../helpers/test-harness";

/**
 * Performance thresholds in milliseconds.
 * These are baseline expectations, not hard limits.
 */
const THRESHOLDS = {
	/** Single document scan should complete within this time */
	singleScanMs: 100,
	/** Single document execute should complete within this time */
	singleExecuteMs: 200,
	/** Batch of 5 documents should complete within this time */
	batch5Ms: 500,
	/** Batch of 10 documents should complete within this time */
	batch10Ms: 1000,
	/** Test harness setup should complete within this time */
	setupMs: 50,
};

describe("Performance Benchmarks", () => {
	let harness: IntegrationTestHarness;

	beforeEach(() => {
		harness = createTestHarness();
	});

	afterEach(() => {
		harness.cleanup();
	});

	describe("Single Document Processing", () => {
		test("measures single document scan time", async () => {
			// Setup: Add a typical bookmark document
			await harness.addToInbox(
				"benchmark-doc.md",
				`---
type: bookmark
url: https://example.com/article
title: Benchmark Article
clipped: 2024-12-17
template_version: 1
---

# Benchmark Article

This is a typical bookmark document for performance testing.
Contains enough content to be realistic but not excessive.

## Section 1

Some content here with standard markdown formatting.

## Section 2

More content to simulate a real document.
`,
			);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.9,
					suggestedArea: "Resources",
					extractedFields: {
						url: "https://example.com/article",
						title: "Benchmark Article",
					},
				}),
			);

			// Measure: Scan operation
			const startScan = performance.now();
			const suggestions = await harness.scan();
			const scanTime = performance.now() - startScan;

			// Assert: Scan completes and meets threshold
			expect(suggestions).toHaveLength(1);
			console.log(`Single scan time: ${scanTime.toFixed(2)}ms`);

			// Note: We don't fail on threshold, just report
			// This allows tracking performance trends over time
			if (scanTime > THRESHOLDS.singleScanMs) {
				console.warn(
					`Warning: Scan exceeded threshold (${scanTime.toFixed(2)}ms > ${THRESHOLDS.singleScanMs}ms)`,
				);
			}
		});

		test("measures single document execute time", async () => {
			await harness.addToInbox(
				"benchmark-execute.md",
				`---
type: bookmark
url: https://example.com/execute-test
title: Execute Benchmark
clipped: 2024-12-17
template_version: 1
---

# Execute Benchmark

Document for measuring execute performance.
`,
			);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.92,
					suggestedArea: "Resources",
					extractedFields: {
						url: "https://example.com/execute-test",
						title: "Execute Benchmark",
					},
				}),
			);

			// Scan first (required before execute)
			await harness.scan();

			// Measure: Execute operation
			const startExecute = performance.now();
			const results = await harness.execute();
			const executeTime = performance.now() - startExecute;

			// Assert
			expect(results).toHaveLength(1);
			expect(results[0]!.success).toBe(true);
			console.log(`Single execute time: ${executeTime.toFixed(2)}ms`);

			if (executeTime > THRESHOLDS.singleExecuteMs) {
				console.warn(
					`Warning: Execute exceeded threshold (${executeTime.toFixed(2)}ms > ${THRESHOLDS.singleExecuteMs}ms)`,
				);
			}
		});

		test("measures end-to-end single document processing", async () => {
			await harness.addToInbox(
				"e2e-benchmark.md",
				`---
type: bookmark
url: https://example.com/e2e
title: End-to-End Benchmark
clipped: 2024-12-17
template_version: 1
---

# End-to-End Benchmark

Complete workflow test document.
`,
			);

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.88,
					suggestedArea: "Resources",
					extractedFields: {
						url: "https://example.com/e2e",
						title: "End-to-End Benchmark",
					},
				}),
			);

			// Measure: Complete workflow
			const startE2E = performance.now();
			await harness.scan();
			await harness.execute();
			const e2eTime = performance.now() - startE2E;

			console.log(`End-to-end time: ${e2eTime.toFixed(2)}ms`);

			// E2E should be less than scan + execute thresholds combined
			const combinedThreshold =
				THRESHOLDS.singleScanMs + THRESHOLDS.singleExecuteMs;
			if (e2eTime > combinedThreshold) {
				console.warn(
					`Warning: E2E exceeded combined threshold (${e2eTime.toFixed(2)}ms > ${combinedThreshold}ms)`,
				);
			}
		});
	});

	describe("Batch Processing", () => {
		test("measures batch of 5 documents", async () => {
			// Setup: Add 5 documents
			for (let i = 0; i < 5; i++) {
				await harness.addToInbox(
					`batch5-doc-${i}.md`,
					`---
type: bookmark
url: https://example.com/batch5/${i}
title: Batch Document ${i}
clipped: 2024-12-17
template_version: 1
---

# Batch Document ${i}

Content for batch processing test.
`,
				);
			}

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.85,
					suggestedArea: "Resources",
					extractedFields: {
						url: "https://example.com/batch",
						title: "Batch Document",
					},
				}),
			);

			// Measure: Batch processing
			const startBatch = performance.now();
			const suggestions = await harness.scan();
			const results = await harness.execute();
			const batchTime = performance.now() - startBatch;

			// Assert
			expect(suggestions).toHaveLength(5);
			expect(results.filter((r) => r.success)).toHaveLength(5);

			console.log(`Batch of 5 time: ${batchTime.toFixed(2)}ms`);
			console.log(`Average per document: ${(batchTime / 5).toFixed(2)}ms`);

			if (batchTime > THRESHOLDS.batch5Ms) {
				console.warn(
					`Warning: Batch 5 exceeded threshold (${batchTime.toFixed(2)}ms > ${THRESHOLDS.batch5Ms}ms)`,
				);
			}
		});

		test("measures batch of 10 documents", async () => {
			// Setup: Add 10 documents
			for (let i = 0; i < 10; i++) {
				await harness.addToInbox(
					`batch10-doc-${i}.md`,
					`---
type: bookmark
url: https://example.com/batch10/${i}
title: Batch Document ${i}
clipped: 2024-12-17
template_version: 1
---

# Batch Document ${i}

Content for larger batch test.
`,
				);
			}

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.85,
					suggestedArea: "Resources",
					extractedFields: {
						url: "https://example.com/batch10",
						title: "Batch Document",
					},
				}),
			);

			// Measure
			const startBatch = performance.now();
			const suggestions = await harness.scan();
			const results = await harness.execute();
			const batchTime = performance.now() - startBatch;

			// Assert
			expect(suggestions).toHaveLength(10);
			expect(results.filter((r) => r.success)).toHaveLength(10);

			console.log(`Batch of 10 time: ${batchTime.toFixed(2)}ms`);
			console.log(`Average per document: ${(batchTime / 10).toFixed(2)}ms`);

			if (batchTime > THRESHOLDS.batch10Ms) {
				console.warn(
					`Warning: Batch 10 exceeded threshold (${batchTime.toFixed(2)}ms > ${THRESHOLDS.batch10Ms}ms)`,
				);
			}
		});

		test("measures scaling behavior (linear vs sublinear)", async () => {
			// This test checks if processing scales reasonably
			// Sublinear is good (parallelization), superlinear is bad (O(n²))

			const batchSizes = [1, 3, 5, 10];
			const times: { size: number; timeMs: number }[] = [];

			for (const size of batchSizes) {
				// Create fresh harness for each batch size
				const batchHarness = createTestHarness();

				try {
					for (let i = 0; i < size; i++) {
						await batchHarness.addToInbox(
							`scale-test-${size}-${i}.md`,
							`---
type: bookmark
url: https://example.com/scale/${i}
title: Scale Test ${i}
clipped: 2024-12-17
template_version: 1
---

# Scale Test

Document ${i} of ${size}
`,
						);
					}

					batchHarness.setLLMResponse(
						createDocumentTypeFixture({
							documentType: "bookmark",
							confidence: 0.8,
							extractedFields: { url: "https://example.com", title: "Test" },
						}),
					);

					const start = performance.now();
					await batchHarness.scan();
					await batchHarness.execute();
					const elapsed = performance.now() - start;

					times.push({ size, timeMs: elapsed });
				} finally {
					batchHarness.cleanup();
				}
			}

			// Report scaling behavior
			console.log("\nScaling Analysis:");
			console.log("Size | Time (ms) | Per Doc (ms)");
			console.log("-----|-----------|-------------");
			for (const { size, timeMs } of times) {
				console.log(
					`${size.toString().padStart(4)} | ${timeMs.toFixed(1).padStart(9)} | ${(timeMs / size).toFixed(1).padStart(11)}`,
				);
			}

			// Check that per-document time doesn't grow significantly
			const time1 = times.find((t) => t.size === 1)?.timeMs ?? 0;
			const time10 = times.find((t) => t.size === 10)?.timeMs ?? 0;

			// 10 docs should take less than 10x single doc time (allow for overhead)
			const scalingFactor = time10 / time1 / 10;
			console.log(`\nScaling factor: ${scalingFactor.toFixed(2)}`);
			console.log(
				scalingFactor <= 1.5
					? "Good: Sublinear or linear scaling"
					: "Warning: Superlinear scaling detected",
			);

			// Soft assertion - just warn, don't fail
			// Real performance issues will be caught in CI trends
		});
	});

	describe("Setup Overhead", () => {
		test("measures test harness creation time", () => {
			const iterations = 10;
			const times: number[] = [];

			for (let i = 0; i < iterations; i++) {
				const start = performance.now();
				const testHarness = createTestHarness();
				const elapsed = performance.now() - start;
				times.push(elapsed);
				testHarness.cleanup();
			}

			const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
			const maxTime = Math.max(...times);
			const minTime = Math.min(...times);

			console.log(`\nHarness Creation (${iterations} iterations):`);
			console.log(`  Average: ${avgTime.toFixed(2)}ms`);
			console.log(`  Min: ${minTime.toFixed(2)}ms`);
			console.log(`  Max: ${maxTime.toFixed(2)}ms`);

			// Setup should be fast to encourage writing more tests
			if (avgTime > THRESHOLDS.setupMs) {
				console.warn(
					`Warning: Setup overhead high (${avgTime.toFixed(2)}ms > ${THRESHOLDS.setupMs}ms)`,
				);
			}
		});

		test("measures fixture creation overhead", () => {
			const iterations = 100;
			const times: number[] = [];

			for (let i = 0; i < iterations; i++) {
				const start = performance.now();
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.9,
					reasoning: "Test reasoning for performance measurement",
					suggestedArea: "Resources",
					extractedFields: {
						url: `https://example.com/perf/${i}`,
						title: `Performance Test ${i}`,
						author: "Test Author",
						category: "testing",
					},
				});
				const elapsed = performance.now() - start;
				times.push(elapsed);
			}

			const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
			const totalTime = times.reduce((a, b) => a + b, 0);

			console.log(`\nFixture Creation (${iterations} iterations):`);
			console.log(`  Average: ${avgTime.toFixed(4)}ms`);
			console.log(`  Total: ${totalTime.toFixed(2)}ms`);

			// Fixture creation should be nearly instant
			expect(avgTime).toBeLessThan(1); // Less than 1ms per fixture
		});
	});

	describe("Memory Usage", () => {
		test("reports memory usage after batch processing", async () => {
			// Note: Bun's memory reporting may differ from Node.js
			// This test primarily documents behavior

			const initialMemory = process.memoryUsage();

			// Add 20 documents
			for (let i = 0; i < 20; i++) {
				await harness.addToInbox(
					`memory-test-${i}.md`,
					`---
type: bookmark
url: https://example.com/memory/${i}
title: Memory Test Document ${i}
clipped: 2024-12-17
template_version: 1
---

# Memory Test Document ${i}

${"Content ".repeat(100)}
`,
				);
			}

			harness.setLLMResponse(
				createDocumentTypeFixture({
					documentType: "bookmark",
					confidence: 0.85,
					extractedFields: { url: "https://example.com", title: "Test" },
				}),
			);

			await harness.scan();
			await harness.execute();

			const finalMemory = process.memoryUsage();

			const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
			const rssGrowth = finalMemory.rss - initialMemory.rss;

			console.log("\nMemory Usage (20 documents):");
			console.log(`  Heap growth: ${(heapGrowth / 1024 / 1024).toFixed(2)}MB`);
			console.log(`  RSS growth: ${(rssGrowth / 1024 / 1024).toFixed(2)}MB`);
			console.log(
				`  Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
			);

			// Memory growth should be reasonable
			// This is informational, not a hard limit
			if (heapGrowth > 50 * 1024 * 1024) {
				// 50MB
				console.warn("Warning: High memory growth detected");
			}
		});
	});
});

describe("Performance Summary", () => {
	test("generates performance report", () => {
		// This test just documents the thresholds for reference
		console.log("\n=== Performance Thresholds ===");
		console.log(`Single scan:    ${THRESHOLDS.singleScanMs}ms`);
		console.log(`Single execute: ${THRESHOLDS.singleExecuteMs}ms`);
		console.log(`Batch of 5:     ${THRESHOLDS.batch5Ms}ms`);
		console.log(`Batch of 10:    ${THRESHOLDS.batch10Ms}ms`);
		console.log(`Setup:          ${THRESHOLDS.setupMs}ms`);
		console.log("==============================\n");

		// This test always passes - it's documentation
		expect(true).toBe(true);
	});
});
