#!/usr/bin/env bun

/**
 * Stop Hook - Performance Metrics Summary
 *
 * Outputs MCP tool performance metrics at session end.
 * Aggregates all logged durationMs values from ~/.claude/logs/*.jsonl
 */

import { getGlobalMetricsCollector } from "@sidequest/core/logging";

async function main() {
	const collector = getGlobalMetricsCollector();

	// Collect metrics from all plugin logs
	await collector.collect();

	const summary = collector.getSummary();

	// Only output if we have data
	if (summary.totalOperations > 0) {
		console.log("\n" + collector.toMarkdown());
	}

	process.exit(0);
}

main();
