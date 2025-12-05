/**
 * Bun test output parsing utilities
 *
 * Extracted to a separate file to allow testing without importing mcpez
 */

export interface TestFailure {
	file: string;
	message: string;
	line?: number;
	stack?: string;
}

export interface TestSummary {
	passed: number;
	failed: number;
	total: number;
	failures: TestFailure[];
}

/**
 * Parse bun test output to extract test results
 */
export function parseBunTestOutput(output: string): TestSummary {
	const failures: TestFailure[] = [];
	const lines = output.split("\n");
	let currentFailure: TestFailure | null = null;
	let currentTestName: string | undefined;

	for (const line of lines) {
		if (!line) continue;

		// Bun v1.3+ format: "(fail) test name [0.21ms]" marks end of failure block
		// Extract test name and finalize the failure
		const failMatch = line.match(/\(fail\)\s+(.+?)\s+\[/);
		if (failMatch) {
			if (currentFailure) {
				// Use the test name from (fail) line as the primary identifier
				currentTestName = failMatch[1];
				currentFailure.message = `${currentTestName}: ${currentFailure.message}`;
				failures.push(currentFailure);
				currentFailure = null;
			}
			continue;
		}

		// Legacy format: "✗ test name" or "FAIL file" marks start of failure
		if (line.includes("✗") || line.startsWith("FAIL ")) {
			if (currentFailure) failures.push(currentFailure);
			currentFailure = {
				file: "unknown",
				message: line.trim(),
			};
			continue;
		}

		// "error:" line starts a new failure block in Bun v1.3+ format
		// But if we already have a failure from FAIL/✗, append to it instead
		if (line.trim().startsWith("error:")) {
			if (currentFailure) {
				// Append error to existing failure (legacy FAIL format)
				currentFailure.message += `\n${line.trim()}`;
			} else {
				// Start new failure block (Bun v1.3+ format)
				currentFailure = {
					file: "unknown",
					message: line.trim(),
				};
			}
			continue;
		}

		// Capture content for current failure
		if (currentFailure) {
			// Stack trace line - extract file/line info
			if (line.trim().startsWith("at ")) {
				const match =
					line.match(/\((.+):(\d+):(\d+)\)/) ||
					line.match(/at (.+):(\d+):(\d+)/);
				if (match?.[1] && match[2]) {
					currentFailure.file = match[1];
					currentFailure.line = Number.parseInt(match[2], 10);
				}
				currentFailure.stack = `${currentFailure.stack || ""}${line}\n`;
			} else if (line.trim() && !line.match(/^\d+ \| /)) {
				// Append to message (skip source code lines like "3 | test(...)")
				currentFailure.message += `\n${line.trim()}`;
			}
		}
	}
	if (currentFailure) failures.push(currentFailure);

	// Parse summary numbers
	const passMatch = output.match(/(\d+) pass/);
	const failMatchNum = output.match(/(\d+) fail/);

	const passed = passMatch?.[1] ? Number.parseInt(passMatch[1], 10) : 0;
	const failed = failMatchNum?.[1]
		? Number.parseInt(failMatchNum[1], 10)
		: failures.length;

	return {
		passed,
		failed,
		total: passed + failed,
		failures,
	};
}
