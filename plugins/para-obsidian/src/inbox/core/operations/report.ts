/**
 * Report generation for inbox processing.
 *
 * Generates markdown reports summarizing inbox suggestions.
 *
 * @module inbox/core/operations/report
 */

import {
	type InboxSuggestion,
	isCreateNoteSuggestion,
	isMoveSuggestion,
} from "../../types";

/**
 * Generate a markdown report of suggestions.
 *
 * @param suggestions - Suggestions to include in report
 * @param vaultPath - Absolute path to vault root
 * @returns Markdown formatted report
 */
export function generateReport(
	suggestions: InboxSuggestion[],
	vaultPath: string,
): string {
	const lines: string[] = [
		"# Inbox Processing Report",
		"",
		`Generated: ${new Date().toISOString()}`,
		`Vault: ${vaultPath}`,
		"",
	];

	if (suggestions.length === 0) {
		lines.push("No suggestions to report.");
		return lines.join("\n");
	}

	// Group by confidence
	const byConfidence = {
		high: suggestions.filter((s) => s.confidence === "high"),
		medium: suggestions.filter((s) => s.confidence === "medium"),
		low: suggestions.filter((s) => s.confidence === "low"),
	};

	lines.push("## Summary");
	lines.push("");
	lines.push(`- Total suggestions: ${suggestions.length}`);
	lines.push(`- High confidence: ${byConfidence.high.length}`);
	lines.push(`- Medium confidence: ${byConfidence.medium.length}`);
	lines.push(`- Low confidence: ${byConfidence.low.length}`);
	lines.push("");

	lines.push("## Suggestions");
	lines.push("");

	for (const suggestion of suggestions) {
		const filename = suggestion.source.split("/").pop() ?? suggestion.source;
		lines.push(`### ${filename}`);
		lines.push("");
		lines.push(`- **Action:** ${suggestion.action}`);
		lines.push(`- **Confidence:** ${suggestion.confidence}`);
		lines.push(`- **Processor:** ${suggestion.processor}`);
		if (isCreateNoteSuggestion(suggestion) && suggestion.suggestedTitle) {
			lines.push(`- **Suggested Title:** ${suggestion.suggestedTitle}`);
		}
		if (
			(isCreateNoteSuggestion(suggestion) || isMoveSuggestion(suggestion)) &&
			suggestion.suggestedDestination
		) {
			lines.push(
				`- **Suggested Destination:** ${suggestion.suggestedDestination}`,
			);
		}
		lines.push(`- **Reason:** ${suggestion.reason}`);
		lines.push("");
	}

	return lines.join("\n");
}
