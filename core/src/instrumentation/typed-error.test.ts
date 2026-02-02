import { describe, expect, test } from "bun:test";
import { PluginError } from "./typed-error";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Example error types for testing
 */
enum TestErrorType {
	ConfigNotFound = "ConfigNotFound",
	InvalidInput = "InvalidInput",
	Timeout = "Timeout",
}

/**
 * Example error messages for testing
 */
const TEST_ERROR_MESSAGES: Record<
	TestErrorType,
	{ message: string; hint: string }
> = {
	[TestErrorType.ConfigNotFound]: {
		message: "Configuration file not found.",
		hint: "Create a config.json file in the project root.",
	},
	[TestErrorType.InvalidInput]: {
		message: "Invalid input provided.",
		hint: "Check your input format and try again.",
	},
	[TestErrorType.Timeout]: {
		message: "Operation timed out.",
		hint: "Try again with a longer timeout.",
	},
};

/**
 * Example plugin error class for testing
 */
class TestPluginError extends PluginError<TestErrorType> {
	constructor(type: TestErrorType, details?: string, stderr?: string) {
		const errorInfo = TEST_ERROR_MESSAGES[type];
		super(
			"TestPluginError",
			type,
			errorInfo.message,
			errorInfo.hint,
			details,
			stderr,
		);
	}
}

// ============================================================================
// Tests
// ============================================================================

