/**
 * Dead command - Find unused exports (stub implementation)
 */

import { color, OutputFormat } from "../formatters/output";

export async function executeDead(
	path: string | undefined,
	format: OutputFormat,
): Promise<void> {
	if (format === OutputFormat.JSON) {
		console.log(
			JSON.stringify(
				{ message: "Dead command not yet implemented", path: path || "." },
				null,
				2,
			),
		);
	} else {
		console.log(
			color(
				"yellow",
				`\n⚠️  Dead command not yet implemented for: ${path || "."}\n`,
			),
		);
	}
}
