import { describe, expect, test } from "bun:test";
import {
	coerceValue,
	normalizeFlags,
	normalizeFlagValue,
	parseArgOverrides,
	parseArgs,
	parseCommaSeparatedList,
	parseDirs,
	parseKeyValuePairs,
} from "./index";

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

	// Duplicate flag handling
	test("single flag returns string", () => {
		const result = parseArgs(["--arg", "value"]);
		expect(result.flags.arg).toBe("value");
	});

	test("duplicate flags return array", () => {
		const result = parseArgs(["--arg", "first", "--arg", "second"]);
		expect(result.flags.arg).toEqual(["first", "second"]);
	});

	test("duplicate boolean flags become array", () => {
		const result = parseArgs(["--force", "--force"]);
		expect(result.flags.force).toEqual([true, true]);
	});

	test("mixed single and duplicate flags", () => {
		const result = parseArgs([
			"--single",
			"value",
			"--multi",
			"a",
			"--multi",
			"b",
		]);
		expect(result.flags.single).toBe("value");
		expect(result.flags.multi).toEqual(["a", "b"]);
	});

	test("equals syntax duplicate flags", () => {
		const result = parseArgs(["--arg=first", "--arg=second"]);
		expect(result.flags.arg).toEqual(["first", "second"]);
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

	test("splits single-word comma-separated values into array", () => {
		expect(coerceValue("a,b,c")).toEqual(["a", "b", "c"]);
		expect(coerceValue("tag1, tag2, tag3")).toEqual(["tag1", "tag2", "tag3"]);
	});

	test("keeps prose strings with commas as strings", () => {
		expect(
			coerceValue(
				"Official docs covering auth methods, model routing, and config",
			),
		).toBe("Official docs covering auth methods, model routing, and config");
		expect(
			coerceValue("Active bug where auth fails, three workarounds documented"),
		).toBe("Active bug where auth fails, three workarounds documented");
	});

	test("splits wikilink lists into arrays", () => {
		expect(coerceValue("[[Area 1]], [[Area 2]]")).toEqual([
			"[[Area 1]]",
			"[[Area 2]]",
		]);
	});
});

describe("parseDirs", () => {
	test("parses comma-separated directories", () => {
		expect(parseDirs("01_Projects,02_Areas")).toEqual([
			"01_Projects",
			"02_Areas",
		]);
	});

	test("trims whitespace from directory names", () => {
		expect(parseDirs("Projects, Areas , Resources")).toEqual([
			"Projects",
			"Areas",
			"Resources",
		]);
	});

	test("filters empty strings", () => {
		expect(parseDirs("Projects,,Areas")).toEqual(["Projects", "Areas"]);
	});

	test("returns defaults for boolean true", () => {
		expect(parseDirs(true, ["default"])).toEqual(["default"]);
	});

	test("returns defaults for undefined", () => {
		expect(parseDirs(undefined, ["default"])).toEqual(["default"]);
	});

	test("returns undefined when no defaults provided", () => {
		expect(parseDirs(true)).toBeUndefined();
		expect(parseDirs(undefined)).toBeUndefined();
	});

	test("handles single directory", () => {
		expect(parseDirs("Projects")).toEqual(["Projects"]);
	});
});

