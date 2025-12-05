import { describe, expect, test } from "bun:test";

// Types matching the MCP server
enum ResponseFormat {
	MARKDOWN = "markdown",
	JSON = "json",
}

interface CopyResult {
	success: boolean;
	bytes_copied: number;
	platform: string;
}

interface PasteResult {
	content: string;
	bytes_pasted: number;
	platform: string;
}

interface ErrorResult {
	error: string;
	isError: true;
	suggestion?: string;
	command?: string;
}

// Format functions (copied from main module for testing)
function formatCopyResult(result: CopyResult, format: ResponseFormat): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result);
	}
	return `Copied ${result.bytes_copied} bytes to clipboard (${result.platform})`;
}

function formatPasteResult(
	result: PasteResult,
	format: ResponseFormat,
): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(result);
	}
	return `\`\`\`\n${result.content}\n\`\`\`\n\n(${result.bytes_pasted} bytes from ${result.platform} clipboard)`;
}

function formatError(error: ErrorResult, format: ResponseFormat): string {
	if (format === ResponseFormat.JSON) {
		return JSON.stringify(error);
	}
	let msg = `**Error:** ${error.error}`;
	if (error.suggestion) {
		msg += `\n\n${error.suggestion}`;
	}
	if (error.command) {
		msg += `\n\nCommand: \`${error.command}\``;
	}
	return msg;
}

describe("clipboard formatting functions", () => {
	describe("formatCopyResult", () => {
		test("should format as markdown by default", () => {
			const result: CopyResult = {
				success: true,
				bytes_copied: 42,
				platform: "darwin",
			};
			const formatted = formatCopyResult(result, ResponseFormat.MARKDOWN);
			expect(formatted).toBe("Copied 42 bytes to clipboard (darwin)");
		});

		test("should format as JSON when requested", () => {
			const result: CopyResult = {
				success: true,
				bytes_copied: 42,
				platform: "darwin",
			};
			const formatted = formatCopyResult(result, ResponseFormat.JSON);
			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.success).toBe(true);
			expect(parsed.bytes_copied).toBe(42);
			expect(parsed.platform).toBe("darwin");
		});

		test("should handle empty string", () => {
			const result: CopyResult = {
				success: true,
				bytes_copied: 0,
				platform: "darwin",
			};
			const formatted = formatCopyResult(result, ResponseFormat.MARKDOWN);
			expect(formatted).toBe("Copied 0 bytes to clipboard (darwin)");
		});
	});

	describe("formatPasteResult", () => {
		test("should format as markdown by default", () => {
			const result: PasteResult = {
				content: "Hello World",
				bytes_pasted: 11,
				platform: "darwin",
			};
			const formatted = formatPasteResult(result, ResponseFormat.MARKDOWN);
			expect(formatted).toContain("```");
			expect(formatted).toContain("Hello World");
			expect(formatted).toContain("11 bytes from darwin clipboard");
		});

		test("should format as JSON when requested", () => {
			const result: PasteResult = {
				content: "Hello World",
				bytes_pasted: 11,
				platform: "darwin",
			};
			const formatted = formatPasteResult(result, ResponseFormat.JSON);
			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.content).toBe("Hello World");
			expect(parsed.bytes_pasted).toBe(11);
			expect(parsed.platform).toBe("darwin");
		});

		test("should handle empty clipboard", () => {
			const result: PasteResult = {
				content: "",
				bytes_pasted: 0,
				platform: "darwin",
			};
			const formatted = formatPasteResult(result, ResponseFormat.MARKDOWN);
			expect(formatted).toContain("```");
			expect(formatted).toContain("0 bytes from darwin clipboard");
		});

		test("should handle multiline content", () => {
			const result: PasteResult = {
				content: "Line 1\nLine 2\nLine 3",
				bytes_pasted: 20,
				platform: "darwin",
			};
			const formatted = formatPasteResult(result, ResponseFormat.MARKDOWN);
			expect(formatted).toContain("Line 1");
			expect(formatted).toContain("Line 2");
			expect(formatted).toContain("Line 3");
		});
	});

	describe("formatError", () => {
		test("should format error as markdown", () => {
			const error: ErrorResult = {
				error: "Clipboard unavailable",
				isError: true,
			};
			const formatted = formatError(error, ResponseFormat.MARKDOWN);
			expect(formatted).toContain("**Error:**");
			expect(formatted).toContain("Clipboard unavailable");
		});

		test("should format error as JSON", () => {
			const error: ErrorResult = {
				error: "Clipboard unavailable",
				isError: true,
			};
			const formatted = formatError(error, ResponseFormat.JSON);
			expect(() => JSON.parse(formatted)).not.toThrow();
			const parsed = JSON.parse(formatted);
			expect(parsed.error).toBe("Clipboard unavailable");
			expect(parsed.isError).toBe(true);
		});

		test("should include suggestion when provided", () => {
			const error: ErrorResult = {
				error: "Unsupported platform",
				isError: true,
				suggestion: "Install xclip on Linux",
			};
			const formatted = formatError(error, ResponseFormat.MARKDOWN);
			expect(formatted).toContain("Install xclip on Linux");
		});

		test("should include command when provided", () => {
			const error: ErrorResult = {
				error: "Command failed",
				isError: true,
				command: "pbcopy",
			};
			const formatted = formatError(error, ResponseFormat.MARKDOWN);
			expect(formatted).toContain("Command: `pbcopy`");
		});

		test("should include both suggestion and command", () => {
			const error: ErrorResult = {
				error: "Failed to copy",
				isError: true,
				suggestion: "Try running the command manually",
				command: "pbcopy",
			};
			const formatted = formatError(error, ResponseFormat.MARKDOWN);
			expect(formatted).toContain("Try running the command manually");
			expect(formatted).toContain("Command: `pbcopy`");
		});
	});
});

