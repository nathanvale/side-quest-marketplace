import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "bun";

import { loadConfig } from "./config";

function makeTmpDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "para-cli-test-"));
	// Initialize git repo (required by CLI for writes)
	Bun.spawnSync(["git", "init"], {
		cwd: dir,
		stdout: "ignore",
		stderr: "ignore",
	});
	Bun.spawnSync(["git", "config", "user.email", "test@test.com"], {
		cwd: dir,
		stdout: "ignore",
		stderr: "ignore",
	});
	Bun.spawnSync(["git", "config", "user.name", "Test"], {
		cwd: dir,
		stdout: "ignore",
		stderr: "ignore",
	});
	return dir;
}

function writeTemplate(dir: string, name: string, content: string) {
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, `${name}.md`), content, "utf8");
}

function commitAll(vault: string) {
	// Git needs clean working tree - commit template files
	Bun.spawnSync(["git", "add", "."], { cwd: vault });
	Bun.spawnSync(["git", "commit", "-m", "init"], { cwd: vault });
}

async function runCli(
	args: string[],
	env: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const cliPath = path.join(import.meta.dir, "cli.ts");
	const proc = spawn({
		cmd: ["bun", "run", cliPath, ...args],
		env: { ...process.env, ...env },
		stdout: "pipe",
		stderr: "pipe",
	});

	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;

	return { stdout, stderr, exitCode };
}

// Smoke test for config command wiring. The CLI itself prints to stdout/stderr,
// so we just ensure loadConfig is callable in this context.
describe("cli", () => {
	it("loads config without throwing when PARA_VAULT is set", () => {
		const vault = "/tmp"; // using tmp ensures directory exists
		const originalEnv = { ...process.env };
		process.env.PARA_VAULT = vault;

		expect(() => loadConfig()).not.toThrow();

		process.env = originalEnv;
	});
});

describe("cli create --content", () => {
	it("creates note and injects content into sections", async () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("Title") %>"
type: project
---
# <% tp.system.prompt("Title") %>

## Why This Matters

## Success Criteria
`,
		);
		commitAll(vault);

		const content = JSON.stringify({
			"Why This Matters": "This project addresses a critical need.",
			"Success Criteria": "- [ ] Feature complete\n- [ ] Tests pass",
		});

		const { stdout, exitCode } = await runCli(
			[
				"create",
				"--template",
				"project",
				"--title",
				"Test Project",
				"--content",
				content,
				"--format",
				"json",
			],
			{ PARA_VAULT: vault },
		);

		expect(exitCode).toBe(0);
		const result = JSON.parse(stdout);
		expect(result.filePath).toBe("01 Projects/Test Project.md");
		expect(result.sectionsInjected).toBe(2);
		expect(result.injectedHeadings).toContain("Why This Matters");
		expect(result.injectedHeadings).toContain("Success Criteria");

		// Verify file content
		const written = fs.readFileSync(
			path.join(vault, "01 Projects", "Test Project.md"),
			"utf8",
		);
		expect(written).toContain("This project addresses a critical need.");
		expect(written).toContain("- [ ] Feature complete");
	});

	it("handles invalid JSON in --content flag", async () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("Title") %>"
type: project
---
# Title`,
		);
		commitAll(vault);

		const { stderr, exitCode } = await runCli(
			[
				"create",
				"--template",
				"project",
				"--title",
				"Test",
				"--content",
				"not valid json",
				"--format",
				"json",
			],
			{ PARA_VAULT: vault },
		);

		expect(exitCode).toBe(1);
		expect(stderr).toContain("Invalid --content JSON");
	});

	it("reports partial success when some headings missing", async () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("Title") %>"
type: project
---
# <% tp.system.prompt("Title") %>

## Existing Section
`,
		);
		commitAll(vault);

		const content = JSON.stringify({
			"Existing Section": "This will be injected",
			"Missing Section": "This will be skipped",
		});

		const { stdout, exitCode } = await runCli(
			[
				"create",
				"--template",
				"project",
				"--title",
				"Partial Test",
				"--content",
				content,
				"--format",
				"json",
			],
			{ PARA_VAULT: vault },
		);

		expect(exitCode).toBe(0);
		const result = JSON.parse(stdout);
		expect(result.sectionsInjected).toBe(1);
		expect(result.sectionsSkipped).toHaveLength(1);
		expect(result.injectedHeadings).toContain("Existing Section");
		expect(result.sectionsSkipped[0].heading).toBe("Missing Section");
		expect(result.sectionsSkipped[0].reason).toContain("Heading not found");

		// Verify only existing section was injected
		const written = fs.readFileSync(
			path.join(vault, "01 Projects", "Partial Test.md"),
			"utf8",
		);
		expect(written).toContain("This will be injected");
		expect(written).not.toContain("This will be skipped");
	});

	it("outputs markdown format by default with injection results", async () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("Title") %>"
type: project
---
# <% tp.system.prompt("Title") %>

## Tasks
`,
		);
		commitAll(vault);

		const content = JSON.stringify({
			Tasks: "- [ ] First task",
		});

		const { stdout, exitCode } = await runCli(
			[
				"create",
				"--template",
				"project",
				"--title",
				"Markdown Test",
				"--content",
				content,
			],
			{ PARA_VAULT: vault },
		);

		expect(exitCode).toBe(0);
		// Check for colored output or plain text (depends on TTY)
		expect(stdout).toContain("Markdown Test.md");
		expect(stdout).toContain("1");
	});

	it("creates note without content when --content not provided", async () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("Title") %>"
type: project
---
# <% tp.system.prompt("Title") %>

## Section
`,
		);
		commitAll(vault);

		const { stdout, exitCode } = await runCli(
			[
				"create",
				"--template",
				"project",
				"--title",
				"No Content Test",
				"--format",
				"json",
			],
			{ PARA_VAULT: vault },
		);

		expect(exitCode).toBe(0);
		const result = JSON.parse(stdout);
		expect(result.filePath).toBe("01 Projects/No Content Test.md");
		// No content injection fields when --content not provided
		expect(result.sectionsInjected).toBeUndefined();
	});

	it("skips empty content values in --content", async () => {
		const vault = makeTmpDir();
		const templatesDir = path.join(vault, "Templates");
		writeTemplate(
			templatesDir,
			"project",
			`---
title: "<% tp.system.prompt("Title") %>"
type: project
---
# <% tp.system.prompt("Title") %>

## Section One

## Section Two
`,
		);
		commitAll(vault);

		const content = JSON.stringify({
			"Section One": "Has content",
			"Section Two": "",
		});

		const { stdout, exitCode } = await runCli(
			[
				"create",
				"--template",
				"project",
				"--title",
				"Empty Skip Test",
				"--content",
				content,
				"--format",
				"json",
			],
			{ PARA_VAULT: vault },
		);

		expect(exitCode).toBe(0);
		const result = JSON.parse(stdout);
		expect(result.sectionsInjected).toBe(1);
		expect(result.sectionsSkipped).toHaveLength(1);
		expect(result.sectionsSkipped[0].reason).toBe("Empty content");
	});
});
