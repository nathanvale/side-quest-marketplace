import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import type { ParaObsidianConfig } from "../config/index";
import {
	createTestVault,
	initGitRepo,
	useTestVaultCleanup,
} from "../testing/utils";
import { gitStatus } from "./index";

function makeConfig(vault: string): ParaObsidianConfig {
	return {
		vault,
		templatesDir: path.join(vault, "templates"),
		defaultDestinations: {},
		suggestedTags: [],
		frontmatterRules: {},
		autoCommit: false,
	};
}

/**
 * Helper to create and track a test vault in one operation.
 * Eliminates repeated pattern of createTestVault() + trackVault().
 */
function setupTestVault(tracker: {
	trackVault: (vault: string) => void;
}): string {
	const vault = createTestVault();
	tracker.trackVault(vault);
	return vault;
}

describe("git helpers", () => {
	const tracker = useTestVaultCleanup();
	afterEach(tracker.getAfterEachHook());

	it("reports clean/dirty status", async () => {
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);
		const clean = await gitStatus(dir);
		expect(clean.clean).toBe(true);

		fs.writeFileSync(path.join(dir, "file.txt"), "change");
		const dirty = await gitStatus(dir);
		expect(dirty.clean).toBe(false);
	});
});

describe("unescapeGitPath", () => {
	it("decodes emoji characters from octal escape sequences", async () => {
		const { unescapeGitPath } = await import("./index");
		// 🧾 (receipt emoji U+1F9FE) = UTF-8 bytes [F0 9F A7 BE] = \360\237\247\276
		const escaped = "\\360\\237\\247\\276 Invoice.md";
		expect(unescapeGitPath(escaped)).toBe("🧾 Invoice.md");
	});

	it("decodes multiple emoji characters", async () => {
		const { unescapeGitPath } = await import("./index");
		// 📝 (memo U+1F4DD) = \360\237\223\235
		// 🗂 (card box U+1F5C2) = \360\237\227\202 (without variation selector)
		const escaped =
			"\\360\\237\\223\\235 Note with \\360\\237\\227\\202 folder.md";
		expect(unescapeGitPath(escaped)).toBe("📝 Note with 🗂 folder.md");
	});

	it("handles standard C escape sequences", async () => {
		const { unescapeGitPath } = await import("./index");
		expect(unescapeGitPath("file\\twith\\ttabs.md")).toBe(
			"file\twith\ttabs.md",
		);
		expect(unescapeGitPath("file\\nwith\\nnewlines.md")).toBe(
			"file\nwith\nnewlines.md",
		);
		expect(unescapeGitPath("file\\rwith\\rreturns.md")).toBe(
			"file\rwith\rreturns.md",
		);
	});

	it("handles escaped backslash", async () => {
		const { unescapeGitPath } = await import("./index");
		expect(unescapeGitPath("path\\\\to\\\\file.md")).toBe("path\\to\\file.md");
	});

	it("handles escaped double quote", async () => {
		const { unescapeGitPath } = await import("./index");
		expect(unescapeGitPath('file \\"quoted\\".md')).toBe('file "quoted".md');
	});

	it("preserves regular ASCII characters", async () => {
		const { unescapeGitPath } = await import("./index");
		expect(unescapeGitPath("Normal File Name.md")).toBe("Normal File Name.md");
	});

	it("handles mixed content (ASCII + emoji + escapes)", async () => {
		const { unescapeGitPath } = await import("./index");
		// 🧾 Invoice - 2025\\t(draft).md
		const escaped = "\\360\\237\\247\\276 Invoice - 2025\\t(draft).md";
		expect(unescapeGitPath(escaped)).toBe("🧾 Invoice - 2025\t(draft).md");
	});

	it("handles empty string", async () => {
		const { unescapeGitPath } = await import("./index");
		expect(unescapeGitPath("")).toBe("");
	});

	it("handles Japanese characters", async () => {
		const { unescapeGitPath } = await import("./index");
		// 日本語 = UTF-8 bytes for each character
		// 日 = E6 97 A5 = \346\227\245
		// 本 = E6 9C AC = \346\234\254
		// 語 = E8 AA 9E = \350\252\236
		const escaped = "\\346\\227\\245\\346\\234\\254\\350\\252\\236.md";
		expect(unescapeGitPath(escaped)).toBe("日本語.md");
	});
});

