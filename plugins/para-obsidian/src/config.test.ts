import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { loadConfig } from "./config";
import { DEFAULT_FRONTMATTER_RULES, DEFAULT_SUGGESTED_TAGS } from "./defaults";
import { createTestVault } from "./test-utils";

const originalEnv = { ...process.env };

function writeJson(filePath: string, data: unknown) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(data), "utf8");
}

describe("loadConfig", () => {
	afterEach(() => {
		process.env = { ...originalEnv };
	});

	it("throws when PARA_VAULT is missing", () => {
		delete process.env.PARA_VAULT;
		expect(() => loadConfig()).toThrow("PARA_VAULT");
	});

	it("resolves vault and default templates dir", () => {
		const vault = createTestVault();
		// Default templates dir is now vault/Templates (not 06_Metadata/Templates)
		fs.mkdirSync(path.join(vault, "Templates"), {
			recursive: true,
		});
		process.env.PARA_VAULT = vault;

		const cfg = loadConfig();
		expect(cfg.vault).toBe(path.resolve(vault));
		expect(cfg.templatesDir).toBe(path.join(vault, "Templates"));
		expect(cfg.suggestedTags).toEqual([...DEFAULT_SUGGESTED_TAGS]);
		expect(cfg.frontmatterRules).toEqual(DEFAULT_FRONTMATTER_RULES);
	});

	it("applies user config overrides", () => {
		const vault = createTestVault();
		const home = createTestVault();
		fs.mkdirSync(path.join(vault, "Templates"), {
			recursive: true,
		});
		process.env.PARA_VAULT = vault;
		process.env.HOME = home;

		const userTemplates = path.join(vault, "custom-templates");
		writeJson(path.join(home, ".config", "para-obsidian", "config.json"), {
			templatesDir: userTemplates,
			autoCommit: true,
		});

		const cfg = loadConfig({ cwd: vault });
		expect(cfg.templatesDir).toBe(userTemplates);
		expect(cfg.autoCommit).toBe(true);
	});

	it("applies explicit config path from PARA_OBSIDIAN_CONFIG", () => {
		const vault = createTestVault();
		fs.mkdirSync(path.join(vault, "Templates"), {
			recursive: true,
		});
		process.env.PARA_VAULT = vault;

		const explicit = createTestVault();
		const explicitConfigPath = path.join(explicit, "rc.json");
		writeJson(explicitConfigPath, {
			gitCommitMessageTemplate: "docs(vault): <title>",
		});
		process.env.PARA_OBSIDIAN_CONFIG = explicitConfigPath;

		const cfg = loadConfig({ cwd: vault });
		expect(cfg.gitCommitMessageTemplate).toBe("docs(vault): <title>");
	});

	it("prefers user config over project rc", () => {
		const vault = createTestVault();
		const home = createTestVault();
		const cwd = createTestVault();
		fs.mkdirSync(path.join(vault, "Templates"), {
			recursive: true,
		});
		process.env.PARA_VAULT = vault;
		process.env.HOME = home;

		writeJson(path.join(home, ".config", "para-obsidian", "config.json"), {
			autoCommit: true,
		});
		writeJson(path.join(cwd, ".para-obsidianrc"), {
			autoCommit: false,
		});

		const cfg = loadConfig({ cwd });
		expect(cfg.autoCommit).toBe(true);
	});

	it("errors when PARA_VAULT is not a directory", () => {
		const vault = path.join(createTestVault(), "missing");
		process.env.PARA_VAULT = vault;
		expect(() => loadConfig()).toThrow("does not point to a directory");
	});
});