describe("PluginError", () => {
	describe("constructor", () => {
		test("creates error with required fields only", () => {
			const error = new TestPluginError(TestErrorType.ConfigNotFound);

			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(PluginError);
			expect(error.name).toBe("TestPluginError");
			expect(error.type).toBe(TestErrorType.ConfigNotFound);
			expect(error.userMessage).toBe("Configuration file not found.");
			expect(error.hint).toBe("Create a config.json file in the project root.");
			expect(error.details).toBeUndefined();
			expect(error.stderr).toBeUndefined();
		});

		test("creates error with details", () => {
			const error = new TestPluginError(
				TestErrorType.ConfigNotFound,
				"/path/to/config.json",
			);

			expect(error.details).toBe("/path/to/config.json");
			expect(error.message).toBe(
				"Configuration file not found.: /path/to/config.json",
			);
		});

		test("creates error with stderr", () => {
			const error = new TestPluginError(
				TestErrorType.Timeout,
				undefined,
				"ETIMEDOUT: operation timed out after 30s",
			);

			expect(error.stderr).toBe("ETIMEDOUT: operation timed out after 30s");
			expect(error.details).toBeUndefined();
		});

		test("creates error with both details and stderr", () => {
			const error = new TestPluginError(
				TestErrorType.InvalidInput,
				"malformed JSON",
				"SyntaxError: Unexpected token",
			);

			expect(error.details).toBe("malformed JSON");
			expect(error.stderr).toBe("SyntaxError: Unexpected token");
		});

		test("Error.message includes user message and details", () => {
			const error = new TestPluginError(
				TestErrorType.ConfigNotFound,
				"/missing/file",
			);

			expect(error.message).toContain("Configuration file not found.");
			expect(error.message).toContain("/missing/file");
		});

		test("Error.message excludes details colon when no details provided", () => {
			const error = new TestPluginError(TestErrorType.ConfigNotFound);

			expect(error.message).toBe("Configuration file not found.");
			expect(error.message).not.toContain(":");
		});
	});

	describe("toUserMessage()", () => {
		test("formats error without stderr", () => {
			const error = new TestPluginError(
				TestErrorType.ConfigNotFound,
				"/path/to/config.json",
			);
			const message = error.toUserMessage();

			expect(message).toContain("Error: Configuration file not found.");
			expect(message).toContain(
				"Hint: Create a config.json file in the project root.",
			);
			expect(message).not.toContain("Details:");
		});

		test("formats error with stderr", () => {
			const error = new TestPluginError(
				TestErrorType.Timeout,
				"search operation",
				"ETIMEDOUT: connection timeout after 30s",
			);
			const message = error.toUserMessage();

			expect(message).toContain(
				"Error: Operation timed out.: search operation",
			);
			expect(message).toContain("Hint: Try again with a longer timeout.");
			expect(message).toContain("Details:");
			expect(message).toContain("ETIMEDOUT: connection timeout after 30s");
		});

		test("includes blank lines for readability", () => {
			const error = new TestPluginError(
				TestErrorType.ConfigNotFound,
				"/path/to/config.json",
			);
			const message = error.toUserMessage();
			const lines = message.split("\n");

			// Should have: Error line, blank, Hint line
			expect(lines.length).toBeGreaterThanOrEqual(3);
			expect(lines[1]).toBe(""); // Blank line after error
		});

		test("includes Details section with stderr", () => {
			const error = new TestPluginError(
				TestErrorType.InvalidInput,
				undefined,
				"Parse error on line 5",
			);
			const message = error.toUserMessage();
			const lines = message.split("\n");

			// Should have: Error, blank, Hint, blank, Details label, stderr
			expect(lines.length).toBe(6);
			expect(lines[3]).toBe(""); // Blank line before Details
			expect(lines[4]).toBe("Details:");
			expect(lines[5]).toBe("Parse error on line 5");
		});
	});

	describe("toJSON()", () => {
		test("serializes error without details", () => {
			const error = new TestPluginError(TestErrorType.ConfigNotFound);
			const json = error.toJSON();

			expect(json).toEqual({
				error: "Configuration file not found.",
				type: TestErrorType.ConfigNotFound,
				hint: "Create a config.json file in the project root.",
			});
			expect(json).not.toHaveProperty("details");
		});

		test("serializes error with details", () => {
			const error = new TestPluginError(
				TestErrorType.Timeout,
				"took 45s to complete",
			);
			const json = error.toJSON();

			expect(json).toEqual({
				error: "Operation timed out.: took 45s to complete",
				type: TestErrorType.Timeout,
				hint: "Try again with a longer timeout.",
				details: "took 45s to complete",
			});
		});

		test("does not include stderr in JSON", () => {
			const error = new TestPluginError(
				TestErrorType.InvalidInput,
				"malformed data",
				"SyntaxError: Unexpected token",
			);
			const json = error.toJSON();

			expect(json).toHaveProperty("details", "malformed data");
			expect(json).not.toHaveProperty("stderr");
		});

		test("JSON is serializable to string", () => {
			const error = new TestPluginError(
				TestErrorType.ConfigNotFound,
				"/path/to/file",
			);
			const json = error.toJSON();
			const jsonString = JSON.stringify(json);

			expect(jsonString).toBeTruthy();
			expect(() => JSON.parse(jsonString)).not.toThrow();
		});
	});

	describe("Error prototype chain", () => {
		test("instanceof Error returns true", () => {
			const error = new TestPluginError(TestErrorType.ConfigNotFound);
			expect(error instanceof Error).toBe(true);
		});

		test("instanceof PluginError returns true", () => {
			const error = new TestPluginError(TestErrorType.ConfigNotFound);
			expect(error instanceof PluginError).toBe(true);
		});

		test("instanceof TestPluginError returns true", () => {
			const error = new TestPluginError(TestErrorType.ConfigNotFound);
			expect(error instanceof TestPluginError).toBe(true);
		});

		test("error.name is set correctly", () => {
			const error = new TestPluginError(TestErrorType.ConfigNotFound);
			expect(error.name).toBe("TestPluginError");
		});
	});

	describe("type safety", () => {
		test("type field has correct enum type", () => {
			const error = new TestPluginError(TestErrorType.ConfigNotFound);
			const type: TestErrorType = error.type;
			expect(type).toBe(TestErrorType.ConfigNotFound);
		});

		test("toJSON() type field has correct enum type", () => {
			const error = new TestPluginError(TestErrorType.Timeout);
			const json = error.toJSON();
			const type: TestErrorType = json.type;
			expect(type).toBe(TestErrorType.Timeout);
		});
	});

	describe("edge cases", () => {
		test("handles empty details string", () => {
			const error = new TestPluginError(TestErrorType.ConfigNotFound, "");
			expect(error.details).toBe("");
			// Empty string should not append colon and details
			expect(error.message).toBe("Configuration file not found.");
		});

		test("handles empty stderr string", () => {
			const error = new TestPluginError(TestErrorType.Timeout, undefined, "");
			expect(error.stderr).toBe("");
			const message = error.toUserMessage();
			// Empty stderr should not include Details section
			expect(message).not.toContain("Details:");
		});

		test("handles multiline stderr", () => {
			const stderr = "Error on line 1\nError on line 2\nError on line 3";
			const error = new TestPluginError(
				TestErrorType.InvalidInput,
				undefined,
				stderr,
			);
			const message = error.toUserMessage();
			expect(message).toContain("Error on line 1");
			expect(message).toContain("Error on line 2");
			expect(message).toContain("Error on line 3");
		});

		test("handles special characters in details", () => {
			const details = "File: /path/with spaces & special-chars!@#$%.json";
			const error = new TestPluginError(TestErrorType.ConfigNotFound, details);
			expect(error.details).toBe(details);
			expect(error.message).toContain(details);
		});
	});
});