describe("getUncommittedFiles with emoji filenames", () => {
	const tracker = useTestVaultCleanup();
	afterEach(tracker.getAfterEachHook());

	it("correctly decodes git's octal-escaped unicode paths", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		// Create file with emoji in name
		// 🧾 = UTF-8 bytes [F0 9F A7 BE]
		const filename = "🧾 Invoice - 20250930.md";
		fs.writeFileSync(path.join(dir, filename), "# Invoice");

		const files = await getUncommittedFiles(dir);

		// Should return actual filename, not escaped version
		expect(files).toContain(filename);
		expect(files.some((f) => f.includes("\\360"))).toBe(false);

		// Verify file actually exists at returned path
		const fullPath = path.join(dir, files[0]!);
		expect(fs.existsSync(fullPath)).toBe(true);
	});

	it("handles files with spaces and emoji combined", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		const filename = "📝 My Important Note.md";
		fs.writeFileSync(path.join(dir, filename), "# Note");

		const files = await getUncommittedFiles(dir);
		expect(files).toContain(filename);
	});

	it("handles Japanese characters in filenames", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		const filename = "日本語ノート.md";
		fs.writeFileSync(path.join(dir, filename), "# Note");

		const files = await getUncommittedFiles(dir);
		expect(files).toContain(filename);
	});

	it("handles subdirectories with emoji filenames", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		fs.mkdirSync(path.join(dir, "invoices"), { recursive: true });
		const filename = "invoices/🧾 Invoice.md";
		fs.writeFileSync(path.join(dir, filename), "# Invoice");

		const files = await getUncommittedFiles(dir);
		expect(files).toContain(filename);
	});
});

describe("getUncommittedFiles with allFileTypes", () => {
	const tracker = useTestVaultCleanup();
	afterEach(tracker.getAfterEachHook());

	it("returns all file types (not just .md)", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		// Create mixed file types
		fs.writeFileSync(path.join(dir, "note.md"), "# Note");
		fs.writeFileSync(path.join(dir, "doc.pdf"), "PDF data");
		fs.writeFileSync(path.join(dir, "data.json"), "{}");
		fs.writeFileSync(path.join(dir, "script.js"), "console.log()");

		const files = await getUncommittedFiles(dir, { allFileTypes: true });
		expect(files).toContain("note.md");
		expect(files).toContain("doc.pdf");
		expect(files).toContain("data.json");
		expect(files).toContain("script.js");
		expect(files).toHaveLength(4);
	});

	it("returns empty array when working tree is clean", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		const files = await getUncommittedFiles(dir, { allFileTypes: true });
		expect(files).toEqual([]);
	});

	it("returns files from subdirectories with relative paths", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		// Create subdirectory with files
		fs.mkdirSync(path.join(dir, "inbox"), { recursive: true });
		fs.writeFileSync(path.join(dir, "inbox", "document.pdf"), "PDF");
		fs.writeFileSync(path.join(dir, "inbox", "metadata.json"), "{}");

		const files = await getUncommittedFiles(dir, { allFileTypes: true });
		expect(files).toContain("inbox/document.pdf");
		expect(files).toContain("inbox/metadata.json");
		expect(files).toHaveLength(2);
	});

	it("handles staged and unstaged files", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		// Create and stage a file
		fs.writeFileSync(path.join(dir, "staged.pdf"), "PDF");
		await Bun.$`git add staged.pdf`.cwd(dir);

		// Create an unstaged file
		fs.writeFileSync(path.join(dir, "unstaged.json"), "{}");

		const files = await getUncommittedFiles(dir, { allFileTypes: true });
		expect(files).toContain("staged.pdf");
		expect(files).toContain("unstaged.json");
		expect(files).toHaveLength(2);
	});

	it("handles modified existing files", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		// Create and commit a file
		fs.writeFileSync(path.join(dir, "existing.pdf"), "Original");
		await Bun.$`git add existing.pdf`.cwd(dir);
		await Bun.$`git commit -m "add pdf"`.cwd(dir);

		// Modify the file
		fs.writeFileSync(path.join(dir, "existing.pdf"), "Modified");

		const files = await getUncommittedFiles(dir, { allFileTypes: true });
		expect(files).toContain("existing.pdf");
		expect(files).toHaveLength(1);
	});
});