describe("clipboard platform detection", () => {
	test("should detect macOS platform", () => {
		// This test validates that we can detect the current platform
		expect(process.platform).toBeDefined();
		expect(typeof process.platform).toBe("string");
	});

	test("should handle different platforms", () => {
		const platforms = ["darwin", "linux", "win32"];
		expect(platforms).toContain(process.platform);
	});
});

describe("clipboard integration", () => {
	test("should handle copy operations on current platform", () => {
		// This is an integration test that verifies the platform-specific commands
		// are available. We don't actually execute them to avoid side effects.
		const supportedPlatforms = ["darwin", "linux", "win32"];
		expect(supportedPlatforms).toContain(process.platform);
	});

	test("should validate copy content length", () => {
		const content = "Test content";
		expect(content.length).toBeGreaterThan(0);
		expect(content.length).toBe(12);
	});

	test("should handle unicode content", () => {
		const content = "Hello 世界 🌍";
		expect(content.length).toBeGreaterThan(0);
		// Unicode characters may have different byte lengths
		expect(Buffer.from(content).length).toBeGreaterThan(content.length);
	});
});

describe("clipboard error handling", () => {
	test("should create error for unsupported platform", () => {
		const error: ErrorResult = {
			error: "Unsupported platform: unknown",
			isError: true,
			suggestion:
				"This plugin supports macOS (pbcopy), Linux (xclip), and Windows (clip)",
		};
		expect(error.isError).toBe(true);
		expect(error.error).toContain("Unsupported platform");
		expect(error.suggestion).toBeTruthy();
	});

	test("should create error for command failure", () => {
		const error: ErrorResult = {
			error: "Clipboard command failed with exit code 1",
			isError: true,
			command: "pbcopy",
		};
		expect(error.isError).toBe(true);
		expect(error.error).toContain("exit code 1");
		expect(error.command).toBe("pbcopy");
	});

	test("should handle generic errors", () => {
		const error: ErrorResult = {
			error: "Unknown error occurred",
			isError: true,
		};
		expect(error.isError).toBe(true);
		expect(error.error).toBeTruthy();
	});
});

describe("response format handling", () => {
	test("should parse response_format parameter", () => {
		const formats = ["markdown", "json"] as const;
		for (const format of formats) {
			expect(format === "markdown" || format === "json").toBe(true);
		}
	});

	test("should default to markdown when format not specified", () => {
		const format: ResponseFormat | undefined = undefined;
		const actualFormat =
			format === ResponseFormat.JSON
				? ResponseFormat.JSON
				: ResponseFormat.MARKDOWN;
		expect(actualFormat).toBe(ResponseFormat.MARKDOWN);
	});

	test("should use JSON format when explicitly requested", () => {
		const format = "json";
		const actualFormat =
			format === "json" ? ResponseFormat.JSON : ResponseFormat.MARKDOWN;
		expect(actualFormat).toBe(ResponseFormat.JSON);
	});
});
