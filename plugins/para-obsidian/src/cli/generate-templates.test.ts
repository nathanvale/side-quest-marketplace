import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	DEFAULT_FRONTMATTER_RULES,
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

	test("maps clipping template to Clippings subdirectory", () => {
		expect(templateNameToFilePath("clipping-article")).toBe(
			"Templates/Clippings/article.md",
		);
		expect(templateNameToFilePath("clipping-book")).toBe(
			"Templates/Clippings/book.md",
		);
	});

	test("maps clipping with override name", () => {
		expect(templateNameToFilePath("clipping-youtube")).toBe(
			"Templates/Clippings/youtube-video.md",
		);
		expect(templateNameToFilePath("clipping-course")).toBe(
			"Templates/Clippings/course---tutorial.md",
		);
		expect(templateNameToFilePath("clipping-app")).toBe(
			"Templates/Clippings/app---software.md",
		);
	});

	test("maps processor template with -processor suffix", () => {
		expect(templateNameToFilePath("processor-article")).toBe(
			"Templates/Clippings/article-processor.md",
		);
		expect(templateNameToFilePath("processor-youtube")).toBe(
			"Templates/Clippings/youtube-processor.md",
		);
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

	test("clipping templates have correct file paths", () => {
		const results = generateAllTemplates(TEST_CONFIG, { dryRun: true });

		const article = results.find((r) => r.templateName === "clipping-article");
		expect(article?.filePath).toBe("Templates/Clippings/article.md");
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

	test("creates Clippings subdirectory", () => {
		generateAllTemplates(TEST_CONFIG, { outputDir: tmpDir });

		const clippingsDir = path.join(tmpDir, "Templates/Clippings");
		expect(fs.existsSync(clippingsDir)).toBe(true);
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
