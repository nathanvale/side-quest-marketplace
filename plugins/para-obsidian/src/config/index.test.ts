import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { createTestVault, useTestVaultCleanup } from "../testing/utils";
import { DEFAULT_FRONTMATTER_RULES } from "./defaults";
import { loadConfig } from "./index";

function writeJson(filePath: string, data: unknown) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(data), "utf8");
}

describe("loadConfig", () => {
	const { trackVault, getAfterEachHook } = useTestVaultCleanup();

	/**
	 * Helper function to create and track a test vault
	 */
	function setupTest() {
		const vault = createTestVault();
		trackVault(vault);
		return vault;
	}

	// Track config-specific environment variables for cleanup
	const originalHome = process.env.HOME;
	const originalConfig = process.env.PARA_OBSIDIAN_CONFIG;

	afterEach(() => {
		getAfterEachHook()();
		// Restore config-specific env vars
		if (originalHome !== undefined) {
			process.env.HOME = originalHome;
		} else {
			delete process.env.HOME;
		}
		if (originalConfig !== undefined) {
			process.env.PARA_OBSIDIAN_CONFIG = originalConfig;
		} else {
			delete process.env.PARA_OBSIDIAN_CONFIG;
		}
	});

	it("throws when PARA_VAULT is missing", () => {
		delete process.env.PARA_VAULT;
		expect(() => loadConfig()).toThrow("PARA_VAULT");
	});

	it("resolves vault and default templates dir", () => {
		const vault = setupTest();
		// Default templates dir is now vault/Templates (not 06_Metadata/Templates)
		fs.mkdirSync(path.join(vault, "Templates"), {
			recursive: true,
		});
		process.env.PARA_VAULT = vault;

		const cfg = loadConfig();
		expect(cfg.vault).toBe(path.resolve(vault));
		expect(cfg.templatesDir).toBe(path.join(vault, "Templates"));
		expect(cfg.suggestedTags).toEqual([]);
		expect(cfg.frontmatterRules).toEqual(DEFAULT_FRONTMATTER_RULES);
	});

	it("applies user config overrides", () => {
		const vault = setupTest();
		const home = setupTest();
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
		const vault = setupTest();
		fs.mkdirSync(path.join(vault, "Templates"), {
			recursive: true,
		});
		process.env.PARA_VAULT = vault;

		const explicit = setupTest();
		const explicitConfigPath = path.join(explicit, "rc.json");
		writeJson(explicitConfigPath, {
			gitCommitMessageTemplate: "docs(vault): <title>",
		});
		process.env.PARA_OBSIDIAN_CONFIG = explicitConfigPath;

		const cfg = loadConfig({ cwd: vault });
		expect(cfg.gitCommitMessageTemplate).toBe("docs(vault): <title>");
	});

	it("prefers user config over project rc", () => {
		const vault = setupTest();
		const home = setupTest();
		fs.mkdirSync(path.join(vault, "Templates"), {
			recursive: true,
		});
		process.env.PARA_VAULT = vault;
		process.env.HOME = home;

		// User config says true
		writeJson(path.join(home, ".config", "para-obsidian", "config.json"), {
			autoCommit: true,
		});
		// Project config in vault says false
		writeJson(path.join(vault, ".paraobsidianrc"), {
			autoCommit: false,
		});

		const cfg = loadConfig();
		// User config should win (priority: project < user < explicit)
		expect(cfg.autoCommit).toBe(true);
	});

	it("errors when PARA_VAULT is not a directory", () => {
		const tempVault = setupTest();
		const vault = path.join(tempVault, "missing");
		process.env.PARA_VAULT = vault;
		expect(() => loadConfig()).toThrow("does not point to a directory");
	});

	describe("invalid JSON handling", () => {
		it("handles invalid JSON in project config gracefully", () => {
			const vault = setupTest();
			fs.mkdirSync(path.join(vault, "Templates"), { recursive: true });
			process.env.PARA_VAULT = vault;

			// Write invalid JSON to project config
			const projectRcPath = path.join(vault, ".paraobsidianrc");
			fs.writeFileSync(projectRcPath, "{ invalid json", "utf8");

			// Should not throw - should use defaults
			const cfg = loadConfig();
			expect(cfg.vault).toBe(path.resolve(vault));
			expect(cfg.autoCommit).toBe(true); // Default value
		});

		it("handles invalid JSON in user config gracefully", () => {
			const vault = setupTest();
			const home = setupTest();
			fs.mkdirSync(path.join(vault, "Templates"), { recursive: true });
			process.env.PARA_VAULT = vault;
			process.env.HOME = home;

			// Write invalid JSON to user config
			const userConfigPath = path.join(
				home,
				".config",
				"para-obsidian",
				"config.json",
			);
			fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
			fs.writeFileSync(userConfigPath, "{ invalid json", "utf8");

			// Should not throw - should use defaults
			const cfg = loadConfig();
			expect(cfg.vault).toBe(path.resolve(vault));
			expect(cfg.autoCommit).toBe(true); // Default value
		});

		it("handles invalid JSON in explicit config gracefully", () => {
			const vault = setupTest();
			fs.mkdirSync(path.join(vault, "Templates"), { recursive: true });
			process.env.PARA_VAULT = vault;

			// Use vault directory for explicit config (safe location)
			const explicitConfigPath = path.join(vault, "rc.json");
			fs.writeFileSync(explicitConfigPath, "{ invalid json", "utf8");
			process.env.PARA_OBSIDIAN_CONFIG = explicitConfigPath;

			// Should not throw - should use defaults
			const cfg = loadConfig();
			expect(cfg.vault).toBe(path.resolve(vault));
			expect(cfg.autoCommit).toBe(true); // Default value
		});

		it("applies valid configs even when other configs are invalid", () => {
			const vault = setupTest();
			const home = setupTest();
			fs.mkdirSync(path.join(vault, "Templates"), { recursive: true });
			process.env.PARA_VAULT = vault;
			process.env.HOME = home;

			// Invalid project config
			const projectRcPath = path.join(vault, ".paraobsidianrc");
			fs.writeFileSync(projectRcPath, "{ invalid json", "utf8");

			// Valid user config
			writeJson(path.join(home, ".config", "para-obsidian", "config.json"), {
				autoCommit: false,
			});

			const cfg = loadConfig();
			expect(cfg.autoCommit).toBe(false); // Should use user config value
		});
	});

	describe("path traversal security", () => {
		it("rejects path traversal with ..", () => {
			const vault = setupTest();
			fs.mkdirSync(path.join(vault, "Templates"), {
				recursive: true,
			});
			process.env.PARA_VAULT = vault;
			process.env.PARA_OBSIDIAN_CONFIG = "../../../etc/passwd";

			expect(() => loadConfig()).toThrow("path is not allowed");
		});

		it("rejects absolute paths outside safe locations", () => {
			const vault = setupTest();
			fs.mkdirSync(path.join(vault, "Templates"), {
				recursive: true,
			});
			process.env.PARA_VAULT = vault;
			process.env.PARA_OBSIDIAN_CONFIG = "/etc/passwd";

			expect(() => loadConfig()).toThrow("path is not allowed");
		});

		it("rejects double-slash bypass attempts like //etc/passwd", () => {
			const vault = setupTest();
			fs.mkdirSync(path.join(vault, "Templates"), {
				recursive: true,
			});
			process.env.PARA_VAULT = vault;
			process.env.PARA_OBSIDIAN_CONFIG = "//etc/passwd";

			expect(() => loadConfig()).toThrow("path is not allowed");
		});

		it("rejects paths that escape cwd with multiple ..", () => {
			const vault = setupTest();
			fs.mkdirSync(path.join(vault, "Templates"), {
				recursive: true,
			});
			process.env.PARA_VAULT = vault;
			process.env.PARA_OBSIDIAN_CONFIG = "../../../../../../etc/passwd";

			expect(() => loadConfig()).toThrow("path is not allowed");
		});

		it("allows config within vault directory", () => {
			const vault = setupTest();
			fs.mkdirSync(path.join(vault, "Templates"), {
				recursive: true,
			});
			process.env.PARA_VAULT = vault;

			const vaultConfigPath = path.join(vault, "config.json");
			writeJson(vaultConfigPath, {
				autoCommit: false,
			});
			process.env.PARA_OBSIDIAN_CONFIG = vaultConfigPath;

			const cfg = loadConfig();
			expect(cfg.autoCommit).toBe(false);
		});

		it("allows config within process.cwd()", () => {
			const vault = setupTest();
			fs.mkdirSync(path.join(vault, "Templates"), {
				recursive: true,
			});
			process.env.PARA_VAULT = vault;

			// Use actual process.cwd() since that's what isConfigPathSafe checks
			const cwdConfigPath = path.join(process.cwd(), "myconfig.json");
			try {
				writeJson(cwdConfigPath, {
					autoCommit: false,
				});
				process.env.PARA_OBSIDIAN_CONFIG = cwdConfigPath;

				const cfg = loadConfig();
				expect(cfg.autoCommit).toBe(false);
			} finally {
				// Clean up the config file created in cwd
				if (fs.existsSync(cwdConfigPath)) {
					fs.unlinkSync(cwdConfigPath);
				}
			}
		});

		it("allows config within home/.config directory", () => {
			const vault = setupTest();
			const home = setupTest();
			fs.mkdirSync(path.join(vault, "Templates"), {
				recursive: true,
			});
			process.env.PARA_VAULT = vault;
			process.env.HOME = home;

			const homeConfigPath = path.join(
				home,
				".config",
				"para-obsidian",
				"custom.json",
			);
			writeJson(homeConfigPath, {
				autoCommit: false,
			});
			process.env.PARA_OBSIDIAN_CONFIG = homeConfigPath;

			const cfg = loadConfig();
			expect(cfg.autoCommit).toBe(false);
		});
	});
});
