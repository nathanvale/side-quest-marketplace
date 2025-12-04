/**
 * Callers command - Find who calls a function (stub implementation)
 */

import { color, OutputFormat } from "../formatters/output";

export async function executeCallers(
	functionName: string,
	format: OutputFormat,
): Promise<void> {
	if (format === OutputFormat.JSON) {
		console.log(
			JSON.stringify(
				{ message: "Callers command not yet implemented", functionName },
				null,
				2,
			),
		);
	} else {
		console.log(
			color(
				"yellow",
				`\n⚠️  Callers command not yet implemented for: ${functionName}\n`,
			),
		);
	}
}
