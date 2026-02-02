import { describe, expect, test } from "bun:test";
import {
	detectErrorFromOutput,
	type ErrorPattern,
	isCommandNotFoundOutput,
	isTimeoutOutput,
} from "./error-patterns.js";

describe("detectErrorFromOutput", () => {
	enum TestErrorType {
		NotFound = "NotFound",
		Timeout = "Timeout",
		Permission = "Permission",
		Validation = "Validation",
		CommandFailed = "CommandFailed",
	}

	const patterns: ErrorPattern<TestErrorType>[] = [
		{
			type: TestErrorType.NotFound,
			patterns: ["no such file", "not found", /ENOENT/i],
		},
		{
			type: TestErrorType.Timeout,
			patterns: ["timeout", "timed out", /ETIMEDOUT/i],
		},
		{
			type: TestErrorType.Permission,
			patterns: ["permission denied", /EACCES/i, "EPERM"],
		},
		{
			type: TestErrorType.Validation,
			patterns: ["invalid", "validation failed", /must be \w+/],
		},
	];

	test("detects not found errors with string pattern", () => {
		const result = detectErrorFromOutput(
			"Error: no such file or directory",
			patterns,
			TestErrorType.CommandFailed,
		);
		expect(result).toBe(TestErrorType.NotFound);
	});

	test("detects not found errors with regex pattern", () => {
		const result = detectErrorFromOutput(
			"Error: ENOENT: file not found",
			patterns,
			TestErrorType.CommandFailed,
		);
		expect(result).toBe(TestErrorType.NotFound);
	});

	test("detects timeout errors", () => {
		const result = detectErrorFromOutput(
			"Operation timed out after 30s",
			patterns,
			TestErrorType.CommandFailed,
		);
		expect(result).toBe(TestErrorType.Timeout);
	});

	test("detects permission errors with case-insensitive string pattern", () => {
		const result = detectErrorFromOutput(
			"Error: Permission Denied",
			patterns,
			TestErrorType.CommandFailed,
		);
		expect(result).toBe(TestErrorType.Permission);
	});

	test("detects permission errors with regex pattern", () => {
		const result = detectErrorFromOutput(
			"Error: EACCES: permission denied",
			patterns,
			TestErrorType.CommandFailed,
		);
		expect(result).toBe(TestErrorType.Permission);
	});

	test("detects validation errors with regex capture", () => {
		const result = detectErrorFromOutput(
			"Validation failed: must be string",
			patterns,
			TestErrorType.CommandFailed,
		);
		expect(result).toBe(TestErrorType.Validation);
	});

	test("returns default type when no patterns match", () => {
		const result = detectErrorFromOutput(
			"Unknown error occurred",
			patterns,
			TestErrorType.CommandFailed,
		);
		expect(result).toBe(TestErrorType.CommandFailed);
	});

	test("returns first matching pattern type", () => {
		// "not found" matches NotFound, but should return NotFound (first match)
		const result = detectErrorFromOutput(
			"File not found",
			patterns,
			TestErrorType.CommandFailed,
		);
		expect(result).toBe(TestErrorType.NotFound);
	});

	test("handles empty output", () => {
		const result = detectErrorFromOutput(
			"",
			patterns,
			TestErrorType.CommandFailed,
		);
		expect(result).toBe(TestErrorType.CommandFailed);
	});

	test("handles multiline output", () => {
		const output = `
Error occurred while processing file
ENOENT: no such file or directory
  at readFile (fs.js:123)
  at process (main.js:456)
`;
		const result = detectErrorFromOutput(
			output,
			patterns,
			TestErrorType.CommandFailed,
		);
		expect(result).toBe(TestErrorType.NotFound);
	});

	test("regex patterns respect their own flags", () => {
		// Case-sensitive regex should not match different case
		const caseSensitivePatterns: ErrorPattern<TestErrorType>[] = [
			{
				type: TestErrorType.NotFound,
				patterns: [/ENOENT/], // No 'i' flag
			},
		];

		// Should NOT match lowercase
		const noMatch = detectErrorFromOutput(
			"enoent: file not found",
			caseSensitivePatterns,
			TestErrorType.CommandFailed,
		);
		expect(noMatch).toBe(TestErrorType.CommandFailed);

		// Should match uppercase
		const match = detectErrorFromOutput(
			"ENOENT: file not found",
			caseSensitivePatterns,
			TestErrorType.CommandFailed,
		);
		expect(match).toBe(TestErrorType.NotFound);
	});

	test("string patterns are case-insensitive", () => {
		const output = "ERROR: NO SUCH FILE FOUND";
		const result = detectErrorFromOutput(
			output,
			patterns,
			TestErrorType.CommandFailed,
		);
		expect(result).toBe(TestErrorType.NotFound);
	});

	test("handles patterns with special regex characters in strings", () => {
		const specialPatterns: ErrorPattern<TestErrorType>[] = [
			{
				type: TestErrorType.NotFound,
				patterns: ["[error]", "(not found)"], // Special chars treated as literals
			},
		];

		const result = detectErrorFromOutput(
			"Output: [error] file (not found)",
			specialPatterns,
			TestErrorType.CommandFailed,
		);
		expect(result).toBe(TestErrorType.NotFound);
	});
});

