import { describe, expect, test } from "bun:test";

import {
	coerceValue,
	parseArgs,
	parseKeyValuePairs,
} from "@sidequest/core/cli";

describe("parseArgs", () => {
	test("parses command and positional args", () => {
		const result = parseArgs(["config", "--format", "json"]);
		expect(result.command).toBe("config");
		expect(result.positional).toEqual([]);
	});

	test("parses command with subcommand", () => {
		const result = parseArgs(["frontmatter", "get", "file.md"]);
		expect(result.command).toBe("frontmatter");
		expect(result.subcommand).toBe("get");
		expect(result.positional).toEqual(["file.md"]);
	});

	test("parses --flag value (spaced) format", () => {
		const result = parseArgs(["config", "--format", "json"]);
		expect(result.flags.format).toBe("json");
	});

	test("parses --flag=value (equals) format", () => {
		const result = parseArgs(["config", "--format=json"]);
		expect(result.flags.format).toBe("json");
	});

	test("parses boolean flags", () => {
		const result = parseArgs(["delete", "file.md", "--confirm"]);
		expect(result.flags.confirm).toBe(true);
	});

	test("handles mixed flag formats", () => {
		const result = parseArgs([
			"frontmatter",
			"migrate",
			"file.md",
			"--force",
			"2",
			"--dry-run",
		]);
		expect(result.command).toBe("frontmatter");
		expect(result.subcommand).toBe("migrate");
		expect(result.positional).toEqual(["file.md"]);
		expect(result.flags.force).toBe("2");
		expect(result.flags["dry-run"]).toBe(true);
	});

	test("handles flags with values containing spaces", () => {
		const result = parseArgs(["create", "--title", "My Project"]);
		expect(result.flags.title).toBe("My Project");
	});

	test("handles multiple positional args with flags", () => {
		const result = parseArgs([
			"frontmatter",
			"migrate-all",
			"--type",
			"project",
			"--dry-run",
		]);
		expect(result.command).toBe("frontmatter");
		expect(result.subcommand).toBe("migrate-all");
		expect(result.flags.type).toBe("project");
		expect(result.flags["dry-run"]).toBe(true);
	});

	test("handles empty args", () => {
		const result = parseArgs([]);
		expect(result.command).toBe("");
		expect(result.positional).toEqual([]);
		expect(result.flags).toEqual({});
	});

	test("handles flag at start", () => {
		const result = parseArgs(["--format", "json", "config"]);
		expect(result.flags.format).toBe("json");
		expect(result.command).toBe("config");
	});

	test("handles flag at end without value", () => {
		const result = parseArgs(["delete", "--confirm"]);
		expect(result.command).toBe("delete");
		expect(result.flags.confirm).toBe(true);
	});

	test("stops consuming args when next flag starts with --", () => {
		const result = parseArgs([
			"search",
			"query",
			"--format",
			"json",
			"--regex",
		]);
		expect(result.flags.format).toBe("json");
		expect(result.flags.regex).toBe(true);
	});
});

describe("parseKeyValuePairs", () => {
	test("parses simple key=value pairs", () => {
		const result = parseKeyValuePairs(["title=My Project", "status=active"]);
		expect(result).toEqual({ title: "My Project", status: "active" });
	});

	test("handles values containing equals signs", () => {
		const result = parseKeyValuePairs(["expression=a=b+c"]);
		expect(result).toEqual({ expression: "a=b+c" });
	});

	test("trims whitespace from keys and values", () => {
		const result = parseKeyValuePairs([" title = My Project "]);
		expect(result).toEqual({ title: "My Project" });
	});

	test("skips invalid pairs (no equals or empty key)", () => {
		const result = parseKeyValuePairs([
			"validKey=value",
			"invalidNoEquals",
			"=emptyKey",
		]);
		expect(result).toEqual({ validKey: "value" });
	});

	test("handles empty array", () => {
		const result = parseKeyValuePairs([]);
		expect(result).toEqual({});
	});
});

describe("coerceValue", () => {
	test("converts 'true' to boolean true", () => {
		expect(coerceValue("true")).toBe(true);
	});

	test("converts 'false' to boolean false", () => {
		expect(coerceValue("false")).toBe(false);
	});

	test("converts numeric strings to numbers", () => {
		expect(coerceValue("123")).toBe(123);
		expect(coerceValue("-456")).toBe(-456);
		expect(coerceValue("3.14")).toBe(3.14);
		expect(coerceValue("-2.5")).toBe(-2.5);
	});

	test("parses JSON arrays", () => {
		const result = coerceValue("[1, 2, 3]");
		expect(result).toEqual([1, 2, 3]);
	});

	test("parses JSON objects", () => {
		const result = coerceValue('{"key": "value"}');
		expect(result).toEqual({ key: "value" });
	});

	test("parses quoted JSON strings", () => {
		const result = coerceValue('"hello"');
		expect(result).toBe("hello");
	});

	test("splits comma-separated values into array", () => {
		const result = coerceValue("a,b,c");
		expect(result).toEqual(["a", "b", "c"]);
	});

	test("trims comma-separated values", () => {
		const result = coerceValue("a, b , c");
		expect(result).toEqual(["a", "b", "c"]);
	});

	test("handles invalid JSON gracefully (falls through)", () => {
		const result = coerceValue("[invalid");
		// Invalid JSON "[invalid" doesn't contain comma so returns as string
		expect(result).toBe("[invalid");
	});

	test("returns plain strings unchanged", () => {
		expect(coerceValue("hello")).toBe("hello");
		expect(coerceValue("some text")).toBe("some text");
	});

	test("handles empty string", () => {
		expect(coerceValue("")).toBe("");
	});

	test("handles whitespace-only string", () => {
		expect(coerceValue("   ")).toBe("");
	});
});
