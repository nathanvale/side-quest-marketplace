/**
 * API command - List module public API (stub implementation)
 */

import { color, OutputFormat } from "../formatters/output";

export async function executeApi(
	directory: string,
	format: OutputFormat,
): Promise<void> {
	if (format === OutputFormat.JSON) {
		console.log(
			JSON.stringify(
				{ message: "API command not yet implemented", directory },
				null,
				2,
			),
		);
	} else {
		console.log(
			color(
				"yellow",
				`\n⚠️  API command not yet implemented for: ${directory}\n`,
			),
		);
	}
}
