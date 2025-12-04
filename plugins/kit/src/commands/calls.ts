/**
 * Calls command - Find what a function calls (stub implementation)
 */

import { color, OutputFormat } from "../formatters/output";

export async function executeCalls(
	functionName: string,
	format: OutputFormat,
): Promise<void> {
	if (format === OutputFormat.JSON) {
		console.log(
			JSON.stringify(
				{ message: "Calls command not yet implemented", functionName },
				null,
				2,
			),
		);
	} else {
		console.log(
			color(
				"yellow",
				`\n⚠️  Calls command not yet implemented for: ${functionName}\n`,
			),
		);
	}
}
