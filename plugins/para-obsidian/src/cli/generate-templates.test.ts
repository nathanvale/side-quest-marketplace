import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	DEFAULT_FRONTMATTER_RULES,
	DEFAULT_TEMPLATE_BODY_CONFIG,
	DEFAULT_TEMPLATE_SECTIONS,
	DEFAULT_TEMPLATE_VERSIONS,
} from "../config/defaults";
import type { ParaObsidianConfig } from "../config/index";
import {
	generateAllTemplates,
	templateNameToFilePath,
} from "./generate-templates";

/** Minimal config with all template defaults for testing. */
const TEST_CONFIG: ParaObsidianConfig = {
	vault: "/tmp/test-vault",
	frontmatterRules: DEFAULT_FRONTMATTER_RULES,
	templateSections: DEFAULT_TEMPLATE_SECTIONS,
	templateVersions: DEFAULT_TEMPLATE_VERSIONS,
};

describe("templateNameToFilePath", () => {
	test("maps PARA template to Templates root", () => {
		expect(templateNameToFilePath("project")).toBe("Templates/project.md");
		expect(templateNameToFilePath("area")).toBe("Templates/area.md");
		expect(templateNameToFilePath("meeting")).toBe("Templates/meeting.md");
	});

	test("maps unified clipping template to Templates root", () => {
		expect(templateNameToFilePath("clipping")).toBe("Templates/clipping.md");
	});
});

describe("generateAllTemplates", () => {
	test("dry run generates all templates without writing", () => {
		const results = generateAllTemplates(TEST_CONFIG, { dryRun: true });

		expect(results.length).toBeGreaterThan(0);
		expect(results.length).toBe(Object.keys(DEFAULT_FRONTMATTER_RULES).length);

		// All should be marked as dry-run
		for (const r of results) {
			expect(r.written).toBe(false);
			expect(r.reason).toBe("dry-run");
			expect(r.content).toBeDefined();
			expect(r.content.length).toBeGreaterThan(0);
		}
	});

	test("each generated template has valid frontmatter", () => {
		const results = generateAllTemplates(TEST_CONFIG, { dryRun: true });

		for (const r of results) {
			expect(r.content).toStartWith("---\n");
			expect(r.content).toContain("template_version:");
			expect(r.content).toContain("---\n\n#");
		}
	});

	test("generated templates use native syntax", () => {
		const results = generateAllTemplates(TEST_CONFIG, { dryRun: true });

		for (const r of results) {
			// Should NOT contain Templater syntax
			expect(r.content).not.toContain("tp.system.prompt");
			expect(r.content).not.toContain("tp.date.now");

			// Should contain native syntax
			expect(r.content).toContain("{{");
		}
	});

	test("PARA templates have correct file paths", () => {
		const results = generateAllTemplates(TEST_CONFIG, { dryRun: true });

		const project = results.find((r) => r.templateName === "project");
		expect(project?.filePath).toBe("Templates/project.md");

		const area = results.find((r) => r.templateName === "area");
		expect(area?.filePath).toBe("Templates/area.md");
	});

	test("clipping template has correct file path", () => {
		const results = generateAllTemplates(TEST_CONFIG, { dryRun: true });

		const clipping = results.find((r) => r.templateName === "clipping");
		expect(clipping?.filePath).toBe("Templates/clipping.md");
	});

	test("clipping template uses bodyConfig when provided", () => {
		const configWithBodyConfig: ParaObsidianConfig = {
			vault: "/tmp/test-vault",
			frontmatterRules: DEFAULT_FRONTMATTER_RULES,
			templateSections: DEFAULT_TEMPLATE_SECTIONS,
			templateVersions: DEFAULT_TEMPLATE_VERSIONS,
			templateBodyConfig: DEFAULT_TEMPLATE_BODY_CONFIG,
		};

		const results = generateAllTemplates(configWithBodyConfig, {
			dryRun: true,
		});

		const clipping = results.find((r) => r.templateName === "clipping");
		expect(clipping).toBeDefined();

		// Clipping should have template_version (like all templates)
		expect(clipping?.content).toContain("template_version: 2");

		// Should have custom H1 and preamble
		expect(clipping?.content).toContain("# `= this.file.name`");
		expect(clipping?.content).toContain("**Source:** `= this.source`");
		expect(clipping?.content).toContain("**Clipped:** `= this.clipped`");

		// Should NOT have footer (Web Clipper only)
		expect(clipping?.content).not.toContain("highlights");

		// Should have Capture Reason section with Dataview inline
		expect(clipping?.content).toContain("## Capture Reason");
		expect(clipping?.content).toContain("`= this.capture_reason`");

		// Optional fields should emit empty values
		expect(clipping?.content).toContain('domain: ""');
		expect(clipping?.content).toContain('resource_type: ""');
		expect(clipping?.content).toContain('capture_reason: ""');
	});

	test("generates Web Clipper JSON for templates with bodyConfig", () => {
		const configWithBodyConfig: ParaObsidianConfig = {
			vault: "/tmp/test-vault",
			frontmatterRules: DEFAULT_FRONTMATTER_RULES,
			templateSections: DEFAULT_TEMPLATE_SECTIONS,
			templateVersions: DEFAULT_TEMPLATE_VERSIONS,
			templateBodyConfig: DEFAULT_TEMPLATE_BODY_CONFIG,
		};

		const results = generateAllTemplates(configWithBodyConfig, {
			dryRun: true,
		});

		const webClipper = results.find(
			(r) => r.templateName === "clipping (webclipper)",
		);
		expect(webClipper).toBeDefined();
		expect(webClipper?.filePath).toBe("templates/webclipper/capture.json");

		// Verify JSON is valid
		const parsed = JSON.parse(webClipper?.content ?? "{}");
		expect(parsed.schemaVersion).toBe("0.1.0");
		expect(parsed.name).toBe("Capture");
		expect(parsed.behavior).toBe("create");
		expect(parsed.path).toBe("00 Inbox");
		expect(parsed.properties.length).toBeGreaterThan(0);
	});

	test("uses config overrides instead of defaults", () => {
		const customConfig: ParaObsidianConfig = {
			vault: "/tmp/test-vault",
			frontmatterRules: {
				custom: {
					required: {
						type: { type: "enum", enum: ["custom"] },
						name: { type: "string" },
					},
				},
			},
			templateSections: {
				custom: [{ heading: "My Section", hasPrompt: false }],
			},
			templateVersions: { custom: 5 },
		};

		const results = generateAllTemplates(customConfig, { dryRun: true });

		expect(results.length).toBe(1);
		expect(results[0]?.templateName).toBe("custom");
		expect(results[0]?.content).toContain("template_version: 5");
		expect(results[0]?.content).toContain("## My Section");
	});
});

