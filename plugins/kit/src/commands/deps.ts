/**
 * Deps command - Show import/export relationships for a file
 *
 * Note: Kit CLI's `dependencies` command only supports Python and Terraform.
 * For TypeScript/JavaScript import/export analysis, this would require
 * AST-based parsing which is not currently supported by Kit.
 */

import { color, OutputFormat } from "../formatters/output";

/**
 * Execute deps command
 *
 * Shows import and export relationships for a specific file.
 * Currently not implemented for TypeScript/JavaScript.
 *
 * @param file - File path to analyze
 * @param format - Output format (markdown or JSON)
 */
export async function executeDeps(
	file: string,
	format: OutputFormat,
): Promise<void> {
	const errorMessage =
		"Import/export analysis is not currently supported for TypeScript/JavaScript.\n" +
		"Kit CLI's 'dependencies' command only supports Python and Terraform.\n\n" +
		"Alternatives:\n" +
		"  • Use kit_ast_search MCP tool to find import statements\n" +
		"  • Use kit_grep to search for 'import.*from' patterns\n" +
		"  • Use kit_symbols to see exported symbols in a file\n" +
		"  • Manually inspect the file with kit_file_content";

	if (format === OutputFormat.JSON) {
		console.log(
			JSON.stringify(
				{
					error: errorMessage,
					isError: true,
					file,
					reason: "Kit dependencies command only supports Python/Terraform",
				},
				null,
				2,
			),
		);
	} else {
		console.log(color("yellow", `\n⚠️  ${errorMessage}\n`));
		console.log(color("dim", `Requested file: ${color("blue", file)}\n`));
	}

	process.exit(1);
}
