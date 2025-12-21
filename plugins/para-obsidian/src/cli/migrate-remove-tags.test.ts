/**
 * Tests for migrate-remove-tags command.
 *
 * @module cli/migrate-remove-tags.test
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import type { ParaObsidianConfig } from "../config/index";
import { parseFrontmatter } from "../frontmatter/index";
import { migrateRemoveTags } from "./migrate-remove-tags";

describe("migrateRemoveTags", () => {
	let testVault: string;
	let config: ParaObsidianConfig;

	beforeEach(() => {
		// Create temporary test vault
		testVault = fs.mkdtempSync(path.join(import.meta.dir, "test-vault-"));
		config = {
			vault: testVault,
		} as ParaObsidianConfig;
	});

	afterEach(() => {
		// Clean up test vault
		fs.rmSync(testVault, { recursive: true, force: true });
	});

	test("removes tags from notes with string tags", async () => {
		const filePath = path.join(testVault, "note.md");
		const content = `---
title: Test Note
tags: work
status: active
---

# Content here`;

		fs.writeFileSync(filePath, content);

		const result = await migrateRemoveTags(config, { dryRun: false });

		expect(result.totalFiles).toBe(1);
		expect(result.modifiedFiles).toBe(1);
		expect(result.errors).toHaveLength(0);
		expect(result.changes).toHaveLength(1);
		expect(result.changes[0]?.removedTags).toBe("work");

		// Verify file was modified
		const newContent = fs.readFileSync(filePath, "utf-8");
		const { attributes } = parseFrontmatter(newContent);
		expect(attributes.tags).toBeUndefined();
		expect(attributes.title).toBe("Test Note");
		expect(attributes.status).toBe("active");
	});

	test("removes tags from notes with array tags", async () => {
		const filePath = path.join(testVault, "note.md");
		const content = `---
title: Test Note
tags:
  - work
  - project
  - urgent
status: active
---

# Content here`;

		fs.writeFileSync(filePath, content);

		const result = await migrateRemoveTags(config, { dryRun: false });

		expect(result.totalFiles).toBe(1);
		expect(result.modifiedFiles).toBe(1);
		expect(result.errors).toHaveLength(0);
		expect(result.changes).toHaveLength(1);
		expect(result.changes[0]?.removedTags).toEqual([
			"work",
			"project",
			"urgent",
		]);

		// Verify file was modified
		const newContent = fs.readFileSync(filePath, "utf-8");
		const { attributes } = parseFrontmatter(newContent);
		expect(attributes.tags).toBeUndefined();
		expect(attributes.title).toBe("Test Note");
		expect(attributes.status).toBe("active");
	});

	test("skips notes without tags", async () => {
		const filePath = path.join(testVault, "note.md");
		const content = `---
title: Test Note
status: active
---

# Content here`;

		fs.writeFileSync(filePath, content);

		const result = await migrateRemoveTags(config, { dryRun: false });

		expect(result.totalFiles).toBe(1);
		expect(result.modifiedFiles).toBe(0);
		expect(result.errors).toHaveLength(0);
		expect(result.changes).toHaveLength(0);

		// Verify file was not modified
		const newContent = fs.readFileSync(filePath, "utf-8");
		expect(newContent).toBe(content);
	});

	test("preserves other frontmatter fields", async () => {
		const filePath = path.join(testVault, "note.md");
		const content = `---
title: Test Note
tags:
  - work
type: project
status: active
created: 2025-01-01
area: "[[Health]]"
target_completion: 2025-12-31
---

# Content here`;

		fs.writeFileSync(filePath, content);

		const result = await migrateRemoveTags(config, { dryRun: false });

		expect(result.totalFiles).toBe(1);
		expect(result.modifiedFiles).toBe(1);

		// Verify all other fields preserved
		const newContent = fs.readFileSync(filePath, "utf-8");
		const { attributes } = parseFrontmatter(newContent);
		expect(attributes.tags).toBeUndefined();
		expect(attributes.title).toBe("Test Note");
		expect(attributes.type).toBe("project");
		expect(attributes.status).toBe("active");
		expect(attributes.created).toBe("2025-01-01");
		expect(attributes.area).toBe("[[Health]]");
		expect(attributes.target_completion).toBe("2025-12-31");
	});

	test("dry-run doesn't modify files", async () => {
		const filePath = path.join(testVault, "note.md");
		const content = `---
title: Test Note
tags: work
status: active
---

# Content here`;

		fs.writeFileSync(filePath, content);

		const result = await migrateRemoveTags(config, { dryRun: true });

		expect(result.totalFiles).toBe(1);
		expect(result.modifiedFiles).toBe(1);
		expect(result.changes).toHaveLength(1);

		// Verify file was NOT modified
		const newContent = fs.readFileSync(filePath, "utf-8");
		expect(newContent).toBe(content);

		const { attributes } = parseFrontmatter(newContent);
		expect(attributes.tags).toBe("work");
	});

	test("handles multiple files", async () => {
		// Create multiple files
		const files = [
			{
				name: "note1.md",
				content: `---
title: Note 1
tags: work
---
Content 1`,
			},
			{
				name: "note2.md",
				content: `---
title: Note 2
tags:
  - personal
  - health
---
Content 2`,
			},
			{
				name: "note3.md",
				content: `---
title: Note 3
status: active
---
Content 3`,
			},
		];

		for (const file of files) {
			fs.writeFileSync(path.join(testVault, file.name), file.content);
		}

		const result = await migrateRemoveTags(config, { dryRun: false });

		expect(result.totalFiles).toBe(3);
		expect(result.modifiedFiles).toBe(2); // note1 and note2
		expect(result.errors).toHaveLength(0);
		expect(result.changes).toHaveLength(2);

		// Verify note1
		const note1 = parseFrontmatter(
			fs.readFileSync(path.join(testVault, "note1.md"), "utf-8"),
		);
		expect(note1.attributes.tags).toBeUndefined();
		expect(note1.attributes.title).toBe("Note 1");

		// Verify note2
		const note2 = parseFrontmatter(
			fs.readFileSync(path.join(testVault, "note2.md"), "utf-8"),
		);
		expect(note2.attributes.tags).toBeUndefined();
		expect(note2.attributes.title).toBe("Note 2");

		// Verify note3 unchanged
		const note3 = parseFrontmatter(
			fs.readFileSync(path.join(testVault, "note3.md"), "utf-8"),
		);
		expect(note3.attributes.tags).toBeUndefined();
		expect(note3.attributes.title).toBe("Note 3");
	});

	test("handles nested directories", async () => {
		// Create nested structure
		const projectsDir = path.join(testVault, "01_Projects");
		fs.mkdirSync(projectsDir, { recursive: true });

		const filePath = path.join(projectsDir, "project.md");
		const content = `---
title: Project
tags:
  - active
  - important
---
Content`;

		fs.writeFileSync(filePath, content);

		const result = await migrateRemoveTags(config, { dryRun: false });

		expect(result.totalFiles).toBe(1);
		expect(result.modifiedFiles).toBe(1);

		// Verify file was modified
		const newContent = fs.readFileSync(filePath, "utf-8");
		const { attributes } = parseFrontmatter(newContent);
		expect(attributes.tags).toBeUndefined();
	});

	test("handles invalid YAML gracefully", async () => {
		const filePath = path.join(testVault, "broken.md");
		const content = `---
title: Test
tags: [invalid yaml structure
---

Content`;

		fs.writeFileSync(filePath, content);

		const result = await migrateRemoveTags(config, { dryRun: false });

		expect(result.totalFiles).toBe(1);
		expect(result.modifiedFiles).toBe(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.file).toBe("broken.md");
		expect(result.errors[0]?.error).toContain("Invalid frontmatter");
	});

	test("handles files without frontmatter", async () => {
		const filePath = path.join(testVault, "no-frontmatter.md");
		const content = "# Just a heading\n\nSome content.";

		fs.writeFileSync(filePath, content);

		const result = await migrateRemoveTags(config, { dryRun: false });

		expect(result.totalFiles).toBe(1);
		expect(result.modifiedFiles).toBe(0);
		expect(result.errors).toHaveLength(0);

		// Verify file unchanged
		const newContent = fs.readFileSync(filePath, "utf-8");
		expect(newContent).toBe(content);
	});

	test("verbose mode tracks all operations", async () => {
		const files = [
			{
				name: "with-tags.md",
				content: `---
title: With Tags
tags: work
---
Content`,
			},
			{
				name: "without-tags.md",
				content: `---
title: Without Tags
---
Content`,
			},
		];

		for (const file of files) {
			fs.writeFileSync(path.join(testVault, file.name), file.content);
		}

		const result = await migrateRemoveTags(config, {
			dryRun: false,
			verbose: true,
		});

		expect(result.totalFiles).toBe(2);
		expect(result.modifiedFiles).toBe(1);
		expect(result.changes).toHaveLength(1);
		expect(result.changes[0]?.file).toBe("with-tags.md");
	});

	test("preserves body content exactly", async () => {
		const filePath = path.join(testVault, "note.md");
		const bodyContent = `# Heading

Some text with **bold** and *italic*.

- List item 1
- List item 2

\`\`\`typescript
const code = "preserved";
\`\`\`

More content with [[wikilinks]] and #inline-tags.`;

		const content = `---
title: Test Note
tags: work
---
${bodyContent}`;

		fs.writeFileSync(filePath, content);

		const result = await migrateRemoveTags(config, { dryRun: false });

		expect(result.modifiedFiles).toBe(1);

		// Verify body preserved exactly
		const newContent = fs.readFileSync(filePath, "utf-8");
		const { body } = parseFrontmatter(newContent);
		expect(body.trim()).toBe(bodyContent.trim());
	});

	test("handles empty tags field", async () => {
		const filePath = path.join(testVault, "note.md");
		const content = `---
title: Test Note
tags:
status: active
---

# Content`;

		fs.writeFileSync(filePath, content);

		const result = await migrateRemoveTags(config, { dryRun: false });

		expect(result.totalFiles).toBe(1);
		expect(result.modifiedFiles).toBe(1);

		// Verify tags removed
		const newContent = fs.readFileSync(filePath, "utf-8");
		const { attributes } = parseFrontmatter(newContent);
		expect(attributes.tags).toBeUndefined();
	});

	test("reports correct file paths relative to vault", async () => {
		const subdir = path.join(testVault, "Projects");
		fs.mkdirSync(subdir, { recursive: true });

		const filePath = path.join(subdir, "project.md");
		fs.writeFileSync(
			filePath,
			`---
title: Project
tags: work
---
Content`,
		);

		const result = await migrateRemoveTags(config, { dryRun: false });

		expect(result.changes[0]?.file).toBe("Projects/project.md");
	});
});
