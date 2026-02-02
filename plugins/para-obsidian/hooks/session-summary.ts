#!/usr/bin/env bun

/**
 * Stop hook: Session Performance Summary
 *
 * Emits a summary of para-obsidian MCP tool performance metrics
 * when the Claude session ends. Uses MetricsCollector to aggregate
 * durationMs from log entries. Also checks SLO breaches.
 */

import { MetricsCollector } from "@side-quest/core/logging";
import {
	checkSLOBreach,
	recordSLOEvent,
	type SLOBreachResult,
} from "../src/inbox/shared/slos";

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

	// Check SLO breaches
	const breaches: Array<{ name: string; result: SLOBreachResult }> = [];

	// Check scan_latency SLO (use slowest scan operation)
	const scanOps = summary.slowest.filter((op) => op.tool.includes("scanInbox"));
	const slowestScan = scanOps[0];
	if (slowestScan) {
		const scanSLO = await checkSLOBreach(
			"scan_latency",
			slowestScan.durationMs,
		);
		recordSLOEvent("scan_latency", scanSLO.breached, slowestScan.durationMs);
		if (scanSLO.breached) {
			breaches.push({ name: "scan_latency", result: scanSLO });
		}
	}

	// Check execute_success SLO (use overall success rate)
	const executeSLO = await checkSLOBreach(
		"execute_success",
		summary.overallSuccessRate,
	);
	recordSLOEvent(
		"execute_success",
		executeSLO.breached,
		summary.overallSuccessRate,
	);
	if (executeSLO.breached) {
		breaches.push({ name: "execute_success", result: executeSLO });
	}

	// Display SLO breaches if any
	if (breaches.length > 0) {
		console.log("\n🚨 SLO Breaches:");
		for (const { name: _name, result } of breaches) {
			const unit = result.slo.unit === "ms" ? "ms" : "%";
			console.log(
				`  • ${result.slo.name}: ${result.currentValue.toFixed(1)}${unit} (threshold: ${result.slo.threshold}${unit})`,
			);
			console.log(
				`    Burn rate: ${result.burnRate.toFixed(2)}, Error budget: ${(result.slo.errorBudget * 100).toFixed(1)}%`,
			);
		}
	}

	console.log("─".repeat(40));
}

main().catch(console.error);
