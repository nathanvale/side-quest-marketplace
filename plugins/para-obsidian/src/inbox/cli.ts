#!/usr/bin/env bun
import { createSpinner } from "nanospinner";
import {
	displayResults,
	formatSuggestionsTable,
	runInteractiveLoop,
} from "./cli-adapter";
/**
 * Interactive inbox processor CLI.
 *
 * Usage: bun run src/inbox/cli.ts
 *
 * Requires PARA_VAULT environment variable to be set.
 */
import { createInboxEngine } from "./engine";
import type { InboxSuggestion } from "./types";

async function main() {
	const vaultPath = process.env.PARA_VAULT;

	if (!vaultPath) {
		console.error("Error: PARA_VAULT environment variable is not set.");
		console.error("Set it to your Obsidian vault path and try again.");
		process.exit(1);
	}

	console.log(`\n📥 Inbox Processor`);
	console.log(`   Vault: ${vaultPath}\n`);

	const engine = createInboxEngine({
		vaultPath,
		inboxFolder: "00 Inbox",
		attachmentsFolder: "Attachments",
		templatesFolder: "Templates",
	});

	const scanSpinner = createSpinner("Scanning inbox...").start();
	const scanStarted = Date.now();
	let suggestions: InboxSuggestion[];
	const scanState = {
		total: 0,
		processed: 0,
		skipped: 0,
		errors: 0,
		currentFile: "",
		stage: "hash" as "hash" | "extract" | "llm" | "skip" | "done" | "error",
		stageStartedAt: Date.now(),
	};
	const stageLabel = (stage: string): string => {
		switch (stage) {
			case "hash":
				return "hashing";
			case "extract":
				return "extracting";
			case "llm":
				return "LLM";
			case "skip":
				return "skipped";
			case "done":
				return "done";
			case "error":
				return "error";
			default:
				return stage;
		}
	};
	const updateScanText = () => {
		const elapsedStage = (
			(Date.now() - scanState.stageStartedAt) /
			1000
		).toFixed(1);
		const totals = `Scanning ${scanState.processed}/${scanState.total || "?"} (skipped ${scanState.skipped}, errors ${scanState.errors})`;
		const detail =
			scanState.currentFile === ""
				? ""
				: ` | ${scanState.currentFile} ${stageLabel(scanState.stage)} ${elapsedStage}s`;
		scanSpinner.update({ text: `${totals}${detail}` });
	};
	const scanTicker = setInterval(updateScanText, 500);
	try {
		suggestions = await engine.scan({
			onProgress: ({ total, filename, stage, error }) => {
				scanState.total = total;
				if (stage === "skip") {
					scanState.skipped += 1;
					scanState.processed += 1;
				} else if (stage === "done") {
					scanState.processed += 1;
				} else if (stage === "error") {
					scanState.errors += 1;
					scanState.processed += 1;
				} else {
					scanState.currentFile = filename;
					scanState.stage = stage;
					scanState.stageStartedAt = Date.now();
				}
				if (error) {
					scanSpinner.update({
						text: `Scanning ${scanState.processed}/${scanState.total || "?"} (skipped ${scanState.skipped}, errors ${scanState.errors + 1}) | ${filename} error - ${error}`,
					});
					return;
				}
				updateScanText();
			},
		});
		clearInterval(scanTicker);
		const elapsed = ((Date.now() - scanStarted) / 1000).toFixed(1);
		scanSpinner.success({
			text: `Scan complete (${scanState.processed}/${scanState.total || suggestions.length} scanned, skipped ${scanState.skipped}, errors ${scanState.errors}) in ${elapsed}s`,
		});
	} catch (error) {
		clearInterval(scanTicker);
		scanSpinner.error({
			text: `Scan failed: ${error instanceof Error ? error.message : "unknown error"}`,
		});
		throw error;
	}

	if (suggestions.length === 0) {
		console.log("✨ Inbox is empty - nothing to process!\n");
		return;
	}

	console.log(formatSuggestionsTable(suggestions));

	const approvedIds = await runInteractiveLoop({ engine, suggestions });

	if (approvedIds.length > 0) {
		const execSpinner = createSpinner(
			`Executing ${approvedIds.length} approved item(s)...`,
		).start();
		const execStarted = Date.now();
		const results = await engine.execute(approvedIds, {
			onProgress: ({ processed, total, suggestionId, success, error }) => {
				const status = success ? "✓" : "✗";
				const detail = error ? ` - ${error}` : "";
				execSpinner.update({
					text: `${status} ${processed}/${total} ${suggestionId}${detail}`,
				});
				console.log(`${status} ${processed}/${total} ${suggestionId}${detail}`);
			},
		});
		const elapsed = ((Date.now() - execStarted) / 1000).toFixed(1);
		execSpinner.success({
			text: `Executed ${results.length} item(s) in ${elapsed}s`,
		});
		displayResults(results);
	} else {
		console.log("\nNo items approved for processing.\n");
	}
}

main().catch((error) => {
	console.error("Error:", error.message);
	process.exit(1);
});