describe("getUncommittedFiles", () => {
	const tracker = useTestVaultCleanup();
	afterEach(tracker.getAfterEachHook());

	it("returns unstaged new .md files (status ??)", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		// Create new .md files (untracked)
		fs.writeFileSync(path.join(dir, "note1.md"), "# Note 1");
		fs.writeFileSync(path.join(dir, "note2.md"), "# Note 2");

		const files = await getUncommittedFiles(dir);
		expect(files).toContain("note1.md");
		expect(files).toContain("note2.md");
		expect(files).toHaveLength(2);
	});

	it("returns staged .md files (status A)", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		// Create and stage a new file
		fs.writeFileSync(path.join(dir, "staged.md"), "# Staged");
		await Bun.$`git add staged.md`.cwd(dir);

		const files = await getUncommittedFiles(dir);
		expect(files).toContain("staged.md");
		expect(files).toHaveLength(1);
	});

	it("returns modified .md files (status M)", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		// Create and commit a file, then modify it
		fs.writeFileSync(path.join(dir, "existing.md"), "# Original");
		await Bun.$`git add existing.md`.cwd(dir);
		await Bun.$`git commit -m "add existing"`.cwd(dir);

		// Modify the file
		fs.writeFileSync(path.join(dir, "existing.md"), "# Modified");

		const files = await getUncommittedFiles(dir);
		expect(files).toContain("existing.md");
		expect(files).toHaveLength(1);
	});

	it("handles files with both staged and unstaged changes (status MM)", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		// Create and commit a file
		fs.writeFileSync(path.join(dir, "both.md"), "# Original");
		await Bun.$`git add both.md`.cwd(dir);
		await Bun.$`git commit -m "add both"`.cwd(dir);

		// Modify and stage
		fs.writeFileSync(path.join(dir, "both.md"), "# First change");
		await Bun.$`git add both.md`.cwd(dir);

		// Modify again without staging
		fs.writeFileSync(path.join(dir, "both.md"), "# Second change");

		const files = await getUncommittedFiles(dir);
		expect(files).toContain("both.md");
		expect(files).toHaveLength(1);
	});

	it("filters out non-.md files", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		// Create mixed file types
		fs.writeFileSync(path.join(dir, "note.md"), "# Note");
		fs.writeFileSync(path.join(dir, "script.js"), "console.log('hi')");
		fs.writeFileSync(path.join(dir, "data.json"), "{}");
		fs.writeFileSync(path.join(dir, "readme.txt"), "text");

		const files = await getUncommittedFiles(dir);
		expect(files).toContain("note.md");
		expect(files).not.toContain("script.js");
		expect(files).not.toContain("data.json");
		expect(files).not.toContain("readme.txt");
		expect(files).toHaveLength(1);
	});

	it("returns empty array when working tree is clean", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		const files = await getUncommittedFiles(dir);
		expect(files).toEqual([]);
	});

	it("returns files from subdirectories with relative paths", async () => {
		const { getUncommittedFiles } = await import("./index");
		const dir = setupTestVault(tracker);
		await initGitRepo(dir);

		// Create subdirectory with notes
		fs.mkdirSync(path.join(dir, "projects"), { recursive: true });
		fs.writeFileSync(path.join(dir, "projects", "project1.md"), "# Project 1");

		const files = await getUncommittedFiles(dir);
		expect(files).toContain("projects/project1.md");
		expect(files).toHaveLength(1);
	});
});

