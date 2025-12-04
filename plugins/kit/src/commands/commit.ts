/**
 * Commit command - Generate AI commit messages
 *
 * Uses kit commit to generate intelligent commit messages from staged changes.
 */

import { spawnSync } from "node:child_process";
import { color, OutputFormat } from "../formatters/output";

/**
 * Execute commit command
 *
 * @param dryRun - Show message without committing (default: true for safety)
 * @param model - Optional LLM model override
 * @param format - Output format (markdown or JSON)
 */
export async function executeCommit(
	dryRun: boolean,
	model: string | undefined,
	format: OutputFormat,
): Promise<void> {
	try {
		// Build kit commit args
		const args: string[] = ["commit"];

		if (dryRun) {
			args.push("--dry-run");
		}

		if (model) {
			args.push("--model", model);
		}

		// Execute kit commit
		const result = spawnSync("kit", args, {
			encoding: "utf-8",
			timeout: 60000,
			cwd: process.cwd(),
		});

		// Handle errors
		if (result.error) {
			const errorMessage =
				result.error.message || "Failed to execute kit commit";
			if (format === OutputFormat.JSON) {
				console.error(
					JSON.stringify(
						{
							error: errorMessage,
							isError: true,
							dryRun,
							model,
						},
						null,
						2,
					),
				);
			} else {
				console.error(color("red", "\n❌ Error:"), errorMessage, "\n");
			}
			process.exit(1);
		}

		if (result.status !== 0) {
			if (format === OutputFormat.JSON) {
				console.error(
					JSON.stringify(
						{
							error: result.stderr || "Kit commit failed",
							isError: true,
							exitCode: result.status,
							dryRun,
							model,
						},
						null,
						2,
					),
				);
			} else {
				console.error(
					color("red", "\n❌ Kit commit failed:\n"),
					result.stderr || "Unknown error",
					"\n",
				);
			}
			process.exit(1);
		}

		// Success - format output
		const output = result.stdout.trim();

		if (format === OutputFormat.JSON) {
			console.log(
				JSON.stringify(
					{
						success: true,
						message: output,
						committed: !dryRun,
						dryRun,
						model,
					},
					null,
					2,
				),
			);
		} else {
			if (dryRun) {
				console.log(
					color("cyan", "\n📝 Generated commit message (dry run):\n"),
				);
				console.log(output);
				console.log(
					color(
						"dim",
						"\n💡 Run without --dry-run to commit with this message",
					),
				);
			} else {
				console.log(color("green", "\n✅ Committed successfully:\n"));
				console.log(output);
			}
			console.log();
		}
	} catch (error) {
		if (format === OutputFormat.JSON) {
			console.error(
				JSON.stringify(
					{
						error: error instanceof Error ? error.message : "Unknown error",
						isError: true,
						dryRun,
						model,
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