describe("isTimeoutOutput", () => {
	test("detects 'timeout' keyword", () => {
		expect(isTimeoutOutput("Operation timeout")).toBe(true);
	});

	test("detects 'timed out' phrase", () => {
		expect(isTimeoutOutput("Request timed out after 30s")).toBe(true);
	});

	test("detects ETIMEDOUT error code", () => {
		expect(isTimeoutOutput("Error: ETIMEDOUT: connection timeout")).toBe(true);
	});

	test("is case-insensitive", () => {
		expect(isTimeoutOutput("ERROR: TIMEOUT OCCURRED")).toBe(true);
		expect(isTimeoutOutput("ERROR: TIMED OUT")).toBe(true);
		expect(isTimeoutOutput("ERROR: ETimedOut")).toBe(true);
	});

	test("returns false for non-timeout errors", () => {
		expect(isTimeoutOutput("File not found")).toBe(false);
		expect(isTimeoutOutput("Permission denied")).toBe(false);
		expect(isTimeoutOutput("")).toBe(false);
	});

	test("handles multiline output", () => {
		const output = `
Error: Network request failed
ETIMEDOUT: connection timeout
  at fetch (http.js:123)
`;
		expect(isTimeoutOutput(output)).toBe(true);
	});

	test("does not match partial words", () => {
		// "timeout" should match as substring, not whole word
		expect(isTimeoutOutput("operation_timeout_ms=30000")).toBe(true);
	});
});

describe("isCommandNotFoundOutput", () => {
	test("detects bash 'command not found'", () => {
		expect(isCommandNotFoundOutput("bash: kit: command not found")).toBe(true);
	});

	test("detects Windows 'not recognized'", () => {
		expect(
			isCommandNotFoundOutput("'kit' is not recognized as an internal command"),
		).toBe(true);
	});

	test("detects 'no such file' for binary", () => {
		expect(
			isCommandNotFoundOutput(
				"Error: ENOENT: no such file or directory, spawn kit",
			),
		).toBe(true);
	});

	test("detects 'cannot find' pattern", () => {
		expect(isCommandNotFoundOutput("Cannot find executable: kit")).toBe(true);
	});

	test("is case-insensitive", () => {
		expect(isCommandNotFoundOutput("COMMAND NOT FOUND")).toBe(true);
		expect(isCommandNotFoundOutput("NOT RECOGNIZED")).toBe(true);
		expect(isCommandNotFoundOutput("CANNOT FIND")).toBe(true);
	});

	test("returns false for other errors", () => {
		expect(isCommandNotFoundOutput("Permission denied")).toBe(false);
		expect(isCommandNotFoundOutput("Timeout occurred")).toBe(false);
		expect(isCommandNotFoundOutput("")).toBe(false);
	});

	test("'no such file' matches on its own", () => {
		// "no such file" is a common pattern for missing executables
		expect(
			isCommandNotFoundOutput("Error: ENOENT: no such file or directory"),
		).toBe(true);
	});

	test("generic 'not found' without command context doesn't match", () => {
		// Generic "not found" without command/file context should not match
		// to avoid false positives for other types of "not found" errors
		expect(isCommandNotFoundOutput("File not found")).toBe(false);
		expect(isCommandNotFoundOutput("Record not found in database")).toBe(false);
	});

	test("handles multiline output", () => {
		const output = `
Error: spawn kit ENOENT
  at Process.ChildProcess._handle.onexit (internal/child_process.js:269:19)
  at onErrorNT (internal/child_process.js:465:16)
bash: kit: command not found
`;
		expect(isCommandNotFoundOutput(output)).toBe(true);
	});
});
