import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { gitStatus } from "./git";

function makeTmpDir(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "para-obsidian-"));
}

async function initGit(dir: string) {
	await Bun.$`git init`.cwd(dir);
	await Bun.$`git config user.email "test@example.com"`.cwd(dir);
	await Bun.$`git config user.name "Test"`.cwd(dir);
	fs.writeFileSync(path.join(dir, ".gitignore"), "node_modules\n");
	await Bun.$`git add .`.cwd(dir);
	await Bun.$`git commit -m init`.cwd(dir);
}

describe("git helpers", () => {
	it("reports clean/dirty status", async () => {
		const dir = makeTmpDir();
		await initGit(dir);
		const clean = await gitStatus(dir);
		expect(clean.clean).toBe(true);

		fs.writeFileSync(path.join(dir, "file.txt"), "change");
		const dirty = await gitStatus(dir);
		expect(dirty.clean).toBe(false);
	});
});
