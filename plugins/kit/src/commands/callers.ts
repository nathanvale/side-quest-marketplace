/**
 * Callers command - Find who calls a function
 *
 * Uses kit grep to find all call sites of a function, filtering out the
 * definition itself to show only actual usage locations.
 */

import { color, OutputFormat } from "../formatters/output";
import { executeKitGrep } from "../kit-wrapper";
import { findSymbol, loadProjectIndex } from "../utils/index-parser";

/**
 * Call site result - a location where the function is called
 */
interface CallSite {
	file: string;
	line: number;
	context: string;
}

/**
 * Result of callers search
 */
interface CallersResult {
	functionName: string;
	definitionFile?: string;
	definitionLine?: number;
	callSites: CallSite[];
	count: number;
}

/**
 * Format callers result as markdown
 *
 * @param result - Callers result to format
 * @returns Formatted markdown string
 */
function formatMarkdown(result: CallersResult): string {
	const { functionName, definitionFile, definitionLine, callSites, count } =
		result;

	if (count === 0) {
		return color(
			"yellow",
			`\n⚠️  No call sites found for function: ${functionName}\n`,
		);
	}

	let output = color("cyan", `\n📞 Found ${count} call site(s) for: `);
	output += color("blue", functionName);
	output += "\n\n";

	// Show definition location if available
	if (definitionFile && definitionLine) {
		output += color(
			"dim",
			`Definition: ${definitionFile}:${definitionLine}\n\n`,
		);
	}

	// Group by file
	const byFile = new Map<string, CallSite[]>();
	for (const callSite of callSites) {
		if (!byFile.has(callSite.file)) {
			byFile.set(callSite.file, []);
		}
		byFile.get(callSite.file)?.push(callSite);
	}

	// Output each file
	for (const [file, sites] of byFile.entries()) {
		output += color("dim", `${file}:\n`);
		for (const site of sites) {
			output += `  ${color("dim", `L${site.line}:`)} ${site.context.trim()}\n`;
		}
		output += "\n";
	}

	return output;
}

/**
 * Format callers result as JSON
 *
 * @param result - Callers result to format
 * @returns JSON string
 */
function formatJSON(result: CallersResult): string {
	return JSON.stringify(result, null, 2);
}

/**
 * Execute callers command
 *
 * Finds all locations where a function is called by:
 * 1. Looking up the function definition in PROJECT_INDEX.json
 * 2. Using kit grep to find all occurrences
 * 3. Filtering out the definition line to show only call sites
 *
 * @param functionName - Name of the function to find callers for
 * @param format - Output format (markdown or JSON)
 */
export async function executeCallers(
	functionName: string,
	format: OutputFormat,
): Promise<void> {
	try {
		// Find the function definition in the index
		let definitionFile: string | undefined;
		let definitionLine: number | undefined;

		try {
			const index = await loadProjectIndex();
			const definitions = findSymbol(index, functionName);

			// Use the first definition found (functions should be unique)
			const firstDef = definitions[0];
			if (firstDef) {
				definitionFile = firstDef.file;
				definitionLine = firstDef.symbol.start_line;
			}
		} catch {
			// Index not available - we'll proceed without filtering the definition
		}

		// Use kit grep to find all occurrences
		const grepResult = executeKitGrep({
			pattern: functionName,
			caseSensitive: true,
			maxResults: 500,
		});

		// Handle errors
		if ("error" in grepResult) {
			if (format === OutputFormat.JSON) {
				console.error(
					JSON.stringify(
						{
							error: grepResult.error,
							functionName,
							isError: true,
						},
						null,
						2,
					),
				);
			} else {
				console.error(color("red", "\n❌ Error:"), grepResult.error, "\n");
			}
			process.exit(1);
		}

		// Filter matches to exclude the definition line
		let matches = grepResult.matches;

		if (definitionFile && definitionLine) {
			matches = matches.filter(
				(match) =>
					!(match.file === definitionFile && match.line === definitionLine),
			);
		}

		// Filter out matches that look like definitions rather than calls
		// Heuristics:
		// - Lines starting with "function ", "const ", "let ", "var ", "export function"
		// - Lines with "= function" or "= (" (function assignments)
		// - Lines with "export async function" (exported async functions)
		matches = matches.filter((match) => {
			const trimmed = match.content.trim();
			const definitionPatterns = [
				/^function\s+/, // function declarations
				/^export\s+(async\s+)?function\s+/, // exported functions (sync or async)
				/^(const|let|var)\s+\w+\s*=\s*function/, // function expressions
				/^(const|let|var)\s+\w+\s*=\s*\(/, // arrow functions
				/^(const|let|var)\s+\w+\s*=\s*async\s*\(/, // async arrow functions
				/^async\s+function\s+/, // async function declarations
			];

			return !definitionPatterns.some((pattern) => pattern.test(trimmed));
		});

		// Convert to call sites
		const callSites: CallSite[] = matches.map((match) => ({
			file: match.file,
			line: match.line || 0,
			context: match.content,
		}));

		// Build result
		const result: CallersResult = {
			functionName,
			definitionFile,
			definitionLine,
			callSites,
			count: callSites.length,
		};

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
						functionName,
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