describe("extractLinkedAttachments", () => {
	const tracker = useTestVaultCleanup();
	afterEach(tracker.getAfterEachHook());

	it("extracts wikilink embeds ![[image.png]]", async () => {
		const { extractLinkedAttachments } = await import("./index");
		const vault = setupTestVault(tracker);
		fs.mkdirSync(path.join(vault, "attachments"), { recursive: true });

		// Create note with wikilink embeds
		const notePath = path.join(vault, "note.md");
		fs.writeFileSync(
			notePath,
			"# Note\n![[attachments/screenshot.png]]\n![[attachments/diagram.jpg]]\n",
		);

		// Create the attachment files
		fs.writeFileSync(path.join(vault, "attachments", "screenshot.png"), "");
		fs.writeFileSync(path.join(vault, "attachments", "diagram.jpg"), "");

		const attachments = extractLinkedAttachments(vault, "note.md");
		expect(attachments).toContain("attachments/screenshot.png");
		expect(attachments).toContain("attachments/diagram.jpg");
		expect(attachments).toHaveLength(2);
	});

	it("extracts markdown embeds ![](path/to/file.png)", async () => {
		const { extractLinkedAttachments } = await import("./index");
		const vault = setupTestVault(tracker);
		fs.mkdirSync(path.join(vault, "images"), { recursive: true });

		const notePath = path.join(vault, "note.md");
		fs.writeFileSync(
			notePath,
			"# Note\n![screenshot](images/screen.png)\n![photo](images/photo.jpg)\n",
		);

		fs.writeFileSync(path.join(vault, "images", "screen.png"), "");
		fs.writeFileSync(path.join(vault, "images", "photo.jpg"), "");

		const attachments = extractLinkedAttachments(vault, "note.md");
		expect(attachments).toContain("images/screen.png");
		expect(attachments).toContain("images/photo.jpg");
		expect(attachments).toHaveLength(2);
	});

	it("handles relative paths in embeds", async () => {
		const { extractLinkedAttachments } = await import("./index");
		const vault = setupTestVault(tracker);
		fs.mkdirSync(path.join(vault, "notes"), { recursive: true });
		fs.mkdirSync(path.join(vault, "files"), { recursive: true });

		// Note in subdirectory referencing attachment in another directory
		const notePath = path.join(vault, "notes", "project.md");
		fs.writeFileSync(notePath, "# Project\n![[../files/diagram.png]]\n");

		fs.writeFileSync(path.join(vault, "files", "diagram.png"), "");

		const attachments = extractLinkedAttachments(vault, "notes/project.md");
		expect(attachments).toContain("files/diagram.png");
	});

	it("skips .md file links (notes, not attachments)", async () => {
		const { extractLinkedAttachments } = await import("./index");
		const vault = setupTestVault(tracker);
		const notePath = path.join(vault, "note.md");
		fs.writeFileSync(
			notePath,
			"# Note\n![[other-note.md]]\n![[image.png]]\n[[linked-note.md]]\n",
		);

		// Create the files
		fs.writeFileSync(path.join(vault, "other-note.md"), "");
		fs.writeFileSync(path.join(vault, "linked-note.md"), "");
		fs.writeFileSync(path.join(vault, "image.png"), "");

		const attachments = extractLinkedAttachments(vault, "note.md");
		expect(attachments).not.toContain("other-note.md");
		expect(attachments).not.toContain("linked-note.md");
		expect(attachments).toContain("image.png");
		expect(attachments).toHaveLength(1);
	});

	it("only returns existing files", async () => {
		const { extractLinkedAttachments } = await import("./index");
		const vault = setupTestVault(tracker);
		const notePath = path.join(vault, "note.md");
		fs.writeFileSync(notePath, "# Note\n![[exists.png]]\n![[missing.png]]\n");

		// Only create one of the files
		fs.writeFileSync(path.join(vault, "exists.png"), "");

		const attachments = extractLinkedAttachments(vault, "note.md");
		expect(attachments).toContain("exists.png");
		expect(attachments).not.toContain("missing.png");
		expect(attachments).toHaveLength(1);
	});

	it("returns empty array for note with no embeds", async () => {
		const { extractLinkedAttachments } = await import("./index");
		const vault = setupTestVault(tracker);
		const notePath = path.join(vault, "note.md");
		fs.writeFileSync(notePath, "# Note\nJust text, no embeds.\n");

		const attachments = extractLinkedAttachments(vault, "note.md");
		expect(attachments).toEqual([]);
	});

	it("handles mixed wikilink and markdown embeds", async () => {
		const { extractLinkedAttachments } = await import("./index");
		const vault = setupTestVault(tracker);
		const notePath = path.join(vault, "note.md");
		fs.writeFileSync(
			notePath,
			"# Note\n![[wiki.png]]\n![markdown](markdown.jpg)\n",
		);

		fs.writeFileSync(path.join(vault, "wiki.png"), "");
		fs.writeFileSync(path.join(vault, "markdown.jpg"), "");

		const attachments = extractLinkedAttachments(vault, "note.md");
		expect(attachments).toContain("wiki.png");
		expect(attachments).toContain("markdown.jpg");
		expect(attachments).toHaveLength(2);
	});

	it("deduplicates attachment paths", async () => {
		const { extractLinkedAttachments } = await import("./index");
		const vault = setupTestVault(tracker);
		const notePath = path.join(vault, "note.md");
		fs.writeFileSync(
			notePath,
			"# Note\n![[image.png]]\n![[image.png]]\n![alt](image.png)\n",
		);

		fs.writeFileSync(path.join(vault, "image.png"), "");

		const attachments = extractLinkedAttachments(vault, "note.md");
		expect(attachments).toContain("image.png");
		expect(attachments).toHaveLength(1);
	});
});

