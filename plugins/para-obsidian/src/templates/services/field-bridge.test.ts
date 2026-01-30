import { describe, expect, test } from "bun:test";
import type { FrontmatterRules, ParaObsidianConfig } from "../../config/index";
import {
	buildTemplateConfig,
	fieldRulesToTemplateFields,
} from "./field-bridge";

describe("fieldRulesToTemplateFields", () => {
	test("converts string field to prompted template field", () => {
		const rules: FrontmatterRules = {
			required: {
				title: { type: "string" },
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields).toEqual([
			{
				name: "title",
				displayName: "Title",
				type: "string",
				required: true,
				default: undefined,
			},
		]);
	});

	test("converts created date to auto-fill field", () => {
		const rules: FrontmatterRules = {
			required: {
				created: { type: "date" },
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields).toEqual([
			{
				name: "created",
				displayName: "Created",
				type: "date",
				required: true,
				autoFill: 'tp.date.now("YYYY-MM-DDTHH:mm:ss")',
			},
		]);
	});

	test("converts clipped date to auto-fill field", () => {
		const rules: FrontmatterRules = {
			required: {
				clipped: { type: "date" },
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields[0]?.autoFill).toBe('tp.date.now("YYYY-MM-DDTHH:mm:ss")');
	});

	test("converts start_date to date-only auto-fill", () => {
		const rules: FrontmatterRules = {
			required: {
				start_date: { type: "date" },
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields[0]?.autoFill).toBe('tp.date.now("YYYY-MM-DD")');
	});

	test("converts enum field with values", () => {
		const rules: FrontmatterRules = {
			required: {
				status: {
					type: "enum",
					enum: ["active", "on-hold", "completed"],
				},
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields).toEqual([
			{
				name: "status",
				displayName: "Status",
				type: "enum",
				required: true,
				enumValues: ["active", "on-hold", "completed"],
				default: "active",
			},
		]);
	});

	test("converts wikilink field", () => {
		const rules: FrontmatterRules = {
			required: {
				area: { type: "wikilink" },
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields).toEqual([
			{
				name: "area",
				displayName: "Area",
				type: "wikilink",
				required: true,
				default: undefined,
			},
		]);
	});

	test("converts optional wikilink field", () => {
		const rules: FrontmatterRules = {
			required: {
				project: { type: "wikilink", optional: true },
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields[0]?.required).toBe(false);
		expect(fields[0]?.default).toBe("");
	});

	test("converts array field", () => {
		const rules: FrontmatterRules = {
			required: {
				depends_on: { type: "array", optional: true },
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields).toEqual([
			{
				name: "depends_on",
				displayName: "Depends On",
				type: "array",
				required: false,
				default: "[]",
			},
		]);
	});

	test("converts number field", () => {
		const rules: FrontmatterRules = {
			required: {
				cost: { type: "number" },
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields[0]?.type).toBe("number");
		expect(fields[0]?.required).toBe(true);
	});

	test("converts optional date field without auto-fill", () => {
		const rules: FrontmatterRules = {
			required: {
				due_date: { type: "date", optional: true },
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields[0]?.autoFill).toBeUndefined();
		expect(fields[0]?.required).toBe(false);
		expect(fields[0]?.default).toBe("");
	});

	test("handles multiple fields in order", () => {
		const rules: FrontmatterRules = {
			required: {
				title: { type: "string" },
				created: { type: "date" },
				type: { type: "enum", enum: ["project"] },
				status: { type: "enum", enum: ["active", "on-hold"] },
				area: { type: "wikilink" },
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields).toHaveLength(5);
		expect(fields.map((f) => f.name)).toEqual([
			"title",
			"created",
			"type",
			"status",
			"area",
		]);
	});

	test("handles empty rules", () => {
		const rules: FrontmatterRules = {};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields).toEqual([]);
	});

	test("handles boolean field as string", () => {
		const rules: FrontmatterRules = {
			required: {
				distilled: { type: "boolean", optional: true },
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields[0]?.type).toBe("string");
		expect(fields[0]?.default).toBe("false");
	});

	test("converts snake_case names to display names", () => {
		const rules: FrontmatterRules = {
			required: {
				target_completion: { type: "date" },
				booking_type: {
					type: "enum",
					enum: ["accommodation", "flight"],
				},
			},
		};

		const fields = fieldRulesToTemplateFields(rules);

		expect(fields[0]?.displayName).toBe("Target Completion");
		expect(fields[1]?.displayName).toBe("Booking Type");
	});
});

describe("buildTemplateConfig", () => {
	test("returns TemplateConfig for known template with rules", () => {
		const config = {
			vault: "/tmp/test-vault",
			frontmatterRules: {
				clipping: {
					required: {
						type: { type: "enum", enum: ["clipping"] },
						source: { type: "string" },
						clipped: { type: "date" },
					},
				},
			},
			templateSections: {
				clipping: [
					{
						heading: "Capture Reason",
						hasPrompt: false,
						content: "`= this.capture_reason`",
					},
					{ heading: "Content", hasPrompt: false },
				],
			},
			templateVersions: { clipping: 2 },
			templateBodyConfig: {
				clipping: {
					titleLine: "# `= this.file.name`",
					preamble: "**Source:** `= this.source`",
				},
			},
		} as unknown as ParaObsidianConfig;

		const result = buildTemplateConfig("clipping", config);

		expect(result).toBeDefined();
		expect(result?.name).toBe("clipping");
		expect(result?.noteType).toBe("clipping");
		expect(result?.version).toBe(2);
		expect(result?.fields).toHaveLength(3);
		expect(result?.sections).toHaveLength(2);
		expect(result?.bodyConfig?.titleLine).toBe("# `= this.file.name`");
	});

	test("returns undefined for unknown template", () => {
		const config = {
			vault: "/tmp/test-vault",
			frontmatterRules: {},
		} as unknown as ParaObsidianConfig;

		const result = buildTemplateConfig("nonexistent", config);

		expect(result).toBeUndefined();
	});

	test("returns undefined when frontmatterRules is undefined", () => {
		const config = {
			vault: "/tmp/test-vault",
		} as unknown as ParaObsidianConfig;

		const result = buildTemplateConfig("project", config);

		expect(result).toBeUndefined();
	});

	test("defaults version to 1 when not in templateVersions", () => {
		const config = {
			vault: "/tmp/test-vault",
			frontmatterRules: {
				custom: {
					required: {
						type: { type: "enum", enum: ["custom"] },
					},
				},
			},
		} as unknown as ParaObsidianConfig;

		const result = buildTemplateConfig("custom", config);

		expect(result?.version).toBe(1);
	});

	test("strips clipping- prefix from noteType", () => {
		const config = {
			vault: "/tmp/test-vault",
			frontmatterRules: {
				"clipping-youtube": {
					required: {
						type: { type: "enum", enum: ["youtube"] },
					},
				},
			},
		} as unknown as ParaObsidianConfig;

		const result = buildTemplateConfig("clipping-youtube", config);

		expect(result?.noteType).toBe("youtube");
	});

	test("provides empty sections when templateSections is missing", () => {
		const config = {
			vault: "/tmp/test-vault",
			frontmatterRules: {
				simple: {
					required: {
						type: { type: "enum", enum: ["simple"] },
					},
				},
			},
		} as unknown as ParaObsidianConfig;

		const result = buildTemplateConfig("simple", config);

		expect(result?.sections).toEqual([]);
		expect(result?.bodyConfig).toBeUndefined();
	});
});
