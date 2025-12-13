import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import type { ParaObsidianConfig } from "../config/index";
import { createTestVault, initGitRepo } from "../test-utils";
import { autoCommitChanges } from "./index";

describe("autoCommitChanges", () => {
	it("stages and commits when autoCommit is enabled", async () => {
		const vault = createTestVault();
		await initGitRepo(vault);

		const target = path.join(vault, "note.md");
		fs.writeFileSync(target, "content", "utf8");
		const attachment = path.join(vault, "assets", "image.png");
		fs.mkdirSync(path.dirname(attachment), { recursive: true });
		fs.writeFileSync(attachment, "data", "utf8");

		const config: ParaObsidianConfig = { vault, autoCommit: true };
		const result = await autoCommitChanges(
			config,
			["note.md", "assets/image.png"],
			"test",
		);

		expect(result.committed).toBe(true);
		const log = (await Bun.$`git log -1 --pretty=%B`.cwd(vault).text()).trim();
		expect(log).toBe("docs: para-obsidian test");
		const tracked = (await Bun.$`git ls-files`.cwd(vault).text()).split("\n");
		expect(tracked).toContain("note.md");
		expect(tracked).toContain("assets/image.png");
	});

	it("skips when autoCommit is disabled", async () => {
		const vault = createTestVault();
		await initGitRepo(vault);

		fs.writeFileSync(path.join(vault, "note.md"), "content", "utf8");

		const config: ParaObsidianConfig = { vault, autoCommit: false };
		const result = await autoCommitChanges(config, ["note.md"], "test");

		expect(result.skipped).toBe(true);
		const commitCount = Number(
			(await Bun.$`git rev-list --count HEAD`.cwd(vault).text()).trim(),
		);
		expect(commitCount).toBe(1); // only init commit
	});
});