describe("commitNote", () => {
	const tracker = useTestVaultCleanup();
	afterEach(tracker.getAfterEachHook());

	it("commits a single note with message 'docs: <note title>'", async () => {
		const { commitNote } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create a note
		fs.writeFileSync(path.join(vault, "My Project Note.md"), "# My Project");

		const result = await commitNote(makeConfig(vault), "My Project Note.md");

		expect(result.committed).toBe(true);
		expect(result.message).toBe("docs: My Project Note");
		expect(result.files).toContain("My Project Note.md");

		// Verify commit exists
		const log = await Bun.$`git log --oneline -1`.cwd(vault).text();
		expect(log).toContain("docs: My Project Note");
	});

	it("includes linked attachments in same commit", async () => {
		const { commitNote } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create note with attachment reference
		const notePath = path.join(vault, "Project.md");
		fs.writeFileSync(notePath, "# Project\n![[diagram.png]]\n");
		fs.writeFileSync(path.join(vault, "diagram.png"), "image data");

		const result = await commitNote(makeConfig(vault), "Project.md");

		expect(result.committed).toBe(true);
		expect(result.files).toContain("Project.md");
		expect(result.files).toContain("diagram.png");
		expect(result.files).toHaveLength(2);

		// Verify both files are in the commit
		const show = await Bun.$`git show --name-only --format=format:`
			.cwd(vault)
			.text();
		expect(show).toContain("Project.md");
		expect(show).toContain("diagram.png");
	});

	it("title extracted from filename without .md extension", async () => {
		const { commitNote } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		fs.writeFileSync(
			path.join(vault, "Build Garden Shed.md"),
			"# Build Garden Shed",
		);

		const result = await commitNote(makeConfig(vault), "Build Garden Shed.md");

		expect(result.message).toBe("docs: Build Garden Shed");
	});

	it("handles notes in subdirectories", async () => {
		const { commitNote } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		fs.mkdirSync(path.join(vault, "projects"), { recursive: true });
		fs.writeFileSync(
			path.join(vault, "projects", "Website Redesign.md"),
			"# Website Redesign",
		);

		const result = await commitNote(
			makeConfig(vault),
			"projects/Website Redesign.md",
		);

		expect(result.committed).toBe(true);
		expect(result.message).toBe("docs: Website Redesign");
		expect(result.files).toContain("projects/Website Redesign.md");
	});

	it("fails gracefully if note does not exist", async () => {
		const { commitNote } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		await expect(
			commitNote(makeConfig(vault), "nonexistent.md"),
		).rejects.toThrow();
	});

	it("commits note with multiple attachments", async () => {
		const { commitNote } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		const notePath = path.join(vault, "Research.md");
		fs.writeFileSync(
			notePath,
			"# Research\n![[photo1.jpg]]\n![[photo2.jpg]]\n![[doc.pdf]]\n",
		);
		fs.writeFileSync(path.join(vault, "photo1.jpg"), "");
		fs.writeFileSync(path.join(vault, "photo2.jpg"), "");
		fs.writeFileSync(path.join(vault, "doc.pdf"), "");

		const result = await commitNote(makeConfig(vault), "Research.md");

		expect(result.files).toContain("Research.md");
		expect(result.files).toContain("photo1.jpg");
		expect(result.files).toContain("photo2.jpg");
		expect(result.files).toContain("doc.pdf");
		expect(result.files).toHaveLength(4);
	});

	it("commits staged deletions without re-adding missing files", async () => {
		const { commitNote } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		const filename = "🧾 Receipt.md";
		const notePath = path.join(vault, filename);
		fs.writeFileSync(notePath, "# Receipt");
		await Bun.$`git add ${filename}`.cwd(vault);
		await Bun.$`git commit -m "add note"`.cwd(vault);

		fs.unlinkSync(notePath);
		await Bun.$`git add -u`.cwd(vault);

		const result = await commitNote(makeConfig(vault), filename);

		expect(result.committed).toBe(true);

		const show =
			await Bun.$`git -c core.quotePath=false show --name-status --format=format:`
				.cwd(vault)
				.text();
		expect(show).toContain(`D\t${filename}`);

		const status = await Bun.$`git status --porcelain`.cwd(vault).text();
		expect(status.trim()).toBe("");
	});
});

