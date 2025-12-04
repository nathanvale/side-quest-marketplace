/**
 * Overview command - List all symbols in a file
 */

import { color, OutputFormat } from "../formatters/output";
import {
	getFileSymbols,
	type Symbol as IndexSymbol,
	loadProjectIndex,
} from "../utils/index-parser";

export async function executeOverview(
	file: string,
	format: OutputFormat,
): Promise<void> {
	try {
		const index = await loadProjectIndex();
		const symbols = getFileSymbols(index, file);

		if (symbols.length === 0) {
			if (format === OutputFormat.JSON) {
				console.log(JSON.stringify({ file, symbols: [] }, null, 2));
			} else {
				console.log(color("yellow", `\n⚠️  No symbols found in: ${file}\n`));
			}
			return;
		}

		if (format === OutputFormat.JSON) {
			console.log(
				JSON.stringify({ file, count: symbols.length, symbols }, null, 2),
			);
		} else {
			// Group by type
			const grouped = symbols.reduce(
				(acc, sym) => {
					if (!acc[sym.type]) acc[sym.type] = [];
					acc[sym.type]?.push(sym);
					return acc;
				},
				{} as Record<string, IndexSymbol[]>,
			);

			console.log(color("cyan", `\n📄 ${file}\n`));
			console.log(color("dim", `Total symbols: ${symbols.length}\n`));

			for (const [type, syms] of Object.entries(grouped)) {
				console.log(color("magenta", `${type}s:`));
				for (const sym of syms) {
					console.log(
						`  ${color("dim", "•")} ${color("blue", sym.name)} ${color("dim", `(line ${sym.start_line})`)}`,
					);
				}
				console.log("");
			}
		}
	} catch (error) {
		console.error(
			format === OutputFormat.JSON
				? JSON.stringify(
						{
							error: error instanceof Error ? error.message : "Unknown error",
							isError: true,
						},
						null,
						2,
					)
				: color("red", "\n❌ Error:") +
						` ${error instanceof Error ? error.message : error}`,
		);
		process.exit(1);
	}
}
