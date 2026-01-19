import { describe, expect, test } from "bun:test";
import { PLUGIN_NAME } from "./index.ts";

describe("teams-scrape", () => {
	test("exports plugin name", () => {
		expect(PLUGIN_NAME).toBe("teams-scrape");
	});
});
