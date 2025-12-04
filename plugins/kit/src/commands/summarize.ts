/**
 * Summarize command - Generate PR summary using Kit CLI
 *
 * Uses kit summarize to analyze GitHub PR changes and generate a concise summary.
 * Can optionally update the PR description with the generated summary.
 */

import { color, OutputFormat } from "../formatters/output";
import { executeKitSummarize } from "../kit-wrapper";

/**
 * Format summarize result as markdown
 *
 * @param result - Summarize result to format
 * @returns Formatted markdown string
 */
function formatMarkdown(result: {
	prUrl: string;
	summary: string;
	updated: boolean;
	model?: string;
}): string {
	const { prUrl, summary, updated, model } = result;

	let output = color("cyan", "\n📋 PR Summary: ");
	output += color("blue", prUrl);
	output += "\n\n";

	// Show the summary
	output += summary;
	output += "\n\n";

	// Show metadata
	output += color("dim", "---\n");
	output += color("dim", `PR description updated: ${updated ? "Yes" : "No"}\n`);
	if (model) {
		output += color("dim", `Model used: ${model}\n`);
	}

	return output;
}

/**
 * Format summarize result as JSON
 *
 * @param result - Summarize result to format
 * @returns JSON string
 */
function formatJSON(result: {
	prUrl: string;
	summary: string;
	updated: boolean;
	model?: string;
}): string {
	return JSON.stringify(result, null, 2);
}

/**
 * Execute summarize command
 *
 * Generates a summary for a GitHub PR using the Kit CLI.
 *
 * @param prUrl - GitHub PR URL (https://github.com/owner/repo/pull/123)
 * @param updatePrBody - Whether to update PR description with summary (default: false)
 * @param model - Optional LLM model override
 * @param format - Output format (markdown or JSON)
 */
export async function executeSummarize(
	prUrl: string,
	updatePrBody: boolean,
	model: string | undefined,
	format: OutputFormat,
): Promise<void> {
	try {
		// Execute kit summarize
		const result = executeKitSummarize({
			prUrl,
			updatePrBody,
			model,
		});

		// Handle errors
		if ("error" in result) {
			if (format === OutputFormat.JSON) {
				console.error(
					JSON.stringify(
						{
							error: result.error,
							prUrl,
							isError: true,
						},
						null,
						2,
					),
				);
			} else {
				console.error(color("red", "\n❌ Error:"), result.error, "\n");
			}
			process.exit(1);
		}

		// Output results
		if (format === OutputFormat.JSON) {
			console.log(formatJSON(result));
		} else {
			console.log(formatMarkdown(result));
		}
	} catch (error) {
		if (format === OutputFormat.JSON) {
			console.error(
				JSON.stringify(
					{
						error: error instanceof Error ? error.message : "Unknown error",
						prUrl,
						isError: true,
					},
					null,
					2,
				),
			);
		} else {
			console.error(
				color("red", "\n❌ Error:"),
				error instanceof Error ? error.message : error,
				"\n",
			);
		}
		process.exit(1);
	}
}
