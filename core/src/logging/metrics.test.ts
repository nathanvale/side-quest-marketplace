import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getGlobalMetricsCollector,
	MetricsCollector,
	resetGlobalMetricsCollector,
} from "./metrics";

describe("MetricsCollector", () => {
	let tempDir: string;

	beforeEach(() => {
		// Create temporary log directory
		tempDir = join(tmpdir(), `metrics-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
		resetGlobalMetricsCollector();
	});

	afterEach(() => {
		// Clean up
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test("recordOperation tracks single operation", () => {
		const collector = new MetricsCollector({ logDir: tempDir });

		collector.recordOperation("test_tool", 150, true);

		const summary = collector.getSummary();
		expect(summary.totalOperations).toBe(1);
		expect(summary.successfulOperations).toBe(1);
		expect(summary.failedOperations).toBe(0);
		expect(summary.toolMetrics).toHaveLength(1);
		expect(summary.toolMetrics[0]?.tool).toBe("test_tool");
		expect(summary.toolMetrics[0]?.avgDurationMs).toBe(150);
		expect(summary.toolMetrics[0]?.successRate).toBe(100);
	});

	test("recordOperation aggregates multiple calls", () => {
		const collector = new MetricsCollector({ logDir: tempDir });

		collector.recordOperation("test_tool", 100, true);
		collector.recordOperation("test_tool", 200, true);
		collector.recordOperation("test_tool", 300, false);

		const summary = collector.getSummary();
		expect(summary.totalOperations).toBe(3);
		expect(summary.successfulOperations).toBe(2);
		expect(summary.failedOperations).toBe(1);

		const metrics = summary.toolMetrics[0];
		expect(metrics?.count).toBe(3);
		expect(metrics?.avgDurationMs).toBe(200); // (100 + 200 + 300) / 3
		expect(metrics?.minDurationMs).toBe(100);
		expect(metrics?.maxDurationMs).toBe(300);
		expect(metrics?.errorCount).toBe(1);
		expect(metrics?.successRate).toBeCloseTo(66.67, 1);
	});

	test("collect parses JSONL logs correctly", async () => {
		// Create sample log file
		const logFile = join(tempDir, "test-plugin.jsonl");
		const logEntries = [
			{
				"@timestamp": "2025-12-06T10:00:00.000Z",
				level: "INFO",
				logger: "test-plugin.mcp",
				message: "MCP tool response",
				properties: {
					cid: "abc123",
					tool: "kit_index_find",
					durationMs: 15,
					success: true,
				},
			},
			{
				"@timestamp": "2025-12-06T10:00:01.000Z",
				level: "INFO",
				logger: "test-plugin.mcp",
				message: "MCP tool response",
				properties: {
					cid: "def456",
					tool: "kit_grep",
					durationMs: 234,
					success: true,
				},
			},
			{
				"@timestamp": "2025-12-06T10:00:02.000Z",
				level: "INFO",
				logger: "test-plugin.hook",
				message: "Hook completed",
				properties: {
					cid: "ghi789",
					hook: "biome-check",
					durationMs: 512,
					exitCode: 0,
				},
			},
		];

		writeFileSync(logFile, logEntries.map((e) => JSON.stringify(e)).join("\n"));

		const collector = new MetricsCollector({ logDir: tempDir });
		await collector.collect();

		const summary = collector.getSummary();
		expect(summary.totalOperations).toBe(3);
		expect(summary.successfulOperations).toBe(3);
		expect(summary.toolMetrics).toHaveLength(3);

		// Verify tool metrics
		const kitIndex = summary.toolMetrics.find(
			(m) => m.tool === "kit_index_find",
		);
		expect(kitIndex?.avgDurationMs).toBe(15);

		const kitGrep = summary.toolMetrics.find((m) => m.tool === "kit_grep");
		expect(kitGrep?.avgDurationMs).toBe(234);

		const biomeCheck = summary.toolMetrics.find(
			(m) => m.tool === "biome-check",
		);
		expect(biomeCheck?.avgDurationMs).toBe(512);
	});

	test("collect handles failures correctly", async () => {
		const logFile = join(tempDir, "test-plugin.jsonl");
		const logEntries = [
			{
				"@timestamp": "2025-12-06T10:00:00.000Z",
				level: "INFO",
				logger: "test-plugin.mcp",
				message: "MCP tool response",
				properties: {
					cid: "abc123",
					tool: "bun_runTests",
					durationMs: 2345,
					success: false,
				},
			},
			{
				"@timestamp": "2025-12-06T10:00:01.000Z",
				level: "INFO",
				logger: "test-plugin.mcp",
				message: "MCP tool response",
				properties: {
					cid: "def456",
					tool: "bun_runTests",
					durationMs: 1987,
					success: true,
				},
			},
		];

		writeFileSync(logFile, logEntries.map((e) => JSON.stringify(e)).join("\n"));

		const collector = new MetricsCollector({ logDir: tempDir });
		await collector.collect();

		const summary = collector.getSummary();
		expect(summary.totalOperations).toBe(2);
		expect(summary.successfulOperations).toBe(1);
		expect(summary.failedOperations).toBe(1);

		const metrics = summary.toolMetrics[0];
		expect(metrics?.errorCount).toBe(1);
		expect(metrics?.successRate).toBe(50);
	});

	test("getSummary generates correct rankings", () => {
		const collector = new MetricsCollector({ logDir: tempDir });

		// Add various tools with different characteristics
		collector.recordOperation("fast_tool", 10, true);
		collector.recordOperation("slow_tool", 5000, true);
		collector.recordOperation("popular_tool", 50, true);
		collector.recordOperation("popular_tool", 60, true);
		collector.recordOperation("popular_tool", 55, true);
		collector.recordOperation("error_prone", 100, false);
		collector.recordOperation("error_prone", 120, false);
		collector.recordOperation("error_prone", 110, true);

		const summary = collector.getSummary();

		// Slowest should include slow_tool
		expect(summary.slowest[0]?.tool).toBe("slow_tool");
		expect(summary.slowest[0]?.durationMs).toBe(5000);

		// Fastest should include fast_tool
		expect(summary.fastest[0]?.tool).toBe("fast_tool");
		expect(summary.fastest[0]?.durationMs).toBe(10);

		// Most used should include popular_tool
		expect(summary.mostUsed[0]?.tool).toBe("popular_tool");
		expect(summary.mostUsed[0]?.count).toBe(3);

		// Most problematic should include error_prone
		expect(summary.mostProblematic[0]?.tool).toBe("error_prone");
		expect(summary.mostProblematic[0]?.errorRate).toBeCloseTo(66.67, 1);
	});

	test("toMarkdown generates readable output", () => {
		const collector = new MetricsCollector({ logDir: tempDir });

		collector.recordOperation("kit_index_find", 15, true);
		collector.recordOperation("kit_grep", 234, true);
		collector.recordOperation("bun_runTests", 2345, false);

		const markdown = collector.toMarkdown();

		expect(markdown).toContain("📊 MCP Performance Metrics");
		expect(markdown).toContain("Total Operations: 3");
		expect(markdown).toContain("Successful: 2");
		expect(markdown).toContain("Failed: 1");
		expect(markdown).toContain("kit_index_find");
		expect(markdown).toContain("kit_grep");
		expect(markdown).toContain("bun_runTests");
		expect(markdown).toContain("Slowest Operations:");
		expect(markdown).toContain("Fastest Operations:");
		expect(markdown).toContain("Recommendations:");
	});

	test("includePlugins filter works", async () => {
		// Create multiple plugin log files
		const plugin1 = join(tempDir, "plugin1.jsonl");
		const plugin2 = join(tempDir, "plugin2.jsonl");

		writeFileSync(
			plugin1,
			JSON.stringify({
				"@timestamp": "2025-12-06T10:00:00.000Z",
				level: "INFO",
				logger: "plugin1",
				message: "MCP tool response",
				properties: { tool: "tool1", durationMs: 100, success: true },
			}),
		);

		writeFileSync(
			plugin2,
			JSON.stringify({
				"@timestamp": "2025-12-06T10:00:00.000Z",
				level: "INFO",
				logger: "plugin2",
				message: "MCP tool response",
				properties: { tool: "tool2", durationMs: 200, success: true },
			}),
		);

		const collector = new MetricsCollector({
			logDir: tempDir,
			includePlugins: ["plugin1"],
		});
		await collector.collect();

		const summary = collector.getSummary();
		expect(summary.totalOperations).toBe(1);
		expect(summary.toolMetrics[0]?.tool).toBe("tool1");
	});

	test("excludePlugins filter works", async () => {
		const plugin1 = join(tempDir, "plugin1.jsonl");
		const plugin2 = join(tempDir, "plugin2.jsonl");

		writeFileSync(
			plugin1,
			JSON.stringify({
				"@timestamp": "2025-12-06T10:00:00.000Z",
				level: "INFO",
				logger: "plugin1",
				message: "MCP tool response",
				properties: { tool: "tool1", durationMs: 100, success: true },
			}),
		);

		writeFileSync(
			plugin2,
			JSON.stringify({
				"@timestamp": "2025-12-06T10:00:00.000Z",
				level: "INFO",
				logger: "plugin2",
				message: "MCP tool response",
				properties: { tool: "tool2", durationMs: 200, success: true },
			}),
		);

		const collector = new MetricsCollector({
			logDir: tempDir,
			excludePlugins: ["plugin1"],
		});
		await collector.collect();

		const summary = collector.getSummary();
		expect(summary.totalOperations).toBe(1);
		expect(summary.toolMetrics[0]?.tool).toBe("tool2");
	});

	test("clear resets metrics", () => {
		const collector = new MetricsCollector({ logDir: tempDir });

		collector.recordOperation("test_tool", 100, true);
		expect(collector.getSummary().totalOperations).toBe(1);

		collector.clear();
		expect(collector.getSummary().totalOperations).toBe(0);
	});

	test("getGlobalMetricsCollector returns singleton", () => {
		const collector1 = getGlobalMetricsCollector();
		const collector2 = getGlobalMetricsCollector();

		expect(collector1).toBe(collector2);
	});

	test("handles missing durationMs gracefully", async () => {
		const logFile = join(tempDir, "test-plugin.jsonl");
		const logEntries = [
			{
				"@timestamp": "2025-12-06T10:00:00.000Z",
				level: "INFO",
				logger: "test-plugin",
				message: "MCP tool response",
				properties: {
					tool: "some_tool",
					// No durationMs
					success: true,
				},
			},
		];

		writeFileSync(logFile, logEntries.map((e) => JSON.stringify(e)).join("\n"));

		const collector = new MetricsCollector({ logDir: tempDir });
		await collector.collect();

		const summary = collector.getSummary();
		expect(summary.totalOperations).toBe(0); // Should skip entries without durationMs
	});

	test("handles malformed JSON lines gracefully", async () => {
		const logFile = join(tempDir, "test-plugin.jsonl");
		writeFileSync(
			logFile,
			`{"valid": "json"}\n{invalid json}\n{"another": "valid"}\n`,
		);

		const collector = new MetricsCollector({ logDir: tempDir });
		await collector.collect();

		// Should not throw, just skip malformed lines
		expect(() => collector.getSummary()).not.toThrow();
	});

	test("toJSON returns structured data", () => {
		const collector = new MetricsCollector({ logDir: tempDir });

		collector.recordOperation("test_tool", 100, true);

		const json = collector.toJSON();

		expect(json).toHaveProperty("totalOperations");
		expect(json).toHaveProperty("successfulOperations");
		expect(json).toHaveProperty("toolMetrics");
		expect(json).toHaveProperty("slowest");
		expect(json).toHaveProperty("fastest");
	});

	test("handles exitCode for hook completion", async () => {
		const logFile = join(tempDir, "test-plugin.jsonl");
		const logEntries = [
			{
				"@timestamp": "2025-12-06T10:00:00.000Z",
				level: "INFO",
				logger: "test-plugin",
				message: "Hook completed",
				properties: {
					hook: "test-hook",
					durationMs: 150,
					exitCode: 0,
				},
			},
			{
				"@timestamp": "2025-12-06T10:00:01.000Z",
				level: "INFO",
				logger: "test-plugin",
				message: "Hook completed",
				properties: {
					hook: "test-hook-2",
					durationMs: 200,
					exitCode: 2,
				},
			},
		];

		writeFileSync(logFile, logEntries.map((e) => JSON.stringify(e)).join("\n"));

		const collector = new MetricsCollector({ logDir: tempDir });
		await collector.collect();

		const summary = collector.getSummary();
		expect(summary.totalOperations).toBe(2);
		expect(summary.successfulOperations).toBe(1);
		expect(summary.failedOperations).toBe(1);
	});
});
