import { describe, expect, test } from "bun:test";
import { parseArgs } from "./utils/args.ts";
import { getStringFlag, parseTicketsFlag } from "./cli.ts";

describe("parseArgs", () => {
	test("parses spaced flags", () => {
		const result = parseArgs(["session", "--session-id", "42"]);
		expect(result.command).toBe("session");
		expect(result.flags["session-id"]).toBe("42");
	});

	test("parses equals-style flags", () => {
		const result = parseArgs(["ticket", "--session-id=123", "--dry-run"]);
		expect(result.flags["session-id"]).toBe("123");
		expect(result.flags["dry-run"]).toBe(true);
	});

	test("captures positional arguments", () => {
		const result = parseArgs(["movie", "extra", "--format", "json"]);
		expect(result.positional).toEqual(["extra"]);
		expect(result.flags.format).toBe("json");
	});
});

describe("getStringFlag", () => {
	test("returns undefined for boolean flags", () => {
		const flags = parseArgs(["ticket", "--dry-run"]).flags;
		expect(getStringFlag(flags, "dry-run")).toBeUndefined();
	});

	test("returns string values when present", () => {
		const flags = parseArgs(["ticket", "--session-id=abc"]).flags;
		expect(getStringFlag(flags, "session-id")).toBe("abc");
	});
});

describe("parseTicketsFlag", () => {
	test("parses valid ticket spec", () => {
		const tickets = parseTicketsFlag("ADULT:1,CHILD:2");
		expect(tickets).toEqual([
			{ type: "ADULT", quantity: 1 },
			{ type: "CHILD", quantity: 2 },
		]);
	});

	test("throws on invalid format", () => {
		expect(() => parseTicketsFlag("ADULT:foo")).toThrow(
			/Invalid ticket format/,
		);
	});

	test("throws on zero total tickets", () => {
		expect(() => parseTicketsFlag("ADULT:0")).toThrow(/at least one ticket/);
	});
});
