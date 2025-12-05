import { describe, expect, it } from "bun:test";

import { TOOL_NAMES } from "./tools.meta";

describe("para-obsidian MCP metadata", () => {
	it("lists expected tools", () => {
		expect(Array.isArray(TOOL_NAMES)).toBe(true);
		expect(TOOL_NAMES.length).toBeGreaterThan(10);
		expect(TOOL_NAMES).toContain("templates");
		expect(TOOL_NAMES).toContain("semantic_search");
		expect(TOOL_NAMES).toContain("frontmatter_plan");
		expect(TOOL_NAMES).toContain("frontmatter_apply_plan");
		expect(TOOL_NAMES).toContain("frontmatter_set");
		expect(TOOL_NAMES).toContain("frontmatter_migrate_all");
	});
});