describe("parseArgOverrides", () => {
	test("parses single string with key=value", () => {
		expect(parseArgOverrides("priority=high")).toEqual({ priority: "high" });
	});

	test("parses array of key=value pairs", () => {
		expect(parseArgOverrides(["priority=high", "area=[[Work]]"])).toEqual({
			priority: "high",
			area: "[[Work]]",
		});
	});

	test("handles values containing equals signs", () => {
		expect(parseArgOverrides("url=https://example.com?a=b")).toEqual({
			url: "https://example.com?a=b",
		});
	});

	test("filters out non-string values from arrays", () => {
		expect(parseArgOverrides(["priority=high", true])).toEqual({
			priority: "high",
		});
	});

	test("returns empty object for boolean true", () => {
		expect(parseArgOverrides(true)).toEqual({});
	});

	test("returns empty object for undefined", () => {
		expect(parseArgOverrides(undefined)).toEqual({});
	});

	test("skips malformed args without equals sign", () => {
		expect(parseArgOverrides(["priority=high", "malformed"])).toEqual({
			priority: "high",
		});
	});

	test("skips args with empty key", () => {
		expect(parseArgOverrides(["=value", "area=[[Work]]"])).toEqual({
			area: "[[Work]]",
		});
	});

	test("skips args with empty value", () => {
		expect(parseArgOverrides(["key=", "area=[[Work]]"])).toEqual({
			area: "[[Work]]",
		});
	});

	test("handles empty array", () => {
		expect(parseArgOverrides([])).toEqual({});
	});

	test("handles complex values with multiple equals", () => {
		expect(
			parseArgOverrides([
				"formula=a=b+c",
				"url=https://example.com?x=1&y=2",
				"title=My Project",
			]),
		).toEqual({
			formula: "a=b+c",
			url: "https://example.com?x=1&y=2",
			title: "My Project",
		});
	});

	test("preserves wikilink formatting", () => {
		expect(
			parseArgOverrides([
				"area=[[Work/Projects]]",
				"project=[[Active Projects]]",
			]),
		).toEqual({
			area: "[[Work/Projects]]",
			project: "[[Active Projects]]",
		});
	});
});

describe("normalizeFlagValue", () => {
	test("returns single value unchanged", () => {
		expect(normalizeFlagValue("test")).toBe("test");
		expect(normalizeFlagValue(true)).toBe(true);
		expect(normalizeFlagValue(false)).toBe(false);
	});

	test("returns first element of array", () => {
		expect(normalizeFlagValue(["first", "second"])).toBe("first");
		expect(normalizeFlagValue([true, false])).toBe(true);
	});

	test("returns undefined for undefined", () => {
		expect(normalizeFlagValue(undefined)).toBeUndefined();
	});

	test("returns undefined for empty array", () => {
		expect(normalizeFlagValue([])).toBeUndefined();
	});
});

describe("normalizeFlags", () => {
	test("normalizes all flags", () => {
		const flags = {
			single: "value",
			array: ["first", "second"],
			bool: true,
		};
		const result = normalizeFlags(flags);
		expect(result).toEqual({
			single: "value",
			array: "first",
			bool: true,
		});
	});

	test("removes undefined values", () => {
		const flags: Record<string, string | boolean | (string | boolean)[]> = {
			present: "value",
		};
		const result = normalizeFlags(flags);
		expect(result).toEqual({ present: "value" });
	});

	test("handles mixed flag types", () => {
		const flags = {
			string: "value",
			bool: true,
			arrayStr: ["a", "b"],
			arrayBool: [false, true],
		};
		const result = normalizeFlags(flags);
		expect(result).toEqual({
			string: "value",
			bool: true,
			arrayStr: "a",
			arrayBool: false,
		});
	});

	test("handles empty record", () => {
		expect(normalizeFlags({})).toEqual({});
	});
});

describe("parseCommaSeparatedList", () => {
	test("parses comma-separated values", () => {
		expect(parseCommaSeparatedList("a,b,c")).toEqual(["a", "b", "c"]);
	});

	test("trims whitespace", () => {
		expect(parseCommaSeparatedList(" a , b , c ")).toEqual(["a", "b", "c"]);
	});

	test("filters empty strings", () => {
		expect(parseCommaSeparatedList("a,,b")).toEqual(["a", "b"]);
		expect(parseCommaSeparatedList("a, , b")).toEqual(["a", "b"]);
	});

	test("returns empty array for non-string", () => {
		expect(parseCommaSeparatedList(true)).toEqual([]);
		expect(parseCommaSeparatedList(undefined)).toEqual([]);
	});

	test("handles single value", () => {
		expect(parseCommaSeparatedList("single")).toEqual(["single"]);
	});

	test("handles empty string", () => {
		expect(parseCommaSeparatedList("")).toEqual([]);
	});
});