describe("commitAllNotes", () => {
	const tracker = useTestVaultCleanup();
	afterEach(tracker.getAfterEachHook());

	it("creates one commit per uncommitted .md file", async () => {
		const { commitAllNotes } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create PARA folder structure
		fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true });

		// Create multiple notes in PARA folder
		fs.writeFileSync(path.join(vault, "00 Inbox", "Note 1.md"), "# Note 1");
		fs.writeFileSync(path.join(vault, "00 Inbox", "Note 2.md"), "# Note 2");
		fs.writeFileSync(path.join(vault, "00 Inbox", "Note 3.md"), "# Note 3");

		const result = await commitAllNotes(makeConfig(vault));

		expect(result.total).toBe(3);
		expect(result.committed).toBe(3);
		expect(result.results).toHaveLength(3);

		// Verify 3 commits were created
		const log = await Bun.$`git log --oneline`.cwd(vault).text();
		const commits = log.trim().split("\n");
		expect(commits.filter((c) => c.includes("docs:"))).toHaveLength(3);
	});

	it("returns accurate count of committed notes", async () => {
		const { commitAllNotes } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create PARA folder
		fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true });

		fs.writeFileSync(path.join(vault, "00 Inbox", "Alpha.md"), "# Alpha");
		fs.writeFileSync(path.join(vault, "00 Inbox", "Beta.md"), "# Beta");

		const result = await commitAllNotes(makeConfig(vault));

		expect(result.total).toBe(2);
		expect(result.committed).toBe(2);
		expect(result.results).toHaveLength(2);
		expect(
			result.results.every((r: { committed: boolean }) => r.committed),
		).toBe(true);
	});

	it("handles empty case (nothing to commit)", async () => {
		const { commitAllNotes } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Clean working tree
		const result = await commitAllNotes(makeConfig(vault));

		expect(result.total).toBe(0);
		expect(result.committed).toBe(0);
		expect(result.results).toEqual([]);
	});

	it("commits notes with their attachments", async () => {
		const { commitAllNotes } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create PARA folder
		fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true });

		// Note 1 with attachment
		fs.writeFileSync(
			path.join(vault, "00 Inbox", "Note 1.md"),
			"# Note 1\n![[img1.png]]",
		);
		fs.writeFileSync(path.join(vault, "00 Inbox", "img1.png"), "");

		// Note 2 with attachment
		fs.writeFileSync(
			path.join(vault, "00 Inbox", "Note 2.md"),
			"# Note 2\n![[img2.png]]",
		);
		fs.writeFileSync(path.join(vault, "00 Inbox", "img2.png"), "");

		const result = await commitAllNotes(makeConfig(vault));

		expect(result.total).toBe(2);
		expect(result.committed).toBe(2);

		// Verify each commit includes note + attachment
		const note1Result = result.results.find((r: { files: string[] }) =>
			r.files.includes("00 Inbox/Note 1.md"),
		);
		expect(note1Result?.files).toContain("00 Inbox/img1.png");

		const note2Result = result.results.find((r: { files: string[] }) =>
			r.files.includes("00 Inbox/Note 2.md"),
		);
		expect(note2Result?.files).toContain("00 Inbox/img2.png");
	});

	it("skips non-.md files", async () => {
		const { commitAllNotes } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create PARA folder
		fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true });

		// Create mixed files
		fs.writeFileSync(path.join(vault, "00 Inbox", "Note.md"), "# Note");
		fs.writeFileSync(
			path.join(vault, "00 Inbox", "script.js"),
			"console.log()",
		);
		fs.writeFileSync(path.join(vault, "00 Inbox", "data.json"), "{}");

		const result = await commitAllNotes(makeConfig(vault));

		expect(result.total).toBe(1); // Only the .md file
		expect(result.committed).toBe(1);
		expect(result.results[0]?.files).toContain("00 Inbox/Note.md");
	});

	it("commits notes in subdirectories", async () => {
		const { commitAllNotes } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create PARA folder structure with nested dirs
		fs.mkdirSync(path.join(vault, "01 Projects", "Work"), { recursive: true });
		fs.mkdirSync(path.join(vault, "02 Areas"), { recursive: true });
		fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true });

		fs.writeFileSync(
			path.join(vault, "01 Projects", "Work", "Project.md"),
			"# Project",
		);
		fs.writeFileSync(path.join(vault, "02 Areas", "Area.md"), "# Area");
		fs.writeFileSync(path.join(vault, "00 Inbox", "Note.md"), "# Note");

		const result = await commitAllNotes(makeConfig(vault));

		expect(result.total).toBe(3);
		expect(result.committed).toBe(3);

		const filePaths = result.results.flatMap(
			(r: { files: string[] }) => r.files,
		);
		expect(filePaths).toContain("01 Projects/Work/Project.md");
		expect(filePaths).toContain("02 Areas/Area.md");
		expect(filePaths).toContain("00 Inbox/Note.md");
	});

	it("ignores files outside PARA folders", async () => {
		const { commitAllNotes } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create PARA folder and non-PARA folders
		fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true });
		fs.mkdirSync(path.join(vault, "Templates"), { recursive: true });
		fs.mkdirSync(path.join(vault, "_Sort"), { recursive: true });

		// Files in PARA folder should be committed
		fs.writeFileSync(path.join(vault, "00 Inbox", "Note.md"), "# Note");

		// Files outside PARA folders should be ignored
		fs.writeFileSync(
			path.join(vault, "Templates", "Template.md"),
			"# Template",
		);
		fs.writeFileSync(path.join(vault, "_Sort", "Unsorted.md"), "# Unsorted");
		fs.writeFileSync(path.join(vault, "Root.md"), "# Root");

		const result = await commitAllNotes(makeConfig(vault));

		// Only the file in 00 Inbox should be committed
		expect(result.total).toBe(1);
		expect(result.committed).toBe(1);
		expect(result.results[0]?.files).toContain("00 Inbox/Note.md");
	});
});

