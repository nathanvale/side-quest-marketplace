import { afterEach, describe, expect, it } from "bun:test";
import {
	createTestVault,
	useTestVaultCleanup,
	writeVaultFile,
} from "../testing/utils";
import { findOrphans, formatFixCommand, suggestFixes } from "./orphans";

describe("findOrphans", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	/**
	 * Helper to create and track a test vault in one call.
	 * Combines createTestVault() + trackVault() to eliminate DRY violations.
	 */
	const setupTest = () => {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	};

	describe("attachment links", () => {
		it("does not report PDF attachments as broken when correctly linked", () => {
			const vault = setupTest();
			// Create attachment
			writeVaultFile(vault, "Attachments/document.pdf", "PDF content");
			// Create note linking to it
			writeVaultFile(
				vault,
				"note.md",
				`---
title: Test
---
See [[Attachments/document.pdf]] for details.`,
			);

			const result = findOrphans(vault);

			expect(result.brokenLinks).toHaveLength(0);
			expect(result.orphanAttachments).toHaveLength(0);
		});

		it("does not report image attachments as broken when correctly linked", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Attachments/photo.png", "PNG content");
			writeVaultFile(vault, "note.md", "![[Attachments/photo.png]]");

			const result = findOrphans(vault);

			expect(result.brokenLinks).toHaveLength(0);
			expect(result.orphanAttachments).toHaveLength(0);
		});

		it("reports orphan attachments not referenced by any note", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Attachments/unused.pdf", "PDF content");
			writeVaultFile(vault, "note.md", "No links here");

			const result = findOrphans(vault);

			expect(result.orphanAttachments).toContain("Attachments/unused.pdf");
		});

		it("reports broken links to non-existent attachments", () => {
			const vault = setupTest();
			writeVaultFile(vault, "note.md", "See [[Attachments/missing.pdf]]");

			const result = findOrphans(vault);

			expect(result.brokenLinks).toHaveLength(1);
			expect(result.brokenLinks[0]?.link).toBe("Attachments/missing.pdf");
		});

		it("handles various file extensions correctly", () => {
			const vault = setupTest();
			// Create various attachment types
			writeVaultFile(vault, "Attachments/doc.pdf", "content");
			writeVaultFile(vault, "Attachments/image.jpg", "content");
			writeVaultFile(vault, "Attachments/image.png", "content");
			writeVaultFile(vault, "Attachments/video.mp4", "content");
			writeVaultFile(vault, "Attachments/audio.mp3", "content");

			// Link to all of them
			writeVaultFile(
				vault,
				"note.md",
				`
[[Attachments/doc.pdf]]
[[Attachments/image.jpg]]
[[Attachments/image.png]]
[[Attachments/video.mp4]]
[[Attachments/audio.mp3]]
`,
			);

			const result = findOrphans(vault);

			expect(result.brokenLinks).toHaveLength(0);
			expect(result.orphanAttachments).toHaveLength(0);
		});
	});

	describe("markdown note links", () => {
		it("reports broken links to non-existent notes", () => {
			const vault = setupTest();
			writeVaultFile(vault, "note.md", "See [[Missing Note]] for details.");

			const result = findOrphans(vault);

			expect(result.brokenLinks).toHaveLength(1);
			expect(result.brokenLinks[0]?.link).toBe("Missing Note");
		});

		it("does not report links to existing notes", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Target Note.md", "Target content");
			writeVaultFile(vault, "source.md", "Link to [[Target Note]]");

			const result = findOrphans(vault);

			expect(result.brokenLinks).toHaveLength(0);
		});

		it("handles links with aliases correctly", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Target.md", "content");
			writeVaultFile(vault, "source.md", "[[Target|My Alias]]");

			const result = findOrphans(vault);

			expect(result.brokenLinks).toHaveLength(0);
		});

		it("handles links with headings correctly", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Target.md", "# Section\ncontent");
			writeVaultFile(vault, "source.md", "[[Target#Section]]");

			const result = findOrphans(vault);

			expect(result.brokenLinks).toHaveLength(0);
		});

		it("handles links with block references correctly", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Target.md", "content ^block1");
			writeVaultFile(vault, "source.md", "[[Target^block1]]");

			const result = findOrphans(vault);

			expect(result.brokenLinks).toHaveLength(0);
		});
	});

	describe("frontmatter links", () => {
		it("detects broken links in frontmatter arrays", () => {
			const vault = setupTest();
			writeVaultFile(
				vault,
				"note.md",
				`---
attachments:
  - "[[Missing.pdf]]"
---
Body content`,
			);

			const result = findOrphans(vault);

			expect(result.brokenLinks).toHaveLength(1);
			expect(result.brokenLinks[0]?.location).toBe("frontmatter");
		});

		it("detects broken links in frontmatter strings", () => {
			const vault = setupTest();
			writeVaultFile(
				vault,
				"note.md",
				`---
project: "[[Missing Project]]"
---
Body content`,
			);

			const result = findOrphans(vault);

			expect(result.brokenLinks).toHaveLength(1);
			expect(result.brokenLinks[0]?.location).toBe("frontmatter");
		});
	});

	describe("directory scoping", () => {
		it("respects dirs option", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Projects/note.md", "[[Missing]]");
			writeVaultFile(vault, "Areas/note.md", "[[Also Missing]]");

			const result = findOrphans(vault, { dirs: ["Projects"] });

			expect(result.brokenLinks).toHaveLength(1);
			expect(result.brokenLinks[0]?.note).toBe("Projects/note.md");
		});
	});
});

