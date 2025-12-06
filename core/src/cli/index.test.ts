import { describe, expect, test } from "bun:test";
import { parseArgs } from "./index";

describe("parseArgs - duplicate flag handling", () => {
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
