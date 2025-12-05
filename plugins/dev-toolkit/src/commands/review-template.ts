import { color } from "@sidequest/core/formatters";
import type { OutputFormat } from "@sidequest/core/formatters";
import { existsSync, readFileSync } from "node:fs";

/**
 * Review a CLI template against the Bun CLI standard
 *
 * Checks for:
 * - Argument parsing (three flag formats)
 * - Usage output (colored, scannable)
 * - Output formatting (markdown + JSON)
 * - Error handling (contextual messages, exit codes)
 * - Test coverage (argument parsing tests)
 * - Documentation (CLAUDE.md)
 */
export async function reviewTemplateCommand(
	path: string,
	format: OutputFormat,
): Promise<void> {
	// Check if file exists
	if (!existsSync(path)) {
		throw new Error(`File not found: ${path}`);
	}

	// Read the file
	const content = readFileSync(path, "utf-8");

	// Run checks
	const checks = {
		hasShebang: content.startsWith("#!/usr/bin/env bun"),
		hasParseArgs: content.includes("parseArgs"),
		hasOutputFormat:
			content.includes("parseOutputFormat") || content.includes("--format"),
		hasPrintUsage: content.includes("printUsage"),
		hasErrorHandling: content.includes("console.error") && content.includes("process.exit"),
		hasTryCatch: content.includes("try {") && content.includes("catch (error)"),
		hasColorOutput: content.includes("color("),
		hasMainFunction: content.includes("async function main") || content.includes("function main"),
	};

	// Calculate score
	const checksPassed = Object.values(checks).filter(Boolean).length;
	const totalChecks = Object.keys(checks).length;
	const score = Math.round((checksPassed / totalChecks) * 10);

	// Generate report
	if (format === "json") {
		console.log(
			JSON.stringify(
				{
					path,
					score: `${score}/10`,
					checksPassed,
					totalChecks,
					checks,
					status: score >= 7 ? "passing" : "needs-work",
				},
				null,
				2,
			),
		);
	} else {
		console.log(color("cyan", "CLI Template Review\n"));
		console.log(`${color("cyan", "File:")} ${path}`);
		console.log(`${color("cyan", "Score:")} ${score}/10\n`);

		console.log(color("cyan", "Checks:"));
		Object.entries(checks).forEach(([check, passed]) => {
			const icon = passed ? "✅" : "❌";
			const name = check
				.replace(/([A-Z])/g, " $1")
				.replace(/^./, (str) => str.toUpperCase());
			console.log(`  ${icon} ${name}`);
		});

		console.log("\n" + color("cyan", "Recommendations:"));
		if (!checks.hasShebang) {
			console.log("  - Add shebang: #!/usr/bin/env bun");
		}
		if (!checks.hasParseArgs) {
			console.log("  - Import parseArgs from @sidequest/core/cli");
		}
		if (!checks.hasOutputFormat) {
			console.log("  - Add --format md|json support");
		}
		if (!checks.hasPrintUsage) {
			console.log("  - Create printUsage() function");
		}
		if (!checks.hasErrorHandling) {
			console.log("  - Add console.error() for errors and process.exit(1)");
		}
		if (!checks.hasTryCatch) {
			console.log("  - Wrap main logic in try/catch");
		}
		if (!checks.hasColorOutput) {
			console.log("  - Add colored output with color() from @sidequest/core/formatters");
		}
		if (!checks.hasMainFunction) {
			console.log("  - Create main() async function");
		}

		if (checksPassed === totalChecks) {
			console.log("  ✅ All checks passing! Your CLI follows the standard.");
		}

		console.log("\n" + color("cyan", "References:"));
		console.log("  - Bun CLI Development: skills/bun-cli/SKILL.md");
		console.log("  - CLI Patterns: skills/bun-cli/references/bun-cli-patterns.md");
		console.log("  - Para Obsidian Example: plugins/para-obsidian/CLAUDE.md");
	}
}
