#!/usr/bin/env bun

/**
 * Stop hook: Session Performance Summary
 *
 * Emits a summary of para-obsidian MCP tool performance metrics
 * when the Claude session ends. Uses MetricsCollector to aggregate
 * durationMs from log entries.
 */

import { MetricsCollector } from "@sidequest/core/logging";

async function main(): Promise<void> {
	const collector = new MetricsCollector({
		includePlugins: ["para-obsidian"],
	});

	await collector.collect();
	const summary = collector.getSummary();

	// Only output if there were operations
	if (summary.totalOperations === 0) {
		return;
	}

	console.log("\n📊 Para-Obsidian Session Summary");
	console.log("─".repeat(40));
	console.log(`Total operations: ${summary.totalOperations}`);
	console.log(
		`Success rate: ${summary.overallSuccessRate.toFixed(1)}% (${summary.successfulOperations}/${summary.totalOperations})`,
	);
	console.log(`Total time: ${(summary.totalDurationMs / 1000).toFixed(2)}s`);

	if (summary.mostUsed.length > 0) {
		console.log("\nMost used tools:");
		for (const { tool, count } of summary.mostUsed.slice(0, 3)) {
			console.log(`  • ${tool}: ${count} calls`);
		}
	}

	if (summary.slowest.length > 0) {
		console.log("\nSlowest operations:");
		for (const { tool, durationMs } of summary.slowest.slice(0, 3)) {
			console.log(`  • ${tool}: ${(durationMs / 1000).toFixed(2)}s`);
		}
	}

	if (summary.mostProblematic.length > 0) {
		console.log("\n⚠️  Tools with errors:");
		for (const { tool, errorCount, errorRate } of summary.mostProblematic) {
			console.log(
				`  • ${tool}: ${errorCount} errors (${errorRate.toFixed(1)}%)`,
			);
		}
	}

	console.log("─".repeat(40));
}

main().catch(console.error);
