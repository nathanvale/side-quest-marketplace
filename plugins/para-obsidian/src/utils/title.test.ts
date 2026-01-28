/**
 * Tests for title utilities.
 *
 * @module utils/title.test
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ParaObsidianConfig } from "../config/index";
import { applyTitlePrefix } from "./title";

describe("applyTitlePrefix", () => {
	let config: ParaObsidianConfig;

	beforeEach(() => {
		config = {
			vault: "/test/vault",
		};
	});

	afterEach(() => {
		// Cleanup if needed
	});

	test("applies default prefix for template type", () => {
		const result = applyTitlePrefix("My Project", "project", config);
		expect(result).toBe("🎯 My Project");
	});

	test("does not duplicate prefix if already present", () => {
		const result = applyTitlePrefix("🎯 My Project", "project", config);
		expect(result).toBe("🎯 My Project");
	});

	test("returns title unchanged if no prefix configured", () => {
		const result = applyTitlePrefix("My Task", "task", config);
		expect(result).toBe("My Task");
	});

	test("applies resource prefix without source_format", () => {
		const result = applyTitlePrefix("My Article", "resource", config);
		expect(result).toBe("📚 My Article");
	});

	test("applies resource prefix WITH source_format emoji (article)", () => {
		const frontmatter = { source_format: "article" };
		const result = applyTitlePrefix(
			"Progressive Summarization",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚📰 Progressive Summarization");
	});

	test("applies resource prefix WITH source_format emoji (video)", () => {
		const frontmatter = { source_format: "video" };
		const result = applyTitlePrefix(
			"TypeScript Deep Dive",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚🎬 TypeScript Deep Dive");
	});

	test("applies resource prefix WITH source_format emoji (podcast)", () => {
		const frontmatter = { source_format: "podcast" };
		const result = applyTitlePrefix(
			"Changelog Episode 123",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚🎙️ Changelog Episode 123");
	});

	test("applies resource prefix WITH source_format emoji (thread)", () => {
		const frontmatter = { source_format: "thread" };
		const result = applyTitlePrefix(
			"Dan Abramov on React",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚🧵 Dan Abramov on React");
	});

	test("applies resource prefix WITH source_format emoji (book)", () => {
		const frontmatter = { source_format: "book" };
		const result = applyTitlePrefix(
			"Building a Second Brain",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚📖 Building a Second Brain");
	});

	test("applies resource prefix WITH source_format emoji (course)", () => {
		const frontmatter = { source_format: "course" };
		const result = applyTitlePrefix(
			"TypeScript Fundamentals",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚🎓 TypeScript Fundamentals");
	});

	test("applies resource prefix WITH source_format emoji (audio)", () => {
		const frontmatter = { source_format: "audio" };
		const result = applyTitlePrefix(
			"Voice Memo",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚🎧 Voice Memo");
	});

	test("applies resource prefix WITH source_format emoji (paper)", () => {
		const frontmatter = { source_format: "paper" };
		const result = applyTitlePrefix(
			"Research Paper on AI",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚📑 Research Paper on AI");
	});

	test("applies resource prefix WITH source_format emoji (document)", () => {
		const frontmatter = { source_format: "document" };
		const result = applyTitlePrefix(
			"Generic Document",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚📄 Generic Document");
	});

	test("applies resource prefix WITH source_format emoji (image)", () => {
		const frontmatter = { source_format: "image" };
		const result = applyTitlePrefix(
			"Architecture Diagram",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚🖼️ Architecture Diagram");
	});

	test("ignores unknown source_format values", () => {
		const frontmatter = { source_format: "unknown" };
		const result = applyTitlePrefix(
			"Unknown Format",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚 Unknown Format");
	});

	test("source_format emoji only applies to resources, not other templates", () => {
		const frontmatter = { source_format: "video" };
		const result = applyTitlePrefix(
			"My Project",
			"project",
			config,
			frontmatter,
		);
		expect(result).toBe("🎯 My Project"); // No video emoji
	});

	test("handles custom title prefixes from config", () => {
		const customConfig: ParaObsidianConfig = {
			vault: "/test/vault",
			titlePrefixes: {
				project: "PROJECT: ",
			},
		};
		const result = applyTitlePrefix("My Project", "project", customConfig);
		expect(result).toBe("PROJECT: My Project");
	});

	test("handles custom prefix with source_format for resources", () => {
		const customConfig: ParaObsidianConfig = {
			vault: "/test/vault",
			titlePrefixes: {
				resource: "RES: ",
			},
		};
		const frontmatter = { source_format: "video" };
		const result = applyTitlePrefix(
			"My Video",
			"resource",
			customConfig,
			frontmatter,
		);
		// Custom prefix also gets format emoji (applies to all resource prefixes)
		expect(result).toBe("RES:🎬 My Video");
	});

	test("case-insensitive prefix detection", () => {
		const result = applyTitlePrefix("🎯 my project", "project", config);
		expect(result).toBe("🎯 my project");
	});

	test("handles frontmatter with null source_format", () => {
		const frontmatter = { source_format: null };
		const result = applyTitlePrefix(
			"My Resource",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚 My Resource");
	});

	test("handles frontmatter with undefined source_format", () => {
		const frontmatter = { source_format: undefined };
		const result = applyTitlePrefix(
			"My Resource",
			"resource",
			config,
			frontmatter,
		);
		expect(result).toBe("📚 My Resource");
	});
});