describe("ensureGitGuard", () => {
	const tracker = useTestVaultCleanup();
	afterEach(tracker.getAfterEachHook());

	it("throws when PARA folders have uncommitted changes", async () => {
		const { ensureGitGuard } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create uncommitted file in PARA folder
		fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true });
		fs.writeFileSync(path.join(vault, "00 Inbox", "Note.md"), "# Note");

		await expect(ensureGitGuard(makeConfig(vault))).rejects.toThrow(
			/uncommitted changes/,
		);
	});

	it("allows non-PARA folders to have uncommitted changes", async () => {
		const { ensureGitGuard } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create uncommitted files ONLY in non-PARA folders
		fs.mkdirSync(path.join(vault, "Templates"), { recursive: true });
		fs.mkdirSync(path.join(vault, "_Sort"), { recursive: true });
		fs.writeFileSync(
			path.join(vault, "Templates", "Template.md"),
			"# Template",
		);
		fs.writeFileSync(path.join(vault, "_Sort", "Unsorted.md"), "# Unsorted");
		fs.writeFileSync(path.join(vault, "Root.md"), "# Root");

		// Should NOT throw - no PARA folders have uncommitted changes
		await expect(ensureGitGuard(makeConfig(vault))).resolves.toBeUndefined();
	});

	it("passes when PARA folders are clean", async () => {
		const { ensureGitGuard } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Clean working tree
		await expect(ensureGitGuard(makeConfig(vault))).resolves.toBeUndefined();
	});

	it("lists uncommitted PARA files in error message", async () => {
		const { ensureGitGuard } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		fs.mkdirSync(path.join(vault, "01 Projects"), { recursive: true });
		fs.writeFileSync(
			path.join(vault, "01 Projects", "Project.md"),
			"# Project",
		);

		await expect(ensureGitGuard(makeConfig(vault))).rejects.toThrow(
			/01 Projects\/Project\.md/,
		);
	});

	it("allows PDFs in PARA folders by default (only checks .md)", async () => {
		const { ensureGitGuard } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create uncommitted PDF in PARA folder
		fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true });
		fs.writeFileSync(path.join(vault, "00 Inbox", "document.pdf"), "PDF data");

		// Should NOT throw - default only checks .md files
		await expect(ensureGitGuard(makeConfig(vault))).resolves.toBeUndefined();
	});

	it("throws when checkAllFileTypes=true and PARA folders have uncommitted PDFs", async () => {
		const { ensureGitGuard } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create uncommitted PDF in PARA folder
		fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true });
		fs.writeFileSync(path.join(vault, "00 Inbox", "document.pdf"), "PDF data");

		// Should throw when checkAllFileTypes=true
		await expect(
			ensureGitGuard(makeConfig(vault), { checkAllFileTypes: true }),
		).rejects.toThrow(/uncommitted changes/);
	});

	it("throws when checkAllFileTypes=true and PARA folders have uncommitted JSON", async () => {
		const { ensureGitGuard } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create uncommitted JSON in PARA folder
		fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true });
		fs.writeFileSync(
			path.join(vault, "00 Inbox", "metadata.json"),
			'{"foo": "bar"}',
		);

		// Should throw when checkAllFileTypes=true
		await expect(
			ensureGitGuard(makeConfig(vault), { checkAllFileTypes: true }),
		).rejects.toThrow(/uncommitted changes/);
	});

	it("checkAllFileTypes=true lists all uncommitted file types in error", async () => {
		const { ensureGitGuard } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create mixed uncommitted files in PARA folder
		fs.mkdirSync(path.join(vault, "00 Inbox"), { recursive: true });
		fs.writeFileSync(path.join(vault, "00 Inbox", "note.md"), "# Note");
		fs.writeFileSync(path.join(vault, "00 Inbox", "doc.pdf"), "PDF");
		fs.writeFileSync(path.join(vault, "00 Inbox", "data.json"), "{}");

		const promise = ensureGitGuard(makeConfig(vault), {
			checkAllFileTypes: true,
		});

		await expect(promise).rejects.toThrow(/00 Inbox\/note\.md/);
		await expect(promise).rejects.toThrow(/00 Inbox\/doc\.pdf/);
		await expect(promise).rejects.toThrow(/00 Inbox\/data\.json/);
	});

	it("checkAllFileTypes=true allows non-.md files outside PARA folders", async () => {
		const { ensureGitGuard } = await import("./index");
		const vault = setupTestVault(tracker);
		await initGitRepo(vault);

		// Create uncommitted PDF outside PARA folders
		fs.mkdirSync(path.join(vault, "Templates"), { recursive: true });
		fs.writeFileSync(path.join(vault, "Templates", "template.pdf"), "PDF");

		// Should NOT throw - file is outside PARA folders
		await expect(
			ensureGitGuard(makeConfig(vault), { checkAllFileTypes: true }),
		).resolves.toBeUndefined();
	});
});