describe("suggestFixes", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();
	afterEach(getAfterEachHook());

	/**
	 * Helper to create and track a test vault in one call.
	 * Combines createTestVault() + trackVault() to eliminate DRY violations.
	 */
	const setupTest = () => {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	};

	describe("attachment links", () => {
		it("suggests fix from broken link array directly", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Attachments/document.pdf", "PDF content");

			const brokenLinks = [
				{ note: "note.md", link: "document.pdf", location: "body" as const },
			];
			const fixes = suggestFixes(vault, brokenLinks);

			expect(fixes).toHaveLength(1);
			expect(fixes[0]?.from).toBe("document.pdf");
			expect(fixes[0]?.to).toBe("Attachments/document.pdf");
			expect(fixes[0]?.confidence).toBe("high");
		});

		it("does not suggest fix when file does not exist in Attachments", () => {
			const vault = setupTest();
			const brokenLinks = [
				{
					note: "note.md",
					link: "nonexistent.pdf",
					location: "body" as const,
				},
			];
			const fixes = suggestFixes(vault, brokenLinks);

			expect(fixes).toHaveLength(0);
		});

		it("deduplicates suggestions for same link", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Attachments/shared.pdf", "PDF content");
			const brokenLinks = [
				{ note: "note1.md", link: "shared.pdf", location: "body" as const },
				{ note: "note2.md", link: "shared.pdf", location: "body" as const },
			];
			const fixes = suggestFixes(vault, brokenLinks);

			expect(fixes).toHaveLength(1);
		});

		it("handles case-insensitive matching", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Attachments/Document.PDF", "PDF content");
			const brokenLinks = [
				{ note: "note.md", link: "document.pdf", location: "body" as const },
			];
			const fixes = suggestFixes(vault, brokenLinks);

			expect(fixes).toHaveLength(1);
			expect(fixes[0]?.to).toBe("Attachments/Document.PDF");
		});

		it("fuzzy matches similar attachment filenames", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Attachments/booking-confirmation.pdf", "PDF");
			const brokenLinks = [
				{
					note: "note.md",
					link: "booking-confrmation.pdf", // typo
					location: "body" as const,
				},
			];
			const fixes = suggestFixes(vault, brokenLinks);

			expect(fixes).toHaveLength(1);
			expect(fixes[0]?.to).toBe("Attachments/booking-confirmation.pdf");
			expect(fixes[0]?.confidence).toBe("medium");
		});

		it("fuzzy matches wrong filename in Attachments/ prefix", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Attachments/receipt-2024.pdf", "PDF");
			const brokenLinks = [
				{
					note: "note.md",
					link: "Attachments/reciept-2024.pdf", // typo in path
					location: "body" as const,
				},
			];
			const fixes = suggestFixes(vault, brokenLinks);

			expect(fixes).toHaveLength(1);
			expect(fixes[0]?.to).toBe("Attachments/receipt-2024.pdf");
			expect(fixes[0]?.confidence).toBe("medium");
		});
	});

	describe("note links", () => {
		it("suggests fix for broken note link with exact case mismatch", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Projects/My Project.md", "content");
			const brokenLinks = [
				{
					note: "note.md",
					link: "my project", // wrong case
					location: "body" as const,
				},
			];
			const fixes = suggestFixes(vault, brokenLinks);

			expect(fixes).toHaveLength(1);
			expect(fixes[0]?.to).toBe("My Project");
			expect(fixes[0]?.confidence).toBe("high");
		});

		it("fuzzy matches similar note titles", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Projects/2025 Camping Trip.md", "content");
			const brokenLinks = [
				{
					note: "note.md",
					link: "Camping Trip", // partial match
					location: "body" as const,
				},
			];
			const fixes = suggestFixes(vault, brokenLinks);

			expect(fixes).toHaveLength(1);
			expect(fixes[0]?.to).toBe("2025 Camping Trip");
			expect(fixes[0]?.confidence).toBe("medium");
		});

		it("fuzzy matches note titles with typos", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Areas/Command Center.md", "content");
			const brokenLinks = [
				{
					note: "note.md",
					link: "Comand Center", // typo
					location: "body" as const,
				},
			];
			const fixes = suggestFixes(vault, brokenLinks);

			expect(fixes).toHaveLength(1);
			expect(fixes[0]?.to).toBe("Command Center");
			expect(fixes[0]?.confidence).toBe("medium");
		});

		it("does not suggest when no similar notes exist", () => {
			const vault = setupTest();
			writeVaultFile(vault, "Projects/Unrelated.md", "content");
			const brokenLinks = [
				{
					note: "note.md",
					link: "Something Completely Different",
					location: "body" as const,
				},
			];
			const fixes = suggestFixes(vault, brokenLinks);

			expect(fixes).toHaveLength(0);
		});
	});
});

describe("formatFixCommand", () => {
	it("formats single fix as CLI command", () => {
		const fixes = [
			{
				from: "doc.pdf",
				to: "Attachments/doc.pdf",
				confidence: "high" as const,
				reason: "File exists",
			},
		];

		const cmd = formatFixCommand(fixes);

		expect(cmd).toContain("para-obsidian rewrite-links");
		expect(cmd).toContain('--from "doc.pdf"');
		expect(cmd).toContain('--to "Attachments/doc.pdf"');
	});

	it("formats multiple fixes with line continuations", () => {
		const fixes = [
			{
				from: "a.pdf",
				to: "Attachments/a.pdf",
				confidence: "high" as const,
				reason: "File exists",
			},
			{
				from: "b.pdf",
				to: "Attachments/b.pdf",
				confidence: "high" as const,
				reason: "File exists",
			},
		];

		const cmd = formatFixCommand(fixes);

		expect(cmd).toContain('--from "a.pdf" --to "Attachments/a.pdf"');
		expect(cmd).toContain('--from "b.pdf" --to "Attachments/b.pdf"');
		expect(cmd).toContain(" \\\n");
	});

	it("returns empty string for no fixes", () => {
		expect(formatFixCommand([])).toBe("");
	});
});
