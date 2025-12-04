/**
 * Calls command - Find what a function calls (call graph dependencies)
 *
 * Note: Kit CLI's `dependencies` command only supports Python and Terraform.
 * For TypeScript/JavaScript call graphs, this would require AST-based
 * dependency analysis which is not currently supported.
 */

import { color, OutputFormat } from "../formatters/output";

/**
 * Execute calls command
 *
 * Shows what functions/modules are called by the target function.
 * Currently not implemented for TypeScript/JavaScript.
 *
 * @param functionName - Function name to analyze
 * @param format - Output format (markdown or JSON)
 */
export async function executeCalls(
	functionName: string,
	format: OutputFormat,
): Promise<void> {
	const errorMessage =
		"Call graph analysis is not currently supported for TypeScript/JavaScript.\n" +
		"Kit CLI's 'dependencies' command only supports Python and Terraform.\n\n" +
		"Alternatives:\n" +
		"  • Use /kit:blast to find where a function is called (reverse lookup)\n" +
		"  • Use kit_ast_search MCP tool to find function calls manually\n" +
		"  • Use kit_grep to search for function invocations";

	if (format === OutputFormat.JSON) {
		console.log(
			JSON.stringify(
				{
					error: errorMessage,
					isError: true,
					functionName,
					reason: "Kit dependencies command only supports Python/Terraform",
				},
				null,
				2,
			),
		);
	} else {
		console.log(color("yellow", `\n⚠️  ${errorMessage}\n`));
		console.log(
			color("dim", `Requested function: ${color("blue", functionName)}\n`),
		);
	}

	process.exit(1);
}