describe("generateAllTemplates (file output)", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "para-gen-test-"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	test("writes files to output directory", () => {
		const results = generateAllTemplates(TEST_CONFIG, { outputDir: tmpDir });

		const written = results.filter((r) => r.written);
		expect(written.length).toBeGreaterThan(0);

		// Check a PARA template was written
		const projectPath = path.join(tmpDir, "Templates/project.md");
		expect(fs.existsSync(projectPath)).toBe(true);

		const content = fs.readFileSync(projectPath, "utf-8");
		expect(content).toStartWith("---\n");
		expect(content).toContain("{{title}}");
	});

	test("writes unified clipping template flat in Templates directory", () => {
		generateAllTemplates(TEST_CONFIG, { outputDir: tmpDir });

		// No subdirectories — all templates are flat
		const clippingsDir = path.join(tmpDir, "Templates/Clippings");
		expect(fs.existsSync(clippingsDir)).toBe(false);

		// Unified clipping template exists
		const clippingPath = path.join(tmpDir, "Templates/clipping.md");
		expect(fs.existsSync(clippingPath)).toBe(true);

		// Old per-type templates should NOT exist
		const articlePath = path.join(tmpDir, "Templates/clipping-article.md");
		expect(fs.existsSync(articlePath)).toBe(false);
	});

	test("skips unchanged files on second run", () => {
		// First run — writes all files
		const first = generateAllTemplates(TEST_CONFIG, { outputDir: tmpDir });
		const firstWritten = first.filter((r) => r.written).length;
		expect(firstWritten).toBeGreaterThan(0);

		// Second run — all unchanged
		const second = generateAllTemplates(TEST_CONFIG, { outputDir: tmpDir });
		const secondWritten = second.filter((r) => r.written).length;
		const secondUnchanged = second.filter(
			(r) => r.reason === "unchanged",
		).length;

		expect(secondWritten).toBe(0);
		expect(secondUnchanged).toBe(first.length);
	});
});
