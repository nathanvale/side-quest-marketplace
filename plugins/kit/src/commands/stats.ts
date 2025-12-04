/**
 * Stats command - Codebase health metrics
 */

import { color, OutputFormat } from "../formatters/output";
import {
	getComplexityHotspots,
	getSymbolTypeDistribution,
	loadProjectIndex,
} from "../utils/index-parser";

export async function executeStats(format: OutputFormat): Promise<void> {
	try {
		const index = await loadProjectIndex();
		const distribution = getSymbolTypeDistribution(index);
		const hotspots = getComplexityHotspots(index, 5);

		const totalFiles = Object.keys(index.symbols).length;
		const totalSymbols = Object.values(distribution).reduce(
			(sum, count) => sum + count,
			0,
		);

		if (format === OutputFormat.JSON) {
			console.log(
				JSON.stringify(
					{ totalFiles, totalSymbols, distribution, hotspots },
					null,
					2,
				),
			);
		} else {
			console.log(color("cyan", "\n📊 Codebase Statistics\n"));
			console.log(color("dim", `Files: ${totalFiles}`));
			console.log(color("dim", `Total Symbols: ${totalSymbols}\n`));

			console.log(color("magenta", "Symbol Distribution:"));
			for (const [type, count] of Object.entries(distribution)) {
				console.log(
					`  ${color("dim", "•")} ${type}: ${color("blue", count.toString())}`,
				);
			}

			console.log(`\n${color("magenta", "Complexity Hotspots:")}`);
			for (const { directory, symbolCount } of hotspots) {
				console.log(
					`  ${color("dim", "•")} ${directory}: ${color("blue", symbolCount.toString())} symbols`,
				);
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
