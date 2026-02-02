/**
 * Tests for title formatting utilities.
 *
 * @module obsidian/title-formatting.test
 */
import { describe, expect, test } from "bun:test";
import { applyTitlePrefix } from "./title-formatting";

describe("applyTitlePrefix", () => {
	const prefixMap = {
		project: "🎯 ",
		area: "🌱 ",
		resource: "📚 ",
		research: "📊 ",
		task: "", // Empty prefix
	};

	const sourceFormatEmojis = {
		article: "📰",
		video: "🎬",
		audio: "🎧",
		document: "📄",
		thread: "🧵",
		image: "🖼️",
		book: "📖",
		course: "🎓",
		podcast: "🎙️",
		paper: "📑",
	};

	describe("basic prefix application", () => {
		test("applies prefix for configured template type", () => {
			const result = applyTitlePrefix("My Project", "project", prefixMap);
			expect(result).toBe("🎯 My Project");
		});

		test("applies different prefix for different template", () => {
			const result = applyTitlePrefix("My Area", "area", prefixMap);
			expect(result).toBe("🌱 My Area");
		});

		test("returns title unchanged if no prefix configured", () => {
			const result = applyTitlePrefix("My Note", "unknown", prefixMap);
			expect(result).toBe("My Note");
		});

		test("handles empty prefix", () => {
			const result = applyTitlePrefix("My Task", "task", prefixMap);
			expect(result).toBe("My Task");
		});
	});

	describe("prefix deduplication", () => {
		test("does not duplicate prefix if already present", () => {
			const result = applyTitlePrefix("🎯 My Project", "project", prefixMap);
			expect(result).toBe("🎯 My Project");
		});

		test("case-insensitive prefix detection", () => {
			const result = applyTitlePrefix("🎯 my project", "project", prefixMap);
			expect(result).toBe("🎯 my project");
		});

		test("detects prefix with different casing in title", () => {
			const customMap = { note: "NOTE: " };
			const result = applyTitlePrefix("note: my note", "note", customMap);
			expect(result).toBe("note: my note");
		});
	});

	describe("emoji map integration", () => {
		test("applies base prefix without emoji map", () => {
			const result = applyTitlePrefix("My Article", "resource", prefixMap);
			expect(result).toBe("📚 My Article");
		});

		test("applies base prefix + emoji when frontmatter matches emoji map", () => {
			const frontmatter = { source_format: "video" };
			const result = applyTitlePrefix(
				"TypeScript Deep Dive",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚🎬 TypeScript Deep Dive");
		});

		test("applies correct emoji for article format", () => {
			const frontmatter = { source_format: "article" };
			const result = applyTitlePrefix(
				"Progressive Summarization",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚📰 Progressive Summarization");
		});

		test("applies correct emoji for podcast format", () => {
			const frontmatter = { source_format: "podcast" };
			const result = applyTitlePrefix(
				"Changelog Episode 123",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚🎙️ Changelog Episode 123");
		});

		test("applies correct emoji for thread format", () => {
			const frontmatter = { source_format: "thread" };
			const result = applyTitlePrefix(
				"Dan Abramov on React",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚🧵 Dan Abramov on React");
		});

		test("applies correct emoji for book format", () => {
			const frontmatter = { source_format: "book" };
			const result = applyTitlePrefix(
				"Building a Second Brain",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚📖 Building a Second Brain");
		});

		test("applies correct emoji for course format", () => {
			const frontmatter = { source_format: "course" };
			const result = applyTitlePrefix(
				"TypeScript Fundamentals",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚🎓 TypeScript Fundamentals");
		});

		test("applies correct emoji for audio format", () => {
			const frontmatter = { source_format: "audio" };
			const result = applyTitlePrefix(
				"Voice Memo",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚🎧 Voice Memo");
		});

		test("applies correct emoji for paper format", () => {
			const frontmatter = { source_format: "paper" };
			const result = applyTitlePrefix(
				"Research Paper on AI",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚📑 Research Paper on AI");
		});

		test("applies correct emoji for document format", () => {
			const frontmatter = { source_format: "document" };
			const result = applyTitlePrefix(
				"Generic Document",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚📄 Generic Document");
		});

		test("applies correct emoji for image format", () => {
			const frontmatter = { source_format: "image" };
			const result = applyTitlePrefix(
				"Architecture Diagram",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚🖼️ Architecture Diagram");
		});

		test("ignores unknown emoji map values", () => {
			const frontmatter = { source_format: "unknown" };
			const result = applyTitlePrefix(
				"Unknown Format",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚 Unknown Format");
		});

		test("emoji map only applies to templates with matching field", () => {
			const frontmatter = { source_format: "video" };
			const result = applyTitlePrefix(
				"My Project",
				"project",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("🎯 My Project"); // No video emoji
		});

		test("handles null frontmatter field value", () => {
			const frontmatter = { source_format: null };
			const result = applyTitlePrefix(
				"My Resource",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚 My Resource");
		});

		test("handles undefined frontmatter field value", () => {
			const frontmatter = { source_format: undefined };
			const result = applyTitlePrefix(
				"My Resource",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚 My Resource");
		});

		test("handles missing frontmatter parameter", () => {
			const result = applyTitlePrefix(
				"My Resource",
				"resource",
				prefixMap,
				undefined,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚 My Resource");
		});
	});

	describe("custom emoji field", () => {
		test("uses custom emoji field name", () => {
			const customEmojis = { high: "🔴", medium: "🟡", low: "🟢" };
			const frontmatter = { priority: "high" };
			const result = applyTitlePrefix(
				"Urgent Task",
				"task",
				{ task: "TASK: " },
				frontmatter,
				customEmojis,
				"priority",
				["task"],
			);
			expect(result).toBe("TASK:🔴 Urgent Task");
		});

		test("defaults to source_format field when not specified", () => {
			const frontmatter = { source_format: "video" };
			const result = applyTitlePrefix(
				"My Video",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚🎬 My Video");
		});
	});

	describe("emoji templates parameter", () => {
		test("accepts array of template names", () => {
			const frontmatter = { source_format: "video" };
			const result = applyTitlePrefix(
				"My Video",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚🎬 My Video");
		});

		test("accepts Set of template names", () => {
			const frontmatter = { source_format: "video" };
			const result = applyTitlePrefix(
				"My Video",
				"resource",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				new Set(["resource"]),
			);
			expect(result).toBe("📚🎬 My Video");
		});

		test("emoji map applies to all templates when emojiTemplates not provided", () => {
			const frontmatter = { source_format: "video" };
			const result = applyTitlePrefix(
				"My Project",
				"project",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
			);
			expect(result).toBe("🎯🎬 My Project");
		});

		test("emoji map does not apply when template not in emojiTemplates array", () => {
			const frontmatter = { source_format: "video" };
			const result = applyTitlePrefix(
				"My Project",
				"project",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("🎯 My Project");
		});

		test("emoji map does not apply when template not in emojiTemplates Set", () => {
			const frontmatter = { source_format: "video" };
			const result = applyTitlePrefix(
				"My Project",
				"project",
				prefixMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				new Set(["resource"]),
			);
			expect(result).toBe("🎯 My Project");
		});
	});

	describe("edge cases", () => {
		test("handles empty title", () => {
			const result = applyTitlePrefix("", "project", prefixMap);
			expect(result).toBe("🎯 ");
		});

		test("handles title with leading whitespace", () => {
			const result = applyTitlePrefix("  My Project", "project", prefixMap);
			expect(result).toBe("🎯   My Project");
		});

		test("handles prefix without trailing space", () => {
			const customMap = { note: "NOTE:" };
			const result = applyTitlePrefix("My Note", "note", customMap);
			expect(result).toBe("NOTE: My Note");
		});

		test("handles prefix with multiple trailing spaces", () => {
			const customMap = { note: "NOTE:  " };
			const result = applyTitlePrefix("My Note", "note", customMap);
			expect(result).toBe("NOTE:  My Note");
		});

		test("handles emoji in title that isn't a prefix", () => {
			const result = applyTitlePrefix("🎨 Art Project", "project", prefixMap);
			expect(result).toBe("🎯 🎨 Art Project");
		});

		test("handles custom prefix with emoji map", () => {
			const customMap = { resource: "RES: " };
			const frontmatter = { source_format: "video" };
			const result = applyTitlePrefix(
				"My Video",
				"resource",
				customMap,
				frontmatter,
				sourceFormatEmojis,
				"source_format",
				["resource"],
			);
			expect(result).toBe("RES:🎬 My Video");
		});

		test("handles empty prefix map", () => {
			const result = applyTitlePrefix("My Note", "note", {});
			expect(result).toBe("My Note");
		});

		test("handles empty emoji map", () => {
			const frontmatter = { source_format: "video" };
			const result = applyTitlePrefix(
				"My Video",
				"resource",
				prefixMap,
				frontmatter,
				{},
				"source_format",
				["resource"],
			);
			expect(result).toBe("📚 My Video");
		});
	});
});
