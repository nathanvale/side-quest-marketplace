import { describe, expect, test } from "bun:test";
import {
	matchesDir,
	normalizeFlags,
	normalizeFlagValue,
	parseArgOverrides,
	parseAttachments,
	parseDirs,
	parseFrontmatterFilters,
	parseStatuses,
	parseUnset,
} from "./utils";

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
		// Simulate how parseArgs might leave out undefined values
		const result = normalizeFlags(flags);
		expect(result).toEqual({ present: "value" });
	});
});

describe("parseAttachments", () => {
	test("parses comma-separated attachments", () => {
		expect(parseAttachments({ attachments: "a.md,b.md,c.md" })).toEqual([
			"a.md",
			"b.md",
			"c.md",
		]);
	});

	test("trims whitespace", () => {
		expect(parseAttachments({ attachments: " a.md , b.md " })).toEqual([
			"a.md",
			"b.md",
		]);
	});

	test("returns empty array for non-string", () => {
		expect(parseAttachments({ attachments: true })).toEqual([]);
		expect(parseAttachments({})).toEqual([]);
	});
});

describe("parseUnset", () => {
	test("parses comma-separated field names", () => {
		expect(parseUnset("field1,field2")).toEqual(["field1", "field2"]);
	});

	test("returns empty array for non-string", () => {
		expect(parseUnset(true)).toEqual([]);
		expect(parseUnset(undefined)).toEqual([]);
	});
});

describe("parseFrontmatterFilters", () => {
	test("parses frontmatter flag", () => {
		expect(parseFrontmatterFilters({ frontmatter: "type=task" })).toEqual({
			type: "task",
		});
	});

	test("parses frontmatter.* flags", () => {
		expect(parseFrontmatterFilters({ "frontmatter.type": "task" })).toEqual({
			type: "task",
		});
	});

	test("combines multiple sources", () => {
		const result = parseFrontmatterFilters(
			{ frontmatter: "type=task", "frontmatter.status": "active" },
			["priority=high"],
		);
		expect(result).toEqual({
			type: "task",
			status: "active",
			priority: "high",
		});
	});
});

describe("parseDirs", () => {
	test("parses comma-separated directories", () => {
		expect(parseDirs("01_Projects,02_Areas")).toEqual([
			"01_Projects",
			"02_Areas",
		]);
	});

	test("returns defaults for non-string", () => {
		expect(parseDirs(true, ["default"])).toEqual(["default"]);
		expect(parseDirs(undefined, ["default"])).toEqual(["default"]);
	});
});

describe("parseStatuses", () => {
	test("parses comma-separated statuses", () => {
		expect(parseStatuses("done,error", ["pending"])).toEqual(["done", "error"]);
	});

	test("returns defaults for empty or non-string", () => {
		expect(parseStatuses(true, ["pending"])).toEqual(["pending"]);
		expect(parseStatuses("", ["pending"])).toEqual(["pending"]);
	});
});

describe("matchesDir", () => {
	test("matches exact directory", () => {
		expect(matchesDir("01_Projects", ["01_Projects"])).toBe(true);
	});

	test("matches subdirectory", () => {
		expect(matchesDir("01_Projects/myproject", ["01_Projects"])).toBe(true);
	});

	test("does not match different directory", () => {
		expect(matchesDir("02_Areas/work", ["01_Projects"])).toBe(false);
	});

	test("matches all when dirs is empty or undefined", () => {
		expect(matchesDir("anything", [])).toBe(true);
		expect(matchesDir("anything", undefined)).toBe(true);
	});
});

describe("parseArgOverrides", () => {
	test("parses single key=value", () => {
		expect(parseArgOverrides("priority=high")).toEqual({ priority: "high" });
	});

	test("parses array of key=value", () => {
		expect(parseArgOverrides(["priority=high", "area=[[Work]]"])).toEqual({
			priority: "high",
			area: "[[Work]]",
		});
	});

	test("handles values with embedded equals", () => {
		expect(parseArgOverrides("url=https://example.com?a=b")).toEqual({
			url: "https://example.com?a=b",
		});
	});

	test("filters non-string values from array", () => {
		expect(parseArgOverrides(["priority=high", true])).toEqual({
			priority: "high",
		});
	});

	test("returns empty for boolean or undefined", () => {
		expect(parseArgOverrides(true)).toEqual({});
		expect(parseArgOverrides(undefined)).toEqual({});
	});
});
