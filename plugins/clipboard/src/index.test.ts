import { describe, expect, test } from "bun:test";
import { PLUGIN_NAME, PLUGIN_VERSION } from "./index";

describe("clipboard plugin", () => {
	test("exports plugin metadata", () => {
		expect(PLUGIN_NAME).toBe("clipboard");
		expect(PLUGIN_VERSION).toBe("1.0.0");
	});
});
